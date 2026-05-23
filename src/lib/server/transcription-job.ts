import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import {
  lessonExtracts,
  lessonRecordings,
  lessonSegments,
  lessonSegmentTranscripts,
  lessons,
  transcriptionJobChunks,
  transcriptionJobs,
  transcripts,
} from "@/db/schema";
import type {
  LessonSegmentRow,
  TranscriptionJobChunkRow,
  TranscriptionJobRow,
} from "@/db/schema";
import { clipAudioSegments } from "@/lib/server/audio-segments";
import {
  analyzeLessonSegments,
  analyzeLessonTranscript,
  lessonSummaryText,
  type LessonAnalysisResult,
  type LessonSegmentAnalysisInput,
  type SegmentedLessonAnalysisResult,
} from "@/lib/server/lesson-analysis";
import { materializeLessonAudioFile } from "@/lib/server/lesson-audio-storage";
import { transcribeAudioFile } from "@/lib/server/openai-transcription";

export const MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS = 60 * 60;
export const MAX_TRANSCRIPTION_CHUNK_SECONDS = 3 * 60;
const STALE_RUNNING_TRANSCRIPTION_JOB_MS = 20 * 60 * 1000;

type TranscriptionMode = "selected_segments" | "full_recording";

type TranscribedLessonSegment = LessonSegmentAnalysisInput & {
  model: string;
};

type PlannedTranscriptionChunk = {
  endsAtSeconds: number;
  label: string;
  segmentId?: string;
  startsAtSeconds: number;
};

export class TranscriptionRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TranscriptionRequestError";
    this.status = status;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function isStaleRunningTranscriptionJob(
  job: Pick<TranscriptionJobRow, "status" | "updatedAt">,
) {
  if (job.status !== "running") return false;

  const updatedAt = new Date(job.updatedAt).getTime();

  if (!Number.isFinite(updatedAt)) return true;

  return Date.now() - updatedAt > STALE_RUNNING_TRANSCRIPTION_JOB_MS;
}

