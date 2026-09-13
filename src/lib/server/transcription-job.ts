import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { learningPoints, lessonExtracts, lessonRecordings, lessonSegments, lessonSegmentTranscripts, lessons, transcriptionJobChunks, transcriptionJobs, transcripts } from "@/db/schema";
import type { TranscriptionJobChunkRow, TranscriptionJobRow } from "@/db/schema";
import { clipAudioSegments } from "@/lib/server/audio-segments";
import { probeAudioDuration } from "@/lib/server/audio-duration";
import { analyzeLessonTranscript, lessonSummaryText, parseLessonAnalysis, type LessonAnalysisResult, type LessonEvidence } from "@/lib/server/lesson-analysis";
import { materializeLessonAudioFile } from "@/lib/server/lesson-audio-storage";
import { DEFAULT_TRANSCRIPTION_MODEL, transcribeAudioFile } from "@/lib/server/openai-transcription";
import { MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS, MAX_TRANSCRIPTION_CHUNK_SECONDS, resolveTranscriptionMode, splitRangeIntoChunks, transcriptionRequestKey, TranscriptionRequestError, validateDuration, type PlannedTranscriptionChunk } from "@/lib/server/transcription-policy";
export { MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS, MAX_TRANSCRIPTION_CHUNK_SECONDS, TranscriptionRequestError };

const LEASE_MS = 5 * 60 * 1000;
const WORK_BUDGET_MS = 7 * 60 * 1000;
const nowIso = () => new Date().toISOString();
class WorkerLeaseLost extends Error {}

export function isStaleRunningTranscriptionJob(job: Pick<TranscriptionJobRow, "status" | "updatedAt"> & Partial<Pick<TranscriptionJobRow, "leaseExpiresAt">>) {
  return job.status === "running" && Date.now() > (job.leaseExpiresAt ? Date.parse(job.leaseExpiresAt) : Date.parse(job.updatedAt) + LEASE_MS);
}
export function isStaleQueuedTranscriptionJob(job: Pick<TranscriptionJobRow, "status" | "updatedAt" | "startedAt">) {
  return job.status === "queued" && Date.now() - Date.parse(job.updatedAt) > 2 * 60 * 1000;
}
async function loadJob(jobId: string) {
  const [job] = await createDatabaseClient().select().from(transcriptionJobs).where(eq(transcriptionJobs.id, jobId));
  if (!job) throw new TranscriptionRequestError("Transcription job not found.", 404);
  return job;
}
async function loadJobChunks(jobId: string) {
  return createDatabaseClient().select().from(transcriptionJobChunks).where(eq(transcriptionJobChunks.jobId, jobId)).orderBy(asc(transcriptionJobChunks.position));
}
function jobResponse(job: TranscriptionJobRow) {
  return { jobId: job.id, mode: job.mode, selectedSegmentCount: job.selectedSegmentCount, shouldStart: job.status === "queued" || job.status === "failed" || isStaleRunningTranscriptionJob(job), totalChunks: job.totalChunks, transcriptId: job.transcriptId };
}
async function queueExisting(job: TranscriptionJobRow) {
  if (job.status === "complete" || (job.status === "running" && !isStaleRunningTranscriptionJob(job))) return jobResponse(job);
  const db = createDatabaseClient();
  const [queued] = await db.update(transcriptionJobs).set({ status: "queued", errorMessage: null, completedAt: null, leaseToken: null, leaseExpiresAt: null, updatedAt: nowIso(), currentLabel: job.completedChunks === job.totalChunks && job.totalChunks > 0 ? "Extraction retry queued" : "Queued to continue" }).where(and(eq(transcriptionJobs.id, job.id), ne(transcriptionJobs.status, "complete"), or(isNull(transcriptionJobs.leaseExpiresAt), lt(transcriptionJobs.leaseExpiresAt, nowIso())))).returning();
  return jobResponse(queued ?? await loadJob(job.id));
}

