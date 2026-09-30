import assert from "node:assert/strict";
import test from "node:test";
import { recordingFileForDraft } from "./recording-upload-file";

const draft = { id: "recording-1", startedAt: "2026-09-13T10:00:00Z", mimeType: "audio/mp4" };

test("recovered recorder fragments preserve exact original bytes and stable file identity", async () => {
  const chunks = [
    { index: 2, blob: new Blob([new Uint8Array([7, 8, 9])]) },
    { index: 0, blob: new Blob([new Uint8Array([1, 2, 3])]) },
    { index: 1, blob: new Blob([new Uint8Array([4, 5, 6])]) },
  ];
  const initial = recordingFileForDraft(chunks, draft);
  const retried = recordingFileForDraft([...chunks].reverse(), draft);
  assert.deepEqual(new Uint8Array(await initial.arrayBuffer()), new Uint8Array([1,2,3,4,5,6,7,8,9]));
  assert.equal(initial.name, retried.name);
  assert.equal(initial.lastModified, retried.lastModified);
  assert.equal(initial.type, "audio/mp4");
  assert.deepEqual(chunks.map(c => c.index), [2, 0, 1]);
});

test("missing, duplicated or empty fragments cannot silently produce a corrupt recording", () => {
  const blob = new Blob(["audio"]);
  for (const chunks of [[], [{index:1,blob}], [{index:0,blob},{index:2,blob}], [{index:0,blob},{index:0,blob}], [{index:0,blob:new Blob([])}]]) {
    assert.throws(() => recordingFileForDraft(chunks,draft), /missing or duplicate/);
  }
});

test("a missing recording tail is rejected using the final or known progress count", () => {
  const chunks = [{ index: 0, blob: new Blob(["first fragment"]) }];
  assert.throws(() => recordingFileForDraft(chunks, { ...draft, finalChunkCount: 2 }), /missing or duplicate/);
  assert.throws(() => recordingFileForDraft(chunks, { ...draft, chunkCount: 2 }), /missing or duplicate/);
  assert.throws(() => recordingFileForDraft(chunks, { ...draft, finalChunkCount: 0 }), /missing or duplicate/);
});

test("older unfinished drafts remain recoverable when progress metadata lags", () => {
  const chunks = [{ index: 0, blob: new Blob(["first"]) }, { index: 1, blob: new Blob(["second"]) }];
  assert.equal(recordingFileForDraft(chunks, draft).size, 11);
  assert.equal(recordingFileForDraft(chunks, { ...draft, chunkCount: 1 }).size, 11);
  assert.equal(recordingFileForDraft(chunks, { ...draft, chunkCount: 2, finalChunkCount: 2 }).size, 11);
});