function formatTimestamp(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function transcriptionModelLabel(chunks: TranscriptionJobChunkRow[]) {
  return Array.from(
    new Set(chunks.map((chunk) => chunk.model).filter(Boolean)),
  ).join(", ");
}

function renderTranscriptionText({
  chunks,
}: {
  chunks: TranscriptionJobChunkRow[];
}) {
  return chunks
    .filter((chunk) => chunk.status === "complete" && chunk.text)
    .sort((left, right) => left.position - right.position)
    .map((chunk) =>
      [
        `[${chunk.label}. Original audio ${formatTimestamp(
          chunk.startsAtSeconds,
        )}-${formatTimestamp(chunk.endsAtSeconds)}.]`,
        chunk.text,
      ].join("\n"),
    )
    .join("\n\n");
}

function splitRangeIntoChunks({
  endsAtSeconds,
  label,
  segmentId,
  startsAtSeconds,
}: {
  endsAtSeconds: number;
  label: string;
  segmentId?: string;
  startsAtSeconds: number;
}) {
  const chunks: PlannedTranscriptionChunk[] = [];
  const totalParts = Math.ceil(
    (endsAtSeconds - startsAtSeconds) / MAX_TRANSCRIPTION_CHUNK_SECONDS,
  );

  for (
    let chunkStart = startsAtSeconds, index = 0;
    chunkStart < endsAtSeconds;
    chunkStart += MAX_TRANSCRIPTION_CHUNK_SECONDS, index += 1
  ) {
    const chunkLabel =
      totalParts > 1 ? `${label}, part ${index + 1}` : label;

    chunks.push({
      endsAtSeconds: Math.min(
        chunkStart + MAX_TRANSCRIPTION_CHUNK_SECONDS,
        endsAtSeconds,
      ),
      label: chunkLabel,
      segmentId,
      startsAtSeconds: chunkStart,
    });
  }

  return chunks;
}

function buildSelectedSegmentChunks(
  selectedSegments: Pick<
    LessonSegmentRow,
    "endsAtSeconds" | "id" | "startsAtSeconds" | "title"
  >[],
) {
  return selectedSegments.flatMap((segment, index) =>
    splitRangeIntoChunks({
      endsAtSeconds: segment.endsAtSeconds,
      label: `Teaching segment ${index + 1}: ${segment.title}`,
      segmentId: segment.id,
      startsAtSeconds: segment.startsAtSeconds,
    }),
  );
}

function buildFullRecordingChunks(durationSeconds: number) {
  return splitRangeIntoChunks({
    endsAtSeconds: durationSeconds,
    label: "Full recording",
    startsAtSeconds: 0,
  }).map((chunk, index) => ({
    ...chunk,
    label: `Full recording part ${index + 1}`,
  }));
}

async function saveLessonAnalysis({
  analysis,
  lessonId,
  transcriptId,
}: {
  analysis: LessonAnalysisResult;
  lessonId: string;
  transcriptId: string;
}) {
  const db = createDatabaseClient();
  const summary = lessonSummaryText(analysis);
  const updatedAt = nowIso();

  await db
    .delete(lessonExtracts)
    .where(
      and(
        eq(lessonExtracts.lessonId, lessonId),
        eq(lessonExtracts.status, "candidate"),
      ),
    );

  if (analysis.practiceCandidates.length > 0) {
    await db.insert(lessonExtracts).values(
      analysis.practiceCandidates.map((item) => ({
        lessonId,
        transcriptId,
        title: item.title,
        body: `${item.body}\n\nPossible follow-up: ${item.suggestedPracticeNote}`,
        startsAtSeconds: item.startsAtSeconds,
        endsAtSeconds: item.endsAtSeconds,
        status: "candidate" as const,
      })),
    );
  }

  await db
    .update(lessons)
    .set({
      status: analysis.practiceCandidates.length > 0 ? "extracted" : "transcribed",
      summary: summary || null,
      updatedAt,
    })
    .where(eq(lessons.id, lessonId));
}

async function saveRawSegmentTranscripts({
  completedAt,
  lessonId,
  recordingId,
  requestedAt,
  segments,
  transcriptId,
}: {
  completedAt: string;
  lessonId: string;
  recordingId: string;
  requestedAt: string;
  segments: TranscribedLessonSegment[];
  transcriptId: string;
}) {
  const db = createDatabaseClient();

  for (const segment of segments) {
    const [existing] = await db
      .select({ id: lessonSegmentTranscripts.id })
      .from(lessonSegmentTranscripts)
      .where(eq(lessonSegmentTranscripts.segmentId, segment.segmentId));

    const values = {
      completedAt,
      errorMessage: null,
      language: "en" as const,
      lessonId,
      model: segment.model,
      recordingId,
      requestedAt,
      segmentId: segment.segmentId,
      status: "complete" as const,
      text: segment.transcriptText,
      transcriptId,
      updatedAt: completedAt,
    };

    if (existing) {
      await db
        .update(lessonSegmentTranscripts)
        .set(values)
        .where(eq(lessonSegmentTranscripts.id, existing.id));
      continue;
    }

    await db.insert(lessonSegmentTranscripts).values(values);
  }
}

async function saveSegmentedLessonAnalysis({
  analysis,
  lessonId,
  transcriptId,
}: {
  analysis: SegmentedLessonAnalysisResult;
  lessonId: string;
  transcriptId: string;
}) {
  const db = createDatabaseClient();
  const summary = lessonSummaryText(analysis);
  const updatedAt = nowIso();
  const memoryBySegmentId = new Map(
    analysis.segmentMemories.map((memory) => [memory.segmentId, memory]),
  );

  await db
    .delete(lessonExtracts)
    .where(
      and(
        eq(lessonExtracts.lessonId, lessonId),
        eq(lessonExtracts.status, "candidate"),
      ),
    );

  for (const memory of analysis.segmentMemories) {
    await db
      .update(lessonSegmentTranscripts)
      .set({
        summaryBody: memory.body,
        summaryTitle: memory.title,
        updatedAt,
      })
      .where(eq(lessonSegmentTranscripts.segmentId, memory.segmentId));
  }

  const practiceCandidateRows = analysis.practiceCandidates
    .filter((item) => item.segmentId && memoryBySegmentId.has(item.segmentId))
    .map((item) => {
      const memory = memoryBySegmentId.get(item.segmentId ?? "");

      return {
        lessonId,
        segmentId: item.segmentId,
        transcriptId,
        title: item.title,
        body: `${item.body}\n\nPossible follow-up: ${item.suggestedPracticeNote}`,
        startsAtSeconds: item.startsAtSeconds,
        endsAtSeconds:
          item.endsAtSeconds ??
          memory?.endsAtSeconds ??
          Math.max(item.startsAtSeconds + 1, item.startsAtSeconds),
        status: "candidate" as const,
      };
    });

  if (practiceCandidateRows.length > 0) {
    await db.insert(lessonExtracts).values(practiceCandidateRows);
  }

  await db
    .update(lessons)
    .set({
      status: practiceCandidateRows.length > 0 ? "extracted" : "transcribed",
      summary: summary || null,
      updatedAt,
    })
    .where(eq(lessons.id, lessonId));
}

async function ensurePendingTranscript({
  lessonId,
  recordingId,
  requestedAt,
}: {
  lessonId: string;
  recordingId: string;
  requestedAt: string;
}) {
  const db = createDatabaseClient();
  const [existingTranscript] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(
      and(
        eq(transcripts.lessonId, lessonId),
        eq(transcripts.recordingId, recordingId),
      ),
    );

  if (existingTranscript) {
    await db
      .update(transcripts)
      .set({
        completedAt: null,
        errorMessage: null,
        language: "en",
        requestedAt,
        status: "pending",
      })
      .where(eq(transcripts.id, existingTranscript.id));
    return existingTranscript.id;
  }

  const [createdTranscript] = await db
    .insert(transcripts)
    .values({
      lessonId,
      recordingId,
      language: "en",
      requestedAt,
      status: "pending",
    })
    .returning({ id: transcripts.id });

  return createdTranscript.id;
}

async function reusableJob({
  chunks,
  fullDurationSeconds,
  lessonId,
  mode,
  recordingId,
  selectedSeconds,
  selectedSegmentCount,
}: {
  chunks: PlannedTranscriptionChunk[];
  fullDurationSeconds: number | null;
  lessonId: string;
  mode: TranscriptionMode;
  recordingId: string;
  selectedSeconds: number;
  selectedSegmentCount: number;
}) {
  const db = createDatabaseClient();
  const [latestJob] = await db
    .select()
    .from(transcriptionJobs)
    .where(
      and(
        eq(transcriptionJobs.lessonId, lessonId),
        eq(transcriptionJobs.recordingId, recordingId),
        eq(transcriptionJobs.mode, mode),
      ),
    )
    .orderBy(desc(transcriptionJobs.requestedAt))
    .limit(1);

  if (!latestJob || latestJob.status === "complete") return null;
  if (latestJob.totalChunks !== chunks.length) return null;
  if (latestJob.selectedSeconds !== selectedSeconds) return null;
  if (latestJob.selectedSegmentCount !== selectedSegmentCount) return null;
  if ((latestJob.fullDurationSeconds ?? null) !== fullDurationSeconds) return null;

  const existingChunks = await db
    .select()
    .from(transcriptionJobChunks)
    .where(eq(transcriptionJobChunks.jobId, latestJob.id));

  return existingChunks.length === chunks.length ? latestJob : null;
}

export async function createLessonTranscriptionJob({
  includeFullRecording,
  lessonId,
  recordingId,
}: {
  includeFullRecording: boolean;
  lessonId: string;
  recordingId: string;
}) {
  const db = createDatabaseClient();
  const [recording] = await db
    .select()
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.id, recordingId),
        eq(lessonRecordings.lessonId, lessonId),
      ),
    );

  if (!recording) {
    throw new TranscriptionRequestError("Recording not found.", 404);
  }

  const selectedSegments = await db
    .select({
      endsAtSeconds: lessonSegments.endsAtSeconds,
      id: lessonSegments.id,
      startsAtSeconds: lessonSegments.startsAtSeconds,
      title: lessonSegments.title,
    })
    .from(lessonSegments)
    .where(
      and(
        eq(lessonSegments.lessonId, lessonId),
        eq(lessonSegments.recordingId, recordingId),
        eq(lessonSegments.status, "selected"),
      ),
    )
    .orderBy(asc(lessonSegments.startsAtSeconds));

  if (selectedSegments.length === 0 && !includeFullRecording) {
    throw new TranscriptionRequestError(
      "No teaching segments selected. Confirm full-recording transcription to continue.",
    );
  }

  const recordingDurationSeconds = recording.durationSeconds ?? 0;
  const mode: TranscriptionMode =
    selectedSegments.length > 0 ? "selected_segments" : "full_recording";
  const selectedSeconds = selectedSegments.reduce(
    (total, segment) =>
      total + Math.max(segment.endsAtSeconds - segment.startsAtSeconds, 0),
    0,
  );

  if (mode === "full_recording") {
    if (recordingDurationSeconds <= 0) {
      throw new TranscriptionRequestError(
        "This recording does not have a reliable duration. Create one or more teaching clips and transcribe the selected clips instead.",
      );
    }

    if (recordingDurationSeconds > MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS) {
      throw new TranscriptionRequestError(
        "This recording is too long for full-recording transcription. Create one or more teaching clips and transcribe the selected clips instead.",
      );
    }
  }

  const chunks =
    mode === "selected_segments"
      ? buildSelectedSegmentChunks(selectedSegments)
      : buildFullRecordingChunks(recordingDurationSeconds);
  const requestedAt = nowIso();
  const transcriptId = await ensurePendingTranscript({
    lessonId,
    recordingId,
    requestedAt,
  });
  const matchingJob = await reusableJob({
    chunks,
    fullDurationSeconds:
      mode === "full_recording" ? recordingDurationSeconds : null,
    lessonId,
    mode,
    recordingId,
    selectedSeconds,
    selectedSegmentCount: selectedSegments.length,
  });

  if (matchingJob) {
    const shouldRestartStaleJob = isStaleRunningTranscriptionJob(matchingJob);

    if (matchingJob.status === "failed" || shouldRestartStaleJob) {
      await db
        .update(transcriptionJobChunks)
        .set({
          errorMessage: null,
          status: "pending",
          updatedAt: requestedAt,
        })
        .where(
          and(
            eq(transcriptionJobChunks.jobId, matchingJob.id),
            inArray(transcriptionJobChunks.status, ["failed", "running"]),
          ),
        );
    }

    const completedChunks = await db
      .select({ id: transcriptionJobChunks.id })
      .from(transcriptionJobChunks)
      .where(
        and(
          eq(transcriptionJobChunks.jobId, matchingJob.id),
          eq(transcriptionJobChunks.status, "complete"),
        ),
      );

    await db
      .update(transcriptionJobs)
      .set({
        completedAt: null,
        completedChunks: completedChunks.length,
        currentLabel:
          matchingJob.status === "failed"
            ? "Retry queued"
            : shouldRestartStaleJob
              ? "Restart queued after stalled run"
            : matchingJob.currentLabel,
        errorMessage: null,
        requestedAt,
        startedAt: shouldRestartStaleJob ? null : matchingJob.startedAt,
        status:
          matchingJob.status === "running" && !shouldRestartStaleJob
            ? "running"
            : "queued",
        transcriptId,
        updatedAt: requestedAt,
      })
      .where(eq(transcriptionJobs.id, matchingJob.id));

    return {
      jobId: matchingJob.id,
      mode,
      selectedSegmentCount: selectedSegments.length,
      shouldStart: matchingJob.status !== "running" || shouldRestartStaleJob,
      totalChunks: chunks.length,
      transcriptId,
    };
  }

  const [job] = await db
    .insert(transcriptionJobs)
    .values({
      lessonId,
      recordingId,
      transcriptId,
      mode,
      status: "queued",
      totalChunks: chunks.length,
      completedChunks: 0,
      selectedSegmentCount: selectedSegments.length,
      selectedSeconds,
      fullDurationSeconds:
        mode === "full_recording" ? recordingDurationSeconds : null,
      currentLabel: "Waiting to start",
      requestedAt,
      updatedAt: requestedAt,
    })
    .returning({ id: transcriptionJobs.id });

  await db.insert(transcriptionJobChunks).values(
    chunks.map((chunk, index) => ({
      jobId: job.id,
      segmentId: chunk.segmentId,
      position: index + 1,
      label: chunk.label,
      startsAtSeconds: chunk.startsAtSeconds,
      endsAtSeconds: chunk.endsAtSeconds,
      status: "pending" as const,
      updatedAt: requestedAt,
    })),
  );

  return {
    jobId: job.id,
    mode,
    selectedSegmentCount: selectedSegments.length,
    shouldStart: true,
    totalChunks: chunks.length,
    transcriptId,
  };
}