export async function retryLessonAnalysis({ jobId, lessonId, recordingId }: { jobId: string; lessonId: string; recordingId: string }) {
  const job = await loadJob(jobId);
  if (job.lessonId !== lessonId || job.recordingId !== recordingId) throw new TranscriptionRequestError("That analysis does not belong to this recording.", 404);
  const chunks = await loadJobChunks(jobId);
  if (!chunks.length || chunks.some((chunk) => chunk.status !== "complete")) throw new TranscriptionRequestError("The transcript is not yet complete. Resume transcription first.");
  return queueExisting(job);
}

export async function createLessonTranscriptionJob({ includeFullRecording, lessonId, recordingId }: { includeFullRecording?: boolean; lessonId: string; recordingId: string }) {
  const db = createDatabaseClient();
  const [recording] = await db.select().from(lessonRecordings).where(and(eq(lessonRecordings.id, recordingId), eq(lessonRecordings.lessonId, lessonId)));
  if (!recording) throw new TranscriptionRequestError("Recording not found.", 404);
  const mode = resolveTranscriptionMode(includeFullRecording);
  const selected = mode === "selected_segments" ? await db.select().from(lessonSegments).where(and(eq(lessonSegments.lessonId, lessonId), eq(lessonSegments.recordingId, recordingId), inArray(lessonSegments.status, ["selected", "transcribed"]))).orderBy(asc(lessonSegments.startsAtSeconds)) : [];
  if (mode === "selected_segments" && !selected.length) throw new TranscriptionRequestError("Select at least one clip, or analyse the whole lesson.");
  const duration = recording.durationSeconds ? validateDuration(recording.durationSeconds) : null;
  if (duration && selected.some((segment) => segment.endsAtSeconds > duration)) throw new TranscriptionRequestError("A selected clip extends past the end of this recording.");
  const chunks = mode === "full_recording" ? (duration ? splitRangeIntoChunks({ startsAtSeconds: 0, endsAtSeconds: duration, label: "Full recording" }) : []) : selected.flatMap((segment) => splitRangeIntoChunks({ ...segment, segmentId: segment.id, label: segment.title }));
  const requestKey = transcriptionRequestKey({ lessonId, recordingId, storageBucket: recording.storageBucket, storagePath: recording.storagePath, mode, model: DEFAULT_TRANSCRIPTION_MODEL, chunks });
  const [existing] = await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.requestKey, requestKey));
  if (existing) return queueExisting(existing);
  const requestedAt = nowIso();
  const proposedId = randomUUID();
  const insertJob = db.insert(transcriptionJobs).values({ id: proposedId, lessonId, recordingId, requestKey, mode, totalChunks: chunks.length, selectedSegmentCount: selected.length, selectedSeconds: mode === "selected_segments" ? selected.reduce((sum, item) => sum + item.endsAtSeconds - item.startsAtSeconds, 0) : 0, fullDurationSeconds: mode === "full_recording" ? duration : null, currentLabel: duration ? "Queued to start" : "Queued to read recording duration", requestedAt, updatedAt: requestedAt }).onConflictDoNothing({ target: transcriptionJobs.requestKey }).returning();
  let inserted: TranscriptionJobRow[];
  try {
    // A queued job must never exist without its immutable selected-clip plan.
    // Neon executes this batch as one transaction; either both inserts persist or
    // neither does. A competing requestKey winner makes the losing batch roll back.
    [inserted] = chunks.length
      ? await db.batch([insertJob, db.insert(transcriptionJobChunks).values(chunks.map((chunk, index) => ({ ...chunk, jobId: proposedId, position: index + 1, updatedAt: requestedAt })))])
      : [await insertJob];
  } catch (error) {
    const [winner] = await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.requestKey, requestKey));
    if (winner) return queueExisting(winner);
    throw error;
  }
  const job = inserted[0];
  if (!job) {
    const [winner] = await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.requestKey, requestKey));
    return queueExisting(winner);
  }
  return jobResponse(job);
}

