import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { shouldUseNetlifyAudioStorage } from "../src/lib/server/env";

const environmentKeys = [
  "PRACTICE_LOOP_AUDIO_STORAGE", "NETLIFY", "SITE_ID", "NETLIFY_SITE_ID",
  "NETLIFY_BLOBS_TOKEN", "NETLIFY_AUTH_TOKEN", "NETLIFY_TOKEN",
  "LOCAL_LESSON_AUDIO_DIRECTORY",
];
const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));
const directory = await mkdtemp(path.join(os.tmpdir(), "music-storage-selection-"));
process.env.LOCAL_LESSON_AUDIO_DIRECTORY = directory;
// These values represent credentials found in a Mac's .env.local. They must
// neither trigger a remote store nor ever be sent to an external endpoint.
process.env.SITE_ID = "local-test-site";
process.env.NETLIFY_SITE_ID = "local-test-site";
process.env.NETLIFY_BLOBS_TOKEN = "local-test-token";
process.env.NETLIFY_AUTH_TOKEN = "local-test-token";
process.env.NETLIFY_TOKEN = "local-test-token";
delete process.env.NETLIFY;
delete process.env.PRACTICE_LOOP_AUDIO_STORAGE;
const storage = await import("../src/lib/server/lesson-audio-storage");
const sessions = await import("../src/lib/server/lesson-recording-upload-sessions");
const practiceStorage = await import("../src/lib/server/practice-audio-storage");
const originalFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error("Network access is forbidden in storage selection regression tests.");
};

async function verifyLocalWrites() {
  assert.equal(shouldUseNetlifyAudioStorage(), false);
  assert.equal(storage.usesNetlifyLessonAudio(), false);
  const audio = Buffer.from("Recording bytes must stay local despite available Netlify credentials.");
  const stored = await storage.saveLessonAudio({ buffer: audio, contentType: "audio/mp4", fileName: `${randomUUID()}.m4a` });
  assert.equal(stored.storageBucket, "local-lesson-audio");
  assert.deepEqual(await storage.readLessonAudioBuffer(stored), audio);
  await storage.deleteLessonAudio(stored);

  const session = await sessions.createLessonRecordingUploadSession({
    contentType: "audio/mp4", extension: "m4a",
    metadata: { lessonDate: "2026-09-13", recordedAt: "2026-09-13T12:00:00Z", summary: "Lesson", teacher: "Leo", title: "Local lesson" },
    file: { fingerprint: "b".repeat(64), totalBytes: audio.length, chunkBytes: sessions.MAX_UPLOAD_CHUNK_BYTES },
  });
  const receipt = await sessions.saveLessonRecordingUploadChunk({ buffer: audio, chunkIndex: 0, contentType: "audio/mp4", uploadId: session.id, sha256: createHash("sha256").update(audio).digest("hex") });
  assert.equal((await sessions.getLessonRecordingUploadStatus(session.id))?.acknowledgedChunks.length, 1);
  const completeInput = { uploadId: session.id, chunkCount: 1, totalBytes: audio.length, integrityDigest: storage.audioIntegrityDigest([receipt]), durationSeconds: 5400 };
  const completed = await sessions.completeLessonRecordingUploadSession(completeInput);
  assert.equal(completed.storedAudio.storageBucket, "local-lesson-audio");
  assert.deepEqual((await sessions.completeLessonRecordingUploadSession(completeInput)).storedAudio, completed.storedAudio);
  assert.deepEqual(await storage.readLessonAudioBuffer(completed.storedAudio), audio);
  await storage.deleteLessonAudio(completed.storedAudio);

  const practice = await practiceStorage.savePracticeAudio({ buffer: audio, contentType: "audio/mp4", fileName: `${randomUUID()}.m4a` });
  assert.equal(practice.storageBucket, "local-practice-audio");
  assert.deepEqual(await practiceStorage.readPracticeAudioBuffer(practice), audio);
  await practiceStorage.deletePracticeAudio(practice);
  assert.equal(networkAttempts, 0);
}

test("ordinary local development with Netlify credentials keeps lesson, resumable upload and practice audio local", async () => {
  delete process.env.PRACTICE_LOOP_AUDIO_STORAGE;
  delete process.env.NETLIFY;
  await verifyLocalWrites();
});

test("explicit local storage overrides the Netlify runtime for every audio writer", async () => {
  process.env.PRACTICE_LOOP_AUDIO_STORAGE = "local";
  process.env.NETLIFY = "true";
  await verifyLocalWrites();
});

test("explicit remote selection and the Netlify runtime select remote references without credentials deciding", () => {
  delete process.env.NETLIFY;
  process.env.PRACTICE_LOOP_AUDIO_STORAGE = "netlify-blobs";
  assert.equal(shouldUseNetlifyAudioStorage(), true);
  assert.equal(storage.lessonAudioReference("lesson.m4a").storageBucket, "netlify-blobs");

  delete process.env.PRACTICE_LOOP_AUDIO_STORAGE;
  process.env.NETLIFY = "true";
  assert.equal(storage.usesNetlifyLessonAudio(), true);
  assert.equal(storage.lessonAudioReference("lesson.m4a").storageBucket, "netlify-blobs");

  process.env.NETLIFY = "false";
  assert.equal(storage.usesNetlifyLessonAudio(), false);
  assert.equal(storage.lessonAudioReference("lesson.m4a").storageBucket, "local-lesson-audio");
  assert.equal(networkAttempts, 0);
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(directory, { recursive: true, force: true });
});