async function loadJob(jobId: string) {
  const db = createDatabaseClient();
  const [job] = await db
    .select()
    .from(transcriptionJobs)
    .where(eq(transcriptionJobs.id, jobId));

  if (!job) {
    throw new TranscriptionRequestError("Transcription job not found.", 404);
  }

  return job;
}

async function loadJobChunks(jobId: string) {
  const db = createDatabaseClient();
  return db
    .select()
    .from(transcriptionJobChunks)
    .where(eq(transcriptionJobChunks.jobId, jobId))
    .orderBy(asc(transcriptionJobChunks.position));
}

async function updateTranscriptWithChunkProgress(job: TranscriptionJobRow) {
  if (!job.transcriptId) return;

  const db = createDatabaseClient();
  const chunks = await loadJobChunks(job.id);
  const text = renderTranscriptionText({ chunks });

  if (!text) return;

  await db
    .update(transcripts)
    .set({
      errorMessage: null,
      model: transcriptionModelLabel(chunks) || null,
      status: "pending",
      text,
    })
    .where(eq(transcripts.id, job.transcriptId));
}

export async function markTranscriptionJobFailed({
  errorMessage,
  jobId,
}: {
  errorMessage: string;
  jobId: string;
}) {
  const db = createDatabaseClient();
  const job = await loadJob(jobId);
  const updatedAt = nowIso();

  await db
    .update(transcriptionJobs)
    .set({
      completedAt: null,
      currentLabel: "Transcription failed",
      errorMessage,
      status: "failed",
      updatedAt,
    })
    .where(eq(transcriptionJobs.id, jobId));

  if (job.transcriptId) {
    await db
      .update(transcripts)
      .set({
        completedAt: null,
        errorMessage,
        status: "failed",
      })
      .where(eq(transcripts.id, job.transcriptId));
  }
}