async function renewLease(jobId: string, leaseToken: string, currentLabel?: string) {
  const [job] = await createDatabaseClient().update(transcriptionJobs).set({ leaseExpiresAt: new Date(Date.now() + LEASE_MS).toISOString(), updatedAt: nowIso(), ...(currentLabel ? { currentLabel } : {}) }).where(and(eq(transcriptionJobs.id, jobId), eq(transcriptionJobs.leaseToken, leaseToken))).returning();
  if (!job) throw new WorkerLeaseLost("Another worker has resumed this lesson.");
  return job;
}

export async function markTranscriptionJobFailed({ errorMessage, jobId, leaseToken }: { errorMessage: string; jobId: string; leaseToken?: string }) {
  const db = createDatabaseClient();
  // Dispatch/poll failures cannot clobber an active worker or a completed run.
  const [job] = await db.update(transcriptionJobs).set({ status: "failed", analysisStatus: sql`case when ${transcriptionJobs.totalChunks} > 0 and ${transcriptionJobs.completedChunks} = ${transcriptionJobs.totalChunks} then 'failed' else ${transcriptionJobs.analysisStatus} end`, completedAt: null, currentLabel: "Processing paused; saved progress is ready to retry", errorMessage, leaseToken: null, leaseExpiresAt: null, updatedAt: nowIso() }).where(and(eq(transcriptionJobs.id, jobId), ne(transcriptionJobs.status, "complete"), leaseToken ? eq(transcriptionJobs.leaseToken, leaseToken) : or(isNull(transcriptionJobs.leaseExpiresAt), lt(transcriptionJobs.leaseExpiresAt, nowIso())))).returning();
  if (job?.transcriptId && job.completedChunks < job.totalChunks) await db.update(transcripts).set({ status: "failed", errorMessage }).where(and(eq(transcripts.id, job.transcriptId), ne(transcripts.status, "complete")));
}

function renderedTranscript(chunks: TranscriptionJobChunkRow[]) {
  return chunks.filter((chunk) => chunk.status === "complete").map((chunk) => `[${chunk.label}; approximate source passage ${chunk.startsAtSeconds}-${chunk.endsAtSeconds} seconds]\n${chunk.text ?? ""}`).join("\n\n");
}
function evidenceFromChunks(chunks: TranscriptionJobChunkRow[], mode: string): LessonEvidence[] {
  return chunks.map((chunk) => ({ id: chunk.id, startsAtSeconds: chunk.startsAtSeconds, endsAtSeconds: chunk.endsAtSeconds, text: chunk.text ?? "", segmentId: chunk.segmentId ?? undefined, precision: mode === "selected_segments" ? "segment" : "approximate" }));
}

async function publishAnalysis(job: TranscriptionJobRow, analysis: LessonAnalysisResult, chunks: TranscriptionJobChunkRow[]) {
  const db = createDatabaseClient();
  const evidence = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const points = [
    ...analysis.summaryBullets.map((item, index) => ({ ...item, sourceKey: `teaching-${index}`, practiceAction: undefined as string | undefined })),
    ...analysis.practiceCandidates.map((item, index) => ({ ...item, sourceKey: `practice-${index}`, practiceAction: item.suggestedPracticeNote })),
  ];
  const pointRows = points.map((item) => ({ lessonId: job.lessonId, recordingId: job.recordingId, analysisRunId: job.id, sourceKey: item.sourceKey, title: item.title, body: item.body, kind: item.kind, practiceAction: item.practiceAction, startsAtSeconds: item.startsAtSeconds, endsAtSeconds: item.endsAtSeconds, evidencePrecision: item.evidencePrecision, evidenceText: item.evidenceText }));
  // Never delete old candidates or overwrite a kept/edited teaching point. The cached
  // validated result and run/source unique keys make a retried publication idempotent.
  const lessonUpdate = db.update(lessons).set({ status: "extracted", summary: sql`coalesce(nullif(${lessons.summary}, ''), ${lessonSummaryText(analysis)})`, updatedAt: nowIso() }).where(eq(lessons.id, job.lessonId));
  const operations = [lessonUpdate];
  if (pointRows.length) operations.push(db.insert(learningPoints).values(pointRows).onConflictDoNothing() as unknown as typeof lessonUpdate);
  if (analysis.practiceCandidates.length) operations.push(db.insert(lessonExtracts).values(analysis.practiceCandidates.map((item, index) => ({ lessonId: job.lessonId, transcriptId: job.transcriptId, segmentId: evidence.get(item.evidenceId)?.segmentId, analysisRunId: job.id, sourceKey: `practice-${index}`, title: item.title, body: `${item.body}\n\nPossible follow-up: ${item.suggestedPracticeNote}`, startsAtSeconds: item.startsAtSeconds, endsAtSeconds: item.endsAtSeconds }))).onConflictDoNothing() as unknown as typeof lessonUpdate);
  await db.batch(operations as [typeof lessonUpdate, ...typeof lessonUpdate[]]);
}

