import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const directory = await mkdtemp(path.join(os.tmpdir(), "music-upload-test-"));
process.env.LOCAL_LESSON_AUDIO_DIRECTORY = directory;
delete process.env.NETLIFY;
delete process.env.SITE_ID;
delete process.env.NETLIFY_SITE_ID;
process.env.PRACTICE_LOOP_AUDIO_STORAGE = "local";
const storage = await import("../src/lib/server/lesson-audio-storage");
const sessions = await import("../src/lib/server/lesson-recording-upload-sessions");
const { parseRangeHeader } = await import("../src/app/api/lesson-recordings/[recordingId]/file/route");
const digest = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
const metadata = { lessonDate: "2026-09-13", recordedAt: "2026-09-13T12:00:00.000Z", summary: "Lesson", teacher: "Leo", title: "Full lesson" };

test("resumable immutable chunks preserve exact bytes, including boundary seeks and retry after metadata failure", async () => {
  const buffers = [Buffer.alloc(sessions.MAX_UPLOAD_CHUNK_BYTES, 17), Buffer.alloc(sessions.MAX_UPLOAD_CHUNK_BYTES, 83), Buffer.from("final-M4A-container-metadata")];
  const totalBytes = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const manifest = await sessions.createLessonRecordingUploadSession({ contentType: "audio/mp4", extension: "m4a", metadata, file: { fingerprint: "a".repeat(64), totalBytes, chunkBytes: sessions.MAX_UPLOAD_CHUNK_BYTES } });
  const receipts = [];
  for (let chunkIndex = 0; chunkIndex < buffers.length; chunkIndex++) {
    const buffer = buffers[chunkIndex];
    receipts.push(await sessions.saveLessonRecordingUploadChunk({ buffer, chunkIndex, contentType: "audio/mp4", uploadId: manifest.id, sha256: digest(buffer) }));
  }
  const lastReceipt = receipts[2];
  assert.deepEqual(await sessions.saveLessonRecordingUploadChunk({ buffer: buffers[2], chunkIndex: 2, contentType: "audio/mp4", uploadId: manifest.id, sha256: digest(buffers[2]) }), lastReceipt);
  await assert.rejects(sessions.saveLessonRecordingUploadChunk({ buffer: Buffer.alloc(buffers[2].length, 1), chunkIndex: 2, contentType: "audio/mp4", uploadId: manifest.id, sha256: digest(Buffer.alloc(buffers[2].length, 1)) }), /different bytes/);
  const integrityDigest = storage.audioIntegrityDigest(receipts);
  await assert.rejects(sessions.completeLessonRecordingUploadSession({ uploadId: manifest.id, chunkCount: 3, durationSeconds: 5400, totalBytes: totalBytes - 1, integrityDigest }), /byte count/);
  await assert.rejects(sessions.completeLessonRecordingUploadSession({ uploadId: manifest.id, chunkCount: 3, durationSeconds: 5400, totalBytes, integrityDigest: "f".repeat(64) }), /checksum/);
  const result = await sessions.completeLessonRecordingUploadSession({ uploadId: manifest.id, chunkCount: 3, durationSeconds: 5400, totalBytes, integrityDigest });
  // Simulate failure between audio finalisation and database commit: retry must
  // return the same storage reference while every source chunk remains intact.
  const retry = await sessions.completeLessonRecordingUploadSession({ uploadId: manifest.id, chunkCount: 3, durationSeconds: 5400, totalBytes, integrityDigest });
  assert.deepEqual(retry.storedAudio, result.storedAudio);
  assert.deepEqual((await sessions.getLessonRecordingUploadStatus(manifest.id))?.acknowledgedChunks, receipts);
  const described = await storage.describeLessonAudio(result.storedAudio);
  assert.equal(described?.fileSize, totalBytes);
  assert.equal(described?.contentType, "audio/mp4");
  const boundary = await storage.readLessonAudioRange(result.storedAudio, buffers[0].length - 3, buffers[0].length + 3, described?.manifest);
  assert.deepEqual(boundary, Buffer.from([17, 17, 17, 83, 83, 83, 83]));
  const materialized = await storage.materializeLessonAudioFile(result.storedAudio);
  assert.ok(materialized?.filePath.endsWith(".m4a"));
  assert.deepEqual(await readFile(materialized!.filePath), Buffer.concat(buffers));
  await materialized!.cleanup();
  // A seek within chunk 0 must not fetch chunk 2 at all.
  const finalChunk = described!.manifest!.chunks[2];
  await storage.deleteAudioObject(finalChunk.key);
  assert.deepEqual(await storage.readLessonAudioRange(result.storedAudio, 0, 7, described?.manifest), Buffer.alloc(8, 17));
  await assert.rejects(storage.materializeLessonAudioFile(result.storedAudio), /missing or damaged/);
  await storage.writeAudioObject(finalChunk.key, buffers[2], finalChunk);
  await sessions.markLessonRecordingUploadCompleted(manifest.id, { ...sessions.recordingIdsForUpload(manifest.id), storagePath: result.storedAudio.storagePath });
  assert.equal((await sessions.readCompletedLessonRecordingUpload(manifest.id))?.recordingId, manifest.id);
  await assert.rejects(sessions.deleteLessonRecordingUploadSession({ uploadId: manifest.id }), /Completed audio/);
  await storage.deleteLessonAudio(result.storedAudio);
});

test("missing chunks, oversized transport and wrong checksums are rejected before finalisation", async () => {
  const manifest = await sessions.createLessonRecordingUploadSession({ contentType: "audio/mpeg", extension: "mp3", metadata });
  await assert.rejects(sessions.saveLessonRecordingUploadChunk({ buffer: Buffer.alloc(sessions.MAX_UPLOAD_CHUNK_BYTES + 1), chunkIndex: 0, contentType: "audio/mpeg", uploadId: manifest.id }), /2 MiB/);
  await assert.rejects(sessions.saveLessonRecordingUploadChunk({ buffer: Buffer.from("audio"), chunkIndex: 0, contentType: "audio/mpeg", uploadId: manifest.id, sha256: "a".repeat(64) }), /checksum/);
  await assert.rejects(sessions.completeLessonRecordingUploadSession({ uploadId: manifest.id, chunkCount: 1, durationSeconds: null }), /Missing recording chunk/);
});

test("Range parser handles open, suffix, unsatisfiable and bounded requests", () => {
  assert.deepEqual(parseRangeHeader("bytes=20-", 100), { start: 20, end: 99 });
  assert.deepEqual(parseRangeHeader("bytes=-12", 100), { start: 88, end: 99 });
  assert.deepEqual(parseRangeHeader("bytes=5-10000000", 20000000), { start: 5, end: 5 + storage.MAX_AUDIO_RESPONSE_BYTES - 1 });
  for (const invalid of ["bytes=-0", "bytes=-", "bytes=100-", "bytes=7-4", "bytes=0-1,5-6", "bytes=9007199254740999-"]) assert.equal(parseRangeHeader(invalid, 100), null);
});

test.after(async () => { await rm(directory, { recursive: true, force: true }); });
