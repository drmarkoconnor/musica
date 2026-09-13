import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { createLessonRecordingMetadata, type LessonRecordingMetadataInput } from "../src/lib/server/lesson-recording-metadata";
import { createPracticeFromLearningPoint, updateLearningPoint } from "../src/lib/server/learning-points";
import { createLessonTranscriptionJob, markTranscriptionJobFailed, retryLessonAnalysis, runLessonTranscriptionJob } from "../src/lib/server/transcription-job";
import { createIsolatedPostgres, type IsolatedPostgres } from "./helpers/isolated-postgres";

const metadata: LessonRecordingMetadataInput = {
  durationSeconds: 60 * 60 + 1,
  lessonDate: "2026-09-13",
  recordedAt: "2026-09-13T14:00:00.000Z",
  summary: "Uploaded piano lesson",
  teacher: "Leo",
  title: "Piano lesson — September",
};

describe("actual migrations and application SQL in isolated PostgreSQL", { concurrency: false }, () => {
  let database: IsolatedPostgres;
  before(async () => { database = await createIsolatedPostgres(); });
  after(async () => { await database?.close(); });
  beforeEach(async () => { await database.reset(); });

  function uploadInput() {
    const ids = { lessonId: randomUUID(), recordingId: randomUUID() };
    return { metadata, ids, storedAudio: { storageBucket: "isolated-audio", storagePath: `${ids.recordingId}.m4a.chunks.json` } };
  }

  async function cachedAnalysisJob() {
    const input = uploadInput();
    input.metadata = { ...metadata, durationSeconds: 120 };
    const saved = await createLessonRecordingMetadata(input);
    const job = await createLessonTranscriptionJob({ ...saved, includeFullRecording: true });
    const { rows: chunks } = await database.postgres.query<{ id: string }>(
      "update transcription_job_chunks set status = 'complete', text = 'Keep the bass steady and leave a gap after the melody.', model = 'fixture-transcript', completed_at = now() where job_id = $1 returning id", [job.jobId],
    );
    const analysisResult = JSON.stringify({
      overallSummary: "Keep a steady bass and allow the melody space.",
      summaryBullets: [{ title: "Leave space", body: "Let the melody breathe before adding a fill.", kind: "teaching", evidenceId: chunks[0].id }],
      practiceCandidates: [{ title: "Steady bass", body: "Practise the bass alone before adding the melody.", kind: "practice", evidenceId: chunks[0].id, suggestedPracticeNote: "Play eight bars of bass with a metronome." }],
    });
    await database.postgres.query("update transcription_jobs set status = 'failed', completed_chunks = total_chunks, analysis_status = 'failed', analysis_result = $2 where id = $1", [job.jobId, analysisResult]);
    return { ...saved, jobId: job.jobId, chunkId: chunks[0].id, analysisResult };
  }

  async function insertPoint(lessonId: string, recordingId: string, extra: { analysisRunId?: string; sourceKey?: string; status?: string; practiceAction?: string } = {}) {
    const { rows } = await database.postgres.query<{ id: string }>(
      "insert into learning_points (lesson_id, recording_id, analysis_run_id, source_key, title, body, starts_at_seconds, ends_at_seconds, status, practice_action) values ($1,$2,$3,$4,'Original point','Original explanation',0,120,$5,$6) returning id",
      [lessonId, recordingId, extra.analysisRunId ?? null, extra.sourceKey ?? randomUUID(), extra.status ?? "candidate", extra.practiceAction ?? null],
    );
    return rows[0].id;
  }

  it("applies the complete checked-in migration journal, including pgcrypto", async () => {
    assert.ok(database.migrationFiles.length >= 8);
    const { rows } = await database.postgres.query<{ extname: string }>("select extname from pg_extension where extname = 'pgcrypto'");
    assert.equal(rows[0]?.extname, "pgcrypto");
    const created = await createLessonRecordingMetadata(uploadInput());
    assert.match(created.recordingId, /^[a-f0-9-]{36}$/);
    const { rows: recordings } = await database.postgres.query<{ duration_seconds: number; title: string }>("select duration_seconds, title from lesson_recordings");
    assert.deepEqual(recordings, [{ duration_seconds: 3601, title: metadata.title }]);
  });

  it("retries a lost recording-insert response without duplicating the lesson or recording", async () => {
    const input = uploadInput();
    database.failNextQuery({ match: /insert into "lesson_recordings"/, when: "after", message: "Injected lost response after committed recording insert" });
    await assert.rejects(createLessonRecordingMetadata(input));
    const recovered = await createLessonRecordingMetadata(input);
    assert.deepEqual(recovered, input.ids);
    const { rows } = await database.postgres.query<{ lessons: number; recordings: number }>("select (select count(*)::integer from lessons) as lessons, (select count(*)::integer from lesson_recordings) as recordings");
    assert.deepEqual(rows, [{ lessons: 1, recordings: 1 }]);
  });

  it("recovers a saved lesson after recording insertion fails", async () => {
    const input = uploadInput();
    database.failNextQuery({ match: /insert into "lesson_recordings"/, when: "before", message: "Injected recording insert failure" });
    await assert.rejects(createLessonRecordingMetadata(input));
    const partial = await database.postgres.query<{ lessons: number; recordings: number }>("select (select count(*)::integer from lessons) as lessons, (select count(*)::integer from lesson_recordings) as recordings");
    assert.deepEqual(partial.rows, [{ lessons: 1, recordings: 0 }]);
    assert.deepEqual(await createLessonRecordingMetadata(input), input.ids);
    const restored = await database.postgres.query<{ lessons: number; recordings: number }>("select (select count(*)::integer from lessons) as lessons, (select count(*)::integer from lesson_recordings) as recordings");
    assert.deepEqual(restored.rows, [{ lessons: 1, recordings: 1 }]);
  });

  it("interleaved completion requests return the same canonical recording", async () => {
    const input = uploadInput();
    const results = await Promise.all(Array.from({ length: 4 }, () => createLessonRecordingMetadata(input)));
    assert.deepEqual(results, Array(4).fill(input.ids));
    const { rows } = await database.postgres.query<{ lessons: number; recordings: number }>("select (select count(*)::integer from lessons) as lessons, (select count(*)::integer from lesson_recordings) as recordings");
    assert.deepEqual(rows, [{ lessons: 1, recordings: 1 }]);
  });

  it("rejects reuse of a recording ID for different audio without changing existing metadata", async () => {
    const input = uploadInput();
    await createLessonRecordingMetadata(input);
    await assert.rejects(createLessonRecordingMetadata({ ...input, storedAudio: { ...input.storedAudio, storagePath: "unrelated-audio.mp3" } }), /different audio/);
    const { rows } = await database.postgres.query<{ storage_path: string }>("select storage_path from lesson_recordings");
    assert.deepEqual(rows, [{ storage_path: input.storedAudio.storagePath }]);
  });

  it("adds audio to an existing lesson without creating a fallback lesson on retry", async () => {
    const firstInput = uploadInput();
    const first = await createLessonRecordingMetadata(firstInput);
    const secondInput = uploadInput();
    secondInput.metadata = { ...metadata, lessonId: first.lessonId };
    const expected = { lessonId: first.lessonId, recordingId: secondInput.ids.recordingId };
    assert.deepEqual(await createLessonRecordingMetadata(secondInput), expected);
    assert.deepEqual(await createLessonRecordingMetadata(secondInput), expected);
    const { rows } = await database.postgres.query<{ lessons: number; recordings: number }>("select (select count(*)::integer from lessons) as lessons, (select count(*)::integer from lesson_recordings) as recordings");
    assert.deepEqual(rows, [{ lessons: 1, recordings: 2 }]);
  });

  it("keeping and editing a teaching point preserves evidence and does not create homework", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    const pointId = await insertPoint(saved.lessonId, saved.recordingId);
    const updated = await updateLearningPoint(pointId, { title: "Mark's wording", body: "Leave a deliberate rest.", status: "kept" });
    assert.equal(updated.title, "Mark's wording");
    assert.equal(updated.status, "kept");
    assert.equal(updated.startsAtSeconds, 0);
    assert.equal(updated.endsAtSeconds, 120);
    const tasks = await database.postgres.query<{ count: number }>("select count(*)::integer as count from practice_tasks");
    assert.equal(tasks.rows[0].count, 0);
  });

  it("creates and links one practice task on repeated or interleaved clicks", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    const pointId = await insertPoint(saved.lessonId, saved.recordingId, { practiceAction: "Play eight bars slowly." });
    const results = await Promise.all(Array.from({ length: 3 }, () => createPracticeFromLearningPoint(pointId, {})));
    assert.equal(new Set(results.map((result) => result.practiceTaskId)).size, 1);
    const { rows } = await database.postgres.query<{ body: string; status: string; practice_task_id: string; task_body: string; task_count: number }>(
      "select p.body, p.status, p.practice_task_id, t.body as task_body, (select count(*)::integer from practice_tasks) as task_count from learning_points p join practice_tasks t on t.id = p.practice_task_id where p.id = $1", [pointId],
    );
    assert.deepEqual(rows, [{ body: "Original explanation", status: "kept", practice_task_id: results[0].practiceTaskId, task_body: "Play eight bars slowly.", task_count: 1 }]);
  });

  it("does not create or link an empty practice task", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    const pointId = await insertPoint(saved.lessonId, saved.recordingId);
    await assert.rejects(createPracticeFromLearningPoint(pointId, {}), /Add a practice action/);
    const { rows } = await database.postgres.query<{ status: string; practice_task_id: string | null; task_count: number }>("select status, practice_task_id, (select count(*)::integer from practice_tasks) as task_count from learning_points where id = $1", [pointId]);
    assert.deepEqual(rows, [{ status: "candidate", practice_task_id: null, task_count: 0 }]);
  });

  it("analyses 60:01 as the full lesson even when selected clips already exist", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    await database.postgres.query("insert into lesson_segments (lesson_id, recording_id, title, starts_at_seconds, ends_at_seconds) values ($1,$2,'Earlier selected clip',30,60)", [saved.lessonId, saved.recordingId]);
    const job = await createLessonTranscriptionJob(saved);
    assert.equal(job.mode, "full_recording");
    assert.equal(job.totalChunks, 21);
    assert.equal(job.selectedSegmentCount, 0);
    const { rows } = await database.postgres.query<{ first: number; last: number; coverage: number }>("select min(starts_at_seconds) as first, max(ends_at_seconds) as last, sum(ends_at_seconds - starts_at_seconds)::integer as coverage from transcription_job_chunks where job_id = $1", [job.jobId]);
    assert.deepEqual(rows, [{ first: 0, last: 3601, coverage: 3601 }]);
    assert.equal((await createLessonTranscriptionJob(saved)).jobId, job.jobId);
  });

  it("reuses identical selected clips but creates a new job when their range moves", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    const { rows: clips } = await database.postgres.query<{ id: string }>("insert into lesson_segments (lesson_id, recording_id, title, starts_at_seconds, ends_at_seconds) values ($1,$2,'Selected clip',30,60) returning id", [saved.lessonId, saved.recordingId]);
    const original = await createLessonTranscriptionJob({ ...saved, includeFullRecording: false });
    assert.equal(original.mode, "selected_segments");
    assert.equal((await createLessonTranscriptionJob({ ...saved, includeFullRecording: false })).jobId, original.jobId);
    await database.postgres.query("update lesson_segments set starts_at_seconds=45, ends_at_seconds=75 where id=$1", [clips[0].id]);
    const moved = await createLessonTranscriptionJob({ ...saved, includeFullRecording: false });
    assert.notEqual(moved.jobId, original.jobId);
    const { rows } = await database.postgres.query<{ starts_at_seconds: number; ends_at_seconds: number }>("select starts_at_seconds, ends_at_seconds from transcription_job_chunks where job_id=$1", [original.jobId]);
    assert.deepEqual(rows, [{ starts_at_seconds: 30, ends_at_seconds: 60 }]);
  });

  it("retries the requested selected-clip job even after a newer whole-lesson job exists", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    await database.postgres.query("insert into lesson_segments (lesson_id,recording_id,title,starts_at_seconds,ends_at_seconds) values ($1,$2,'Selected clip',30,60)", [saved.lessonId, saved.recordingId]);
    const selected = await createLessonTranscriptionJob({ ...saved, includeFullRecording: false });
    await database.postgres.query("update transcription_job_chunks set status='complete',text='A retained transcript' where job_id=$1", [selected.jobId]);
    await database.postgres.query("update transcription_jobs set status='failed',completed_chunks=total_chunks,analysis_status='failed' where id=$1", [selected.jobId]);
    const whole = await createLessonTranscriptionJob({ ...saved, includeFullRecording: true });
    const retry = await retryLessonAnalysis({ ...saved, jobId: selected.jobId });
    assert.equal(retry.jobId, selected.jobId);
    assert.equal(retry.mode, "selected_segments");
    assert.notEqual(retry.jobId, whole.jobId);
    const { rows } = await database.postgres.query<{ status: string; text: string }>("select status,text from transcription_job_chunks where job_id=$1", [selected.jobId]);
    assert.deepEqual(rows, [{ status: "complete", text: "A retained transcript" }]);
    await assert.rejects(retryLessonAnalysis({ ...saved, jobId: selected.jobId, recordingId: randomUUID() }), /does not belong/);
  });

  it("recovers a failed initial selected-clip plan write without leaving an unprocessable job", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    await database.postgres.query("insert into lesson_segments (lesson_id,recording_id,title,starts_at_seconds,ends_at_seconds) values ($1,$2,'Selected clip',30,60)", [saved.lessonId, saved.recordingId]);
    database.failNextQuery({ match: /insert into "transcription_job_chunks"/, when: "before", message: "Injected failure while saving initial clip plan" });
    await assert.rejects(createLessonTranscriptionJob({ ...saved, includeFullRecording: false }));
    const recovered = await createLessonTranscriptionJob({ ...saved, includeFullRecording: false });
    const { rows: chunks } = await database.postgres.query<{ starts_at_seconds: number; ends_at_seconds: number }>("select starts_at_seconds,ends_at_seconds from transcription_job_chunks where job_id=$1", [recovered.jobId]);
    assert.deepEqual(chunks, [{ starts_at_seconds: 30, ends_at_seconds: 60 }]);
    const { rows: jobs } = await database.postgres.query<{ count: number }>("select count(*)::integer as count from transcription_jobs");
    assert.equal(jobs[0].count, 1);
  });

  it("interleaved requests for the same lesson share one job and one complete clip plan", async () => {
    const saved = await createLessonRecordingMetadata(uploadInput());
    const results = await Promise.all(Array.from({ length: 3 }, () => createLessonTranscriptionJob(saved)));
    assert.equal(new Set(results.map((result) => result.jobId)).size, 1);
    const { rows } = await database.postgres.query<{ jobs: number; chunks: number; coverage: number }>("select (select count(*)::integer from transcription_jobs) as jobs, count(*)::integer as chunks, sum(ends_at_seconds-starts_at_seconds)::integer as coverage from transcription_job_chunks");
    assert.deepEqual(rows, [{ jobs: 1, chunks: 21, coverage: 3601 }]);
  });

  it("publishes cached analysis while preserving kept edits and unrelated candidates", async () => {
    const seeded = await cachedAnalysisJob();
    const keptId = await insertPoint(seeded.lessonId, seeded.recordingId, { analysisRunId: seeded.jobId, sourceKey: "teaching-0", status: "kept" });
    await updateLearningPoint(keptId, { title: "My edited title", body: "My edited teaching explanation" });
    const other = await createLessonRecordingMetadata(uploadInput());
    const unrelatedId = await insertPoint(other.lessonId, other.recordingId);
    const legacyId = randomUUID();
    await database.postgres.query("insert into lesson_extracts (id,lesson_id,title,body,starts_at_seconds,ends_at_seconds,status) values ($1,$2,'Legacy candidate','Keep me',0,10,'candidate')", [legacyId, seeded.lessonId]);
    const outcome = await runLessonTranscriptionJob({ jobId: seeded.jobId });
    assert.equal(outcome.status, "complete");
    const { rows: preserved } = await database.postgres.query<{ id: string; title: string; body: string; status: string }>("select id,title,body,status from learning_points where id in ($1,$2) order by title", [keptId, unrelatedId]);
    assert.deepEqual(preserved, [
      { id: keptId, title: "My edited title", body: "My edited teaching explanation", status: "kept" },
      { id: unrelatedId, title: "Original point", body: "Original explanation", status: "candidate" },
    ]);
    const { rows: legacy } = await database.postgres.query<{ body: string }>("select body from lesson_extracts where id=$1", [legacyId]);
    assert.deepEqual(legacy, [{ body: "Keep me" }]);
    const { rows: points } = await database.postgres.query<{ source_key: string; starts_at_seconds: number; ends_at_seconds: number; evidence_precision: string }>("select source_key,starts_at_seconds,ends_at_seconds,evidence_precision from learning_points where analysis_run_id=$1 order by source_key", [seeded.jobId]);
    assert.deepEqual(points, [
      { source_key: "practice-0", starts_at_seconds: 0, ends_at_seconds: 120, evidence_precision: "approximate" },
      { source_key: "teaching-0", starts_at_seconds: 0, ends_at_seconds: 120, evidence_precision: "approximate" },
    ]);
    assert.equal((await runLessonTranscriptionJob({ jobId: seeded.jobId })).status, "already_running_or_complete");
  });

  it("recovers a failed publication from cached analysis without re-transcribing", async () => {
    const seeded = await cachedAnalysisJob();
    database.failNextQuery({ match: /insert into "learning_points"/, when: "before", message: "Injected publication failure" });
    await assert.rejects(runLessonTranscriptionJob({ jobId: seeded.jobId }));
    const { rows: paused } = await database.postgres.query<{ status: string; analysis_status: string; analysis_result: string; transcript_status: string }>("select j.status,j.analysis_status,j.analysis_result,t.status as transcript_status from transcription_jobs j join transcripts t on t.id=j.transcript_id where j.id=$1", [seeded.jobId]);
    assert.equal(paused[0].status, "failed");
    assert.equal(paused[0].analysis_status, "failed");
    assert.ok(paused[0].analysis_result.includes("Leave space"));
    assert.equal(paused[0].transcript_status, "complete");
    const retry = await retryLessonAnalysis(seeded);
    assert.equal(retry.jobId, seeded.jobId);
    assert.equal(retry.shouldStart, true);
    assert.equal((await runLessonTranscriptionJob({ jobId: seeded.jobId })).status, "complete");
    const { rows: counts } = await database.postgres.query<{ points: number; extracts: number; transcripts: number }>("select (select count(*)::integer from learning_points) as points,(select count(*)::integer from lesson_extracts) as extracts,(select count(*)::integer from transcripts) as transcripts");
    assert.deepEqual(counts, [{ points: 2, extracts: 1, transcripts: 1 }]);
    assert.equal(database.queries.filter((query) => /update "transcription_job_chunks"/.test(query.query)).length, 0);
  });

  it("only one cached worker claims a job and stale failure signals cannot clobber it", async () => {
    const seeded = await cachedAnalysisJob();
    const activeToken = randomUUID();
    await database.postgres.query("update transcription_jobs set status='running',lease_token=$2,lease_expires_at=now()+interval '5 minutes' where id=$1", [seeded.jobId, activeToken]);
    assert.equal((await runLessonTranscriptionJob({ jobId: seeded.jobId })).status, "already_running_or_complete");
    await markTranscriptionJobFailed({ jobId: seeded.jobId, errorMessage: "Late dispatch failure" });
    await markTranscriptionJobFailed({ jobId: seeded.jobId, leaseToken: randomUUID(), errorMessage: "Old worker failure" });
    const { rows: active } = await database.postgres.query<{ status: string; lease_token: string }>("select status,lease_token from transcription_jobs where id=$1", [seeded.jobId]);
    assert.deepEqual(active, [{ status: "running", lease_token: activeToken }]);
    await database.postgres.query("update transcription_jobs set lease_expires_at=now()-interval '1 second' where id=$1", [seeded.jobId]);
    const outcomes = await Promise.all([runLessonTranscriptionJob({ jobId: seeded.jobId }), runLessonTranscriptionJob({ jobId: seeded.jobId })]);
    assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), ["already_running_or_complete", "complete"]);
    await markTranscriptionJobFailed({ jobId: seeded.jobId, errorMessage: "Failure arriving after completion" });
    const { rows: done } = await database.postgres.query<{ status: string; lease_token: string | null }>("select status,lease_token from transcription_jobs where id=$1", [seeded.jobId]);
    assert.deepEqual(done, [{ status: "complete", lease_token: null }]);
  });
});