async function saveSegmentTranscripts(job: TranscriptionJobRow, chunks: TranscriptionJobChunkRow[], analysis: LessonAnalysisResult) {
  if (job.mode !== "selected_segments") return;
  const db = createDatabaseClient();
  const ids = [...new Set(chunks.map((chunk) => chunk.segmentId).filter((id): id is string => Boolean(id)))];
  for (const id of ids) {
    const segmentChunks = chunks.filter((chunk) => chunk.segmentId === id);
    const chunkIds = new Set(segmentChunks.map((chunk) => chunk.id));
    const memories = analysis.summaryBullets.filter((item) => chunkIds.has(item.evidenceId));
    const values = { summaryTitle: memories[0]?.title ?? null, summaryBody: memories.length ? memories.map((item) => item.body).join("\n\n") : null, lessonId: job.lessonId, recordingId: job.recordingId, segmentId: id, transcriptId: job.transcriptId, text: renderedTranscript(segmentChunks), status: "complete" as const, completedAt: nowIso(), requestedAt: job.requestedAt, updatedAt: nowIso(), errorMessage: null };
    await db.insert(lessonSegmentTranscripts).values(values).onConflictDoUpdate({ target: lessonSegmentTranscripts.segmentId, set: { ...values, summaryTitle: sql`coalesce(${lessonSegmentTranscripts.summaryTitle}, excluded.summary_title)`, summaryBody: sql`coalesce(${lessonSegmentTranscripts.summaryBody}, excluded.summary_body)` }, setWhere: sql`${lessonSegmentTranscripts.requestedAt} is null or ${lessonSegmentTranscripts.requestedAt} <= ${job.requestedAt}` });
    await db.update(lessonSegments).set({ status: "transcribed", updatedAt: nowIso() }).where(and(eq(lessonSegments.id, id), eq(lessonSegments.startsAtSeconds, segmentChunks[0].startsAtSeconds), eq(lessonSegments.endsAtSeconds, segmentChunks.at(-1)!.endsAtSeconds), ne(lessonSegments.status, "discarded")));
  }
}

