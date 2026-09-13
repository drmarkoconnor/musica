import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { uploadLessonAudio, LESSON_AUDIO_CHUNK_BYTES } from "../src/lib/browser/upload-lesson-audio";

test("file uploads use bounded exact bytes and resume acknowledged chunks after a connection failure", async () => {
  const originalFetch = globalThis.fetch;
  const source = new Uint8Array(LESSON_AUDIO_CHUNK_BYTES * 2 + 73);
  for (let i = 0; i < source.length; i++) source[i] = i % 251;
  const file = new File([source], "full-90-minute-lesson.m4a", { type: "audio/mp4", lastModified: 12345 });
  const chunks = new Map<number, { chunkIndex: number; byteLength: number; sha256: string; buffer: Buffer }>();
  let fingerprint = "";
  let interrupted = true;
  let creates = 0;
  let chunkZeroWrites = 0;
  let completeWrites = 0;
  let completed: { lessonId: string; recordingId: string } | undefined;
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    if (address.endsWith("/upload-session")) {
      creates++;
      const body = JSON.parse(String(init?.body));
      fingerprint = body.fingerprint;
      assert.equal(body.chunkBytes, LESSON_AUDIO_CHUNK_BYTES);
      assert.equal(body.totalBytes, source.length);
      return Response.json({ uploadId: "test-upload" });
    }
    if (address.endsWith("/test-upload")) return Response.json({ file: { fingerprint }, acknowledgedChunks: Array.from(chunks.values(), ({ buffer: _buffer, ...receipt }) => receipt), completed });
    if (address.includes("/chunks/")) {
      const index = Number(address.split("/").pop());
      if (index === 1 && interrupted) throw new TypeError("Network offline");
      if (index === 0) chunkZeroWrites++;
      const buffer = Buffer.from(await (init!.body as Blob).arrayBuffer());
      assert.ok(buffer.length <= LESSON_AUDIO_CHUNK_BYTES);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      assert.equal(new Headers(init?.headers).get("x-chunk-sha256"), sha256);
      const receipt = { chunkIndex: index, byteLength: buffer.length, sha256 };
      chunks.set(index, { ...receipt, buffer });
      return Response.json(receipt);
    }
    if (address.endsWith("/complete")) {
      completeWrites++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.durationSeconds, 5400);
      assert.equal(body.chunkCount, 3);
      assert.equal(body.totalBytes, source.length);
      assert.equal(body.integrityDigest, createHash("sha256").update([...chunks.values()].map((chunk) => `${chunk.chunkIndex}:${chunk.byteLength}:${chunk.sha256}\n`).join("")).digest("hex"));
      assert.deepEqual(Buffer.concat([...chunks.values()].map((chunk) => chunk.buffer)), Buffer.from(source));
      completed = { lessonId: "lesson", recordingId: "recording" };
      return Response.json(completed);
    }
    throw new Error(`Unexpected request: ${address}`);
  };
  const options = { metadata: { lessonDate: "2026-09-13", recordedAt: "2026-09-13T12:00:00Z", summary: "", teacher: "Leo", title: "Lesson" }, durationSeconds: 5400 };
  try {
    await assert.rejects(uploadLessonAudio(file, options), /Network offline/);
    assert.equal(chunks.size, 1);
    interrupted = false;
    const result = await uploadLessonAudio(file, options);
    assert.deepEqual(result, { lessonId: "lesson", recordingId: "recording" });
    assert.equal(creates, 1);
    assert.equal(chunkZeroWrites, 1);
    assert.equal(completeWrites, 1);
    assert.deepEqual(await uploadLessonAudio(file, options), result);
    assert.equal(completeWrites, 1, "completed upload must not create another recording");
  } finally { globalThis.fetch = originalFetch; }
});