async function completeChunk({
  chunk,
  filePath,
  job,
}: {
  chunk: TranscriptionJobChunkRow;
  filePath: string;
  job: TranscriptionJobRow;
}) {
  const db = createDatabaseClient();
  const startedAt = nowIso();

  await db
    .update(transcriptionJobChunks)
    .set({
      errorMessage: null,
      startedAt,
      status: "running",
      updatedAt: startedAt,
    })
    .where(eq(transcriptionJobChunks.id, chunk.id));

  await db
    .update(transcriptionJobs)
    .set({
      currentLabel: chunk.label,
      status: "running",
      updatedAt: startedAt,
    })
    .where(eq(transcriptionJobs.id, job.id));

  const clipped = await clipAudioSegments({
    segments: [
      {
        endsAtSeconds: chunk.endsAtSeconds,
        id: chunk.id,
        startsAtSeconds: chunk.startsAtSeconds,
        title: chunk.label,
      },
    ],
    sourceFilePath: filePath,
  });

  try {
    const transcription = await transcribeAudioFile({
      filePath: clipped.clippedSegments[0].filePath,
    });
    const completedAt = nowIso();

    await db
      .update(transcriptionJobChunks)
      .set({
        completedAt,
        durationMs: Math.max(transcription.durationMs, 1),
        errorMessage: null,
        model: transcription.model,
        status: "complete",
        text: transcription.text,
        updatedAt: completedAt,
      })
      .where(eq(transcriptionJobChunks.id, chunk.id));

    const completeChunks = await db
      .select({ id: transcriptionJobChunks.id })
      .from(transcriptionJobChunks)
      .where(
        and(
          eq(transcriptionJobChunks.jobId, job.id),
          eq(transcriptionJobChunks.status, "complete"),
        ),
      );

    await db
      .update(transcriptionJobs)
      .set({
        completedChunks: completeChunks.length,
        updatedAt: completedAt,
      })
      .where(eq(transcriptionJobs.id, job.id));
  } finally {
    await clipped.cleanup();
  }
}