async function finalizeJob(job: TranscriptionJobRow, leaseToken: string) {
  const db = createDatabaseClient();
  const chunks = await loadJobChunks(job.id);
  if (!chunks.length || chunks.length !== job.totalChunks || chunks.some((chunk) => chunk.status !== "complete")) throw new Error("Not all lesson passages have been transcribed yet.");
  await renewLease(job.id, leaseToken, "Extracting learning points from the saved transcript");
  await db.update(transcripts).set({ status: "complete", completedAt: nowIso(), text: renderedTranscript(chunks), model: [...new Set(chunks.map((chunk) => chunk.model).filter(Boolean))].join(", "), errorMessage: null }).where(eq(transcripts.id, job.transcriptId!));
  await db.update(transcriptionJobs).set({ analysisStatus: "running", completedChunks: chunks.length }).where(and(eq(transcriptionJobs.id, job.id), eq(transcriptionJobs.leaseToken, leaseToken)));
  const evidence = evidenceFromChunks(chunks, job.mode);
  try {
    const analysis = job.analysisResult ? parseLessonAnalysis(job.analysisResult, evidence) : await analyzeLessonTranscript({ evidence });
    await renewLease(job.id, leaseToken);
    // Save before publication; failure after this point never needs another model call.
    await db.update(transcriptionJobs).set({ analysisResult: JSON.stringify(analysis) }).where(and(eq(transcriptionJobs.id, job.id), eq(transcriptionJobs.leaseToken, leaseToken)));
    await publishAnalysis(job, analysis, chunks);
    await saveSegmentTranscripts(job, chunks, analysis);
    await db.update(transcriptionJobs).set({ status: "complete", analysisStatus: "complete", completedAt: nowIso(), currentLabel: "Learning points ready to review", errorMessage: null, leaseToken: null, leaseExpiresAt: null, updatedAt: nowIso() }).where(and(eq(transcriptionJobs.id, job.id), eq(transcriptionJobs.leaseToken, leaseToken)));
    return { status: "complete" as const, analysisStatus: "complete" as const, practiceCandidateCount: analysis.practiceCandidates.length, summaryBulletCount: analysis.summaryBullets.length };
  } catch (error) {
    if (error instanceof WorkerLeaseLost) throw error;
    await db.update(transcriptionJobs).set({ analysisStatus: "failed" }).where(and(eq(transcriptionJobs.id, job.id), eq(transcriptionJobs.leaseToken, leaseToken)));
    throw error;
  }
}

