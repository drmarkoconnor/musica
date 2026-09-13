import { createHash, randomUUID } from "node:crypto";
import {
  audioIntegrityDigest, deleteAudioObject, readAudioObject,
  readAudioObjectMetadata, saveChunkedLessonAudio, writeAudioObject,
  type AudioChunkReference,
} from "./lesson-audio-storage";
import type { LessonRecordingMetadataInput } from "./lesson-recording-metadata";

export const MAX_UPLOAD_CHUNKS = 2000;
export const MAX_UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_LESSON_AUDIO_BYTES = 512 * 1024 * 1024;
export type UploadFileIdentity = { fingerprint: string; totalBytes: number; chunkBytes: number };
export type LessonRecordingUploadManifest = {
  contentType: string; createdAt: string; extension: string; id: string;
  metadata: Omit<LessonRecordingMetadataInput, "durationSeconds">;
  file?: UploadFileIdentity;
};
export type UploadReceipt = { chunkIndex: number; byteLength: number; sha256: string };
export type UploadResult = { lessonId: string; recordingId: string; storagePath: string };

function uploadPrefix(uploadId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) throw new Error("Invalid upload ID.");
  return `pending-lesson-upload-${uploadId}`;
}
function manifestKey(uploadId: string) { return `${uploadPrefix(uploadId)}-manifest.json`; }
function resultKey(uploadId: string) { return `${uploadPrefix(uploadId)}-result.json`; }
function chunkKey(uploadId: string, chunkIndex: number) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= MAX_UPLOAD_CHUNKS) throw new Error("Invalid chunk index.");
  return `${uploadPrefix(uploadId)}-chunk-${String(chunkIndex).padStart(5, "0")}.part`;
}
function finalAudioName(manifest: LessonRecordingUploadManifest) { return `${manifest.id}.${manifest.extension}.chunks.json`; }
export function recordingIdsForUpload(uploadId: string) {
  // Stable IDs make a database retry safe even if the previous response was lost.
  const hex = createHash("sha256").update(`lesson:${uploadId}`).digest("hex");
  return { recordingId: uploadId, lessonId: `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}` };
}
export async function createLessonRecordingUploadSession({ contentType, extension, metadata, file }: {
  contentType: string; extension: string; metadata: Omit<LessonRecordingMetadataInput, "durationSeconds">; file?: UploadFileIdentity;
}) {
  if (file && (!/^[a-f0-9]{64}$/i.test(file.fingerprint) || !Number.isSafeInteger(file.totalBytes) || file.totalBytes <= 0 || file.totalBytes > MAX_LESSON_AUDIO_BYTES || file.chunkBytes !== MAX_UPLOAD_CHUNK_BYTES)) throw new Error("Invalid file identity or size. The recording limit is 512 MiB.");
  const normalizedExtension = extension.toLowerCase().replace(/^\./, "");
  if (!["aac", "m4a", "mp3", "mp4", "ogg", "wav", "webm"].includes(normalizedExtension)) throw new Error("Unsupported recording format.");
  const manifest: LessonRecordingUploadManifest = {
    contentType: contentType || "application/octet-stream", createdAt: new Date().toISOString(),
    extension: normalizedExtension, id: randomUUID(), metadata, ...(file ? { file } : {}),
  };
  await writeAudioObject(manifestKey(manifest.id), Buffer.from(JSON.stringify(manifest)), { contentType: "application/json" }, true);
  return manifest;
}
export async function readLessonRecordingUploadManifest(uploadId: string) {
  const encoded = await readAudioObject(manifestKey(uploadId));
  return encoded ? JSON.parse(encoded.toString("utf8")) as LessonRecordingUploadManifest : null;
}
export async function readCompletedLessonRecordingUpload(uploadId: string) {
  const encoded = await readAudioObject(resultKey(uploadId));
  return encoded ? JSON.parse(encoded.toString("utf8")) as UploadResult : null;
}
export async function markLessonRecordingUploadCompleted(uploadId: string, result: UploadResult) {
  await writeAudioObject(resultKey(uploadId), Buffer.from(JSON.stringify(result)), { contentType: "application/json" }, true);
}
async function chunkReceipt(uploadId: string, chunkIndex: number): Promise<UploadReceipt | null> {
  const metadata = await readAudioObjectMetadata(chunkKey(uploadId, chunkIndex));
  if (typeof metadata?.byteLength === "number" && typeof metadata?.sha256 === "string") return { chunkIndex, byteLength: metadata.byteLength, sha256: metadata.sha256 };
  // Compatibility with older recorder chunks and recovery after a local sidecar
  // write failed. At most one transport chunk is read to reconstruct its receipt.
  const buffer = await readAudioObject(chunkKey(uploadId, chunkIndex));
  return buffer ? { chunkIndex, byteLength: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") } : null;
}
export async function saveLessonRecordingUploadChunk({ buffer, chunkIndex, contentType, uploadId, sha256 }: {
  buffer: Buffer; chunkIndex: number; contentType: string; uploadId: string; sha256?: string;
}) {
  if (buffer.length <= 0 || buffer.length > MAX_UPLOAD_CHUNK_BYTES) throw new Error("Recording chunks must be between 1 byte and 2 MiB.");
  const manifest = await readLessonRecordingUploadManifest(uploadId);
  if (!manifest) throw new Error("Upload session not found.");
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (sha256 && sha256 !== digest) throw new Error("Chunk checksum mismatch. Please retry this recording.");
  if (manifest.file) {
    if (!sha256) throw new Error("Chunk checksum is required.");
    const expectedSize = Math.min(manifest.file.chunkBytes, manifest.file.totalBytes - chunkIndex * manifest.file.chunkBytes);
    if (expectedSize <= 0 || buffer.length !== expectedSize) throw new Error("Chunk does not match the expected file size.");
  }
  const existing = await chunkReceipt(uploadId, chunkIndex);
  if (existing) {
    if (existing.byteLength !== buffer.length || existing.sha256 !== digest) throw new Error("This chunk was already saved with different bytes. Choose the original recording to resume.");
    return existing;
  }
  if (await readAudioObject(finalAudioName(manifest))) throw new Error("This recording has already been finalised.");
  const receipt = { chunkIndex, byteLength: buffer.length, sha256: digest };
  const modified = await writeAudioObject(chunkKey(uploadId, chunkIndex), buffer, { ...receipt, contentType, uploadedAt: new Date().toISOString() }, true);
  if (!modified) {
    const concurrent = await chunkReceipt(uploadId, chunkIndex);
    if (!concurrent || concurrent.sha256 !== digest || concurrent.byteLength !== buffer.length) throw new Error("Conflicting upload chunk. Please retry.");
  }
  return receipt;
}
async function receiptsForCount(uploadId: string, count: number) {
  const results: Array<UploadReceipt | null> = [];
  // Bound remote fanout, and avoid downloading a complete recording on finalize.
  for (let offset = 0; offset < count; offset += 16) {
    results.push(...await Promise.all(Array.from({ length: Math.min(16, count - offset) }, (_, i) => chunkReceipt(uploadId, offset + i))));
  }
  return results;
}
export async function getLessonRecordingUploadStatus(uploadId: string) {
  const manifest = await readLessonRecordingUploadManifest(uploadId);
  if (!manifest) return null;
  const completed = await readCompletedLessonRecordingUpload(uploadId);
  const count = manifest.file ? Math.ceil(manifest.file.totalBytes / manifest.file.chunkBytes) : 0;
  const acknowledgedChunks = (await receiptsForCount(uploadId, count)).filter((receipt): receipt is UploadReceipt => receipt !== null);
  return { uploadId, file: manifest.file, acknowledgedChunks, completed };
}
export async function completeLessonRecordingUploadSession({ chunkCount, durationSeconds, uploadId, totalBytes, integrityDigest }: {
  chunkCount: number; durationSeconds: number | null; uploadId: string; totalBytes?: number; integrityDigest?: string;
}) {
  if (!Number.isInteger(chunkCount) || chunkCount <= 0 || chunkCount > MAX_UPLOAD_CHUNKS) throw new Error("Invalid chunk count.");
  const manifest = await readLessonRecordingUploadManifest(uploadId);
  if (!manifest) throw new Error("Upload session not found.");
  if (manifest.file && chunkCount !== Math.ceil(manifest.file.totalBytes / manifest.file.chunkBytes)) throw new Error("The recording is incomplete.");
  const receipts = await receiptsForCount(uploadId, chunkCount);
  const chunks: AudioChunkReference[] = receipts.map((receipt, index) => {
    if (!receipt) throw new Error(`Missing recording chunk ${index + 1}. Retry to resume.`);
    return { key: chunkKey(uploadId, index), byteLength: receipt.byteLength, sha256: receipt.sha256 };
  });
  const actualBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  if (actualBytes > MAX_LESSON_AUDIO_BYTES || (totalBytes !== undefined && totalBytes !== actualBytes) || (manifest.file && manifest.file.totalBytes !== actualBytes)) throw new Error("Recording byte count does not match the selected file.");
  const digest = audioIntegrityDigest(chunks);
  if (integrityDigest && integrityDigest !== digest) throw new Error("Recording checksum does not match. Please retry the upload.");
  if (manifest.file && (!integrityDigest || totalBytes === undefined)) throw new Error("Recording integrity confirmation is required.");
  const storedAudio = await saveChunkedLessonAudio(finalAudioName(manifest), {
    version: 1, chunks, contentType: manifest.contentType, extension: manifest.extension,
    totalBytes: actualBytes, integrityDigest: digest,
  });
  // Chunk bytes and session are retained until metadata is durable. They are the
  // final stored recording, so cleanup must never run on metadata failure.
  return { manifest, storedAudio, metadata: { ...manifest.metadata, durationSeconds } satisfies LessonRecordingMetadataInput };
}
export async function deleteLessonRecordingUploadSession({ chunkCount, uploadId }: { chunkCount?: number; uploadId: string }) {
  const manifest = await readLessonRecordingUploadManifest(uploadId);
  if (!manifest) return;
  if (await readAudioObject(finalAudioName(manifest))) throw new Error("Completed audio cannot be removed as an abandoned upload.");
  const count = chunkCount ?? (manifest.file ? Math.ceil(manifest.file.totalBytes / manifest.file.chunkBytes) : MAX_UPLOAD_CHUNKS);
  for (let index = 0; index < count; index++) await deleteAudioObject(chunkKey(uploadId, index));
  await deleteAudioObject(manifestKey(uploadId));
}
export async function listLocalUploadSessionFiles(uploadId: string) {
  const status = await getLessonRecordingUploadStatus(uploadId);
  return status ? [manifestKey(uploadId), ...status.acknowledgedChunks.map((chunk) => chunkKey(uploadId, chunk.chunkIndex))] : [];
}