async function segmentTranscriptionsFromChunks({
  chunks,
  lessonId,
  recordingId,
}: {
  chunks: TranscriptionJobChunkRow[];
  lessonId: string;
  recordingId: string;
}): Promise<TranscribedLessonSegment[]> {
  const db = createDatabaseClient();
  const segmentIds = Array.from(
    new Set(chunks.map((chunk) => chunk.segmentId).filter(Boolean)),
  ) as string[];

  if (segmentIds.length === 0) return [];

  const segments = await db
    .select()
    .from(lessonSegments)
    .where(inArray(lessonSegments.id, segmentIds))
    .orderBy(asc(lessonSegments.startsAtSeconds));

  return segments
    .filter(
      (segment) =>
        segment.lessonId === lessonId && segment.recordingId === recordingId,
    )
    .map((segment) => {
      const segmentChunks = chunks.filter(
        (chunk) => chunk.segmentId === segment.id,
      );

      return {
        endsAtSeconds: segment.endsAtSeconds,
        model: transcriptionModelLabel(segmentChunks),
        notes: segment.notes ?? "",
        segmentId: segment.id,
        startsAtSeconds: segment.startsAtSeconds,
        title: segment.title,
        transcriptText: segmentChunks.map((chunk) => chunk.text ?? "").join("\n\n"),
      };
    });
}