export async function runLessonTranscriptionJob({ jobId, workBudgetMs = WORK_BUDGET_MS }: { jobId: string; workBudgetMs?: number }) {
  const db = createDatabaseClient();
  const leaseToken = randomUUID();
  const start = Date.now();
  let audioFile: Awaited<ReturnType<typeof materializeLessonAudioFile>> = null;
  let [job] = await db.update(transcriptionJobs).set({ status: "running", leaseToken, leaseExpiresAt: new Date(Date.now() + LEASE_MS).toISOString(), startedAt: sql`coalesce(${transcriptionJobs.startedAt}, now())`, updatedAt: nowIso(), currentLabel: "Preparing lesson", errorMessage: null }).where(and(eq(transcriptionJobs.id, jobId), ne(transcriptionJobs.status, "complete"), or(isNull(transcriptionJobs.leaseExpiresAt), lt(transcriptionJobs.leaseExpiresAt, nowIso())))).returning();
  if (!job) return { status: "already_running_or_complete" as const };
  try {
    if (!job.transcriptId) {
      const [transcript] = await db.insert(transcripts).values({ lessonId: job.lessonId, recordingId: job.recordingId, requestedAt: job.requestedAt }).returning();
      [job] = await db.update(transcriptionJobs).set({ transcriptId: transcript.id }).where(and(eq(transcriptionJobs.id, job.id), eq(transcriptionJobs.leaseToken, leaseToken))).returning();
    }
    let chunks = await loadJobChunks(jobId);
    if (!chunks.length || chunks.some((chunk) => chunk.status !== "complete")) {
      const [recording] = await db.select().from(lessonRecordings).where(and(eq(lessonRecordings.id, job.recordingId), eq(lessonRecordings.lessonId, job.lessonId)));
      if (!recording) throw new Error("Recording not found.");
      audioFile = await materializeLessonAudioFile({ storageBucket: recording.storageBucket, storagePath: recording.storagePath });
      if (!audioFile) throw new Error("The recording audio is unavailable. Saved transcripts have been preserved.");
      await renewLease(job.id, leaseToken);
      if (!recording.durationSeconds || !chunks.length) {
        await renewLease(job.id, leaseToken, "Reading recording duration");
        const duration = validateDuration(await probeAudioDuration(audioFile.filePath));
        await renewLease(job.id, leaseToken);
        if (!chunks.length && job.mode === "full_recording") {
          const planned = splitRangeIntoChunks({ startsAtSeconds: 0, endsAtSeconds: duration, label: "Full recording" });
          const [, , updatedJobs] = await db.batch([
            db.update(lessonRecordings).set({ durationSeconds: duration }).where(eq(lessonRecordings.id, recording.id)),
            db.insert(transcriptionJobChunks).values(planned.map((chunk, index) => ({ ...chunk, jobId, position: index + 1 }))).onConflictDoNothing(),
            db.update(transcriptionJobs).set({ fullDurationSeconds: duration, totalChunks: planned.length }).where(and(eq(transcriptionJobs.id, jobId), eq(transcriptionJobs.leaseToken, leaseToken))).returning(),
          ]);
          job = updatedJobs[0];
          chunks = await loadJobChunks(jobId);
        } else {
          await db.update(lessonRecordings).set({ durationSeconds: duration }).where(eq(lessonRecordings.id, recording.id));
        }
        if (chunks.some((chunk) => chunk.endsAtSeconds > duration)) throw new Error("A selected clip extends beyond the recorded audio. Correct the clip range and analyse it again.");
      }
      for (const chunk of chunks.filter((item) => item.status !== "complete")) {
        if (Date.now() - start >= workBudgetMs) {
          await db.update(transcriptionJobs).set({ status: "queued", currentLabel: "Continuing with the next saved passage", leaseToken: null, leaseExpiresAt: null, updatedAt: nowIso() }).where(and(eq(transcriptionJobs.id, jobId), eq(transcriptionJobs.leaseToken, leaseToken)));
          return { status: "queued" as const };
        }
        await renewLease(jobId, leaseToken, `Transcribing passage ${chunk.position} of ${job.totalChunks}`);
        await db.update(transcriptionJobChunks).set({ status: "running", startedAt: nowIso(), errorMessage: null, updatedAt: nowIso() }).where(eq(transcriptionJobChunks.id, chunk.id));
        let clipped: Awaited<ReturnType<typeof clipAudioSegments>> | undefined;
        try {
          clipped = await clipAudioSegments({ sourceFilePath: audioFile.filePath, segments: [{ id: chunk.id, title: chunk.label, startsAtSeconds: chunk.startsAtSeconds, endsAtSeconds: chunk.endsAtSeconds }] });
          const transcription = await transcribeAudioFile({ filePath: clipped.clippedSegments[0].filePath });
          await renewLease(jobId, leaseToken);
          await db.update(transcriptionJobChunks).set({ status: "complete", completedAt: nowIso(), text: transcription.text, model: transcription.model, durationMs: Math.max(1, transcription.durationMs), updatedAt: nowIso(), errorMessage: null }).where(eq(transcriptionJobChunks.id, chunk.id));
          const saved = await loadJobChunks(jobId);
          await db.update(transcriptionJobs).set({ completedChunks: saved.filter((item) => item.status === "complete").length, updatedAt: nowIso() }).where(and(eq(transcriptionJobs.id, jobId), eq(transcriptionJobs.leaseToken, leaseToken)));
          await db.update(transcripts).set({ text: renderedTranscript(saved), status: "pending", errorMessage: null }).where(eq(transcripts.id, job.transcriptId!));
        } catch (error) {
          if (!(error instanceof WorkerLeaseLost)) {
            await renewLease(jobId, leaseToken);
            await db.update(transcriptionJobChunks).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Audio transcription failed.", updatedAt: nowIso() }).where(eq(transcriptionJobChunks.id, chunk.id));
          }
          throw error;
        } finally { await clipped?.cleanup(); }
      }
    }
    job = await loadJob(jobId);
    return await finalizeJob(job, leaseToken);
  } catch (error) {
    if (error instanceof WorkerLeaseLost) return { status: "lease_lost" as const };
    await markTranscriptionJobFailed({ jobId, leaseToken, errorMessage: error instanceof Error ? error.message : "Lesson processing failed. Saved progress can be retried." });
    throw error;
  } finally { await audioFile?.cleanup(); }
}