async function finalizeCompletedJob(job: TranscriptionJobRow) {
  const db = createDatabaseClient();
  const completedAt = nowIso();
  const chunks = await loadJobChunks(job.id);
  const transcriptionText = renderTranscriptionText({ chunks });
  const transcriptionModel = transcriptionModelLabel(chunks);
  const transcriptId = job.transcriptId;

  if (!transcriptId) {
    throw new Error("Transcription job is missing a transcript target.");
  }

  await db
    .update(transcripts)
    .set({
      completedAt,
      errorMessage: null,
      language: "en",
      model: transcriptionModel,
      status: "complete",
      text: transcriptionText,
    })
    .where(eq(transcripts.id, transcriptId));

  await db
    .update(lessons)
    .set({ status: "transcribed", updatedAt: completedAt })
    .where(eq(lessons.id, job.lessonId));

  let practiceCandidateCount = 0;
  let summaryBulletCount = 0;
  let analysisStatus: "complete" | "failed" = "complete";

  try {
    if (job.mode === "selected_segments") {
      const segmentTranscriptions = await segmentTranscriptionsFromChunks({
        chunks,
        lessonId: job.lessonId,
        recordingId: job.recordingId,
      });

      await saveRawSegmentTranscripts({
        completedAt,
        lessonId: job.lessonId,
        recordingId: job.recordingId,
        requestedAt: job.requestedAt,
        segments: segmentTranscriptions,
        transcriptId,
      });

      const analysis = await analyzeLessonSegments({
        segments: segmentTranscriptions,
      });
      await saveSegmentedLessonAnalysis({
        analysis,
        lessonId: job.lessonId,
        transcriptId,
      });
      practiceCandidateCount = analysis.practiceCandidates.length;
      summaryBulletCount = analysis.summaryBullets.length;

      await Promise.all(
        segmentTranscriptions.map((segment) =>
          db
            .update(lessonSegments)
            .set({ status: "transcribed", updatedAt: completedAt })
            .where(eq(lessonSegments.id, segment.segmentId)),
        ),
      );
    } else {
      const analysis = await analyzeLessonTranscript({
        transcriptText: transcriptionText,
      });
      await saveLessonAnalysis({
        analysis,
        lessonId: job.lessonId,
        transcriptId,
      });
      practiceCandidateCount = analysis.practiceCandidates.length;
      summaryBulletCount = analysis.summaryBullets.length;
    }
  } catch (error) {
    analysisStatus = "failed";
    console.error("Lesson analysis failed", error);
  }

  await db
    .update(transcriptionJobs)
    .set({
      completedAt,
      completedChunks: chunks.length,
      currentLabel:
        analysisStatus === "complete"
          ? "Transcription complete"
          : "Transcript saved; lesson analysis needs another pass",
      errorMessage:
        analysisStatus === "complete"
          ? null
          : "Transcript was saved, but lesson summary/practice extraction failed.",
      status: "complete",
      updatedAt: completedAt,
    })
    .where(eq(transcriptionJobs.id, job.id));

  return {
    analysisStatus,
    practiceCandidateCount,
    summaryBulletCount,
    transcriptionModel,
    transcriptionText,
  };
}

export async function runLessonTranscriptionJob({ jobId }: { jobId: string }) {
  let job = await loadJob(jobId);

  if (job.status === "complete") {
    return { status: "already_complete" as const };
  }

  const db = createDatabaseClient();
  const [recording] = await db
    .select()
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.id, job.recordingId),
        eq(lessonRecordings.lessonId, job.lessonId),
      ),
    );

  if (!recording) {
    await markTranscriptionJobFailed({
      errorMessage: "Recording not found.",
      jobId,
    });
    return { status: "failed" as const };
  }

  const startedAt = nowIso();
  await db
    .update(transcriptionJobs)
    .set({
      currentLabel: "Preparing recording",
      errorMessage: null,
      startedAt: job.startedAt ?? startedAt,
      status: "running",
      updatedAt: startedAt,
    })
    .where(eq(transcriptionJobs.id, jobId));

  const audioFile = await materializeLessonAudioFile({
    storageBucket: recording.storageBucket,
    storagePath: recording.storagePath,
  });

  if (!audioFile) {
    await markTranscriptionJobFailed({
      errorMessage: "Recording audio is not available for transcription.",
      jobId,
    });
    return { status: "failed" as const };
  }

  try {
    const chunks = await loadJobChunks(jobId);

    for (const chunk of chunks.filter((item) => item.status !== "complete")) {
      try {
        job = await loadJob(jobId);
        await completeChunk({ chunk, filePath: audioFile.filePath, job });
        job = await loadJob(jobId);
        await updateTranscriptWithChunkProgress(job);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Transcription failed.";
        const failedAt = nowIso();

        await db
          .update(transcriptionJobChunks)
          .set({
            errorMessage,
            status: "failed",
            updatedAt: failedAt,
          })
          .where(eq(transcriptionJobChunks.id, chunk.id));

        await markTranscriptionJobFailed({ errorMessage, jobId });
        throw error;
      }
    }

    job = await loadJob(jobId);
    return finalizeCompletedJob(job);
  } finally {
    await audioFile.cleanup();
  }
}
