import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import {
  LOCAL_LESSON_AUDIO_BUCKET, LOCAL_LESSON_AUDIO_DIRECTORY,
  NETLIFY_LESSON_AUDIO_BUCKET, NETLIFY_LESSON_AUDIO_STORE,
  localLessonAudioPath, localLessonRecordingStoragePath,
  netlifyLessonAudioKey, netlifyLessonRecordingStoragePath,
} from "@/lib/server/test-audio-fixtures";
import { serverEnv, shouldUseNetlifyAudioStorage } from "./env";

export type StoredLessonAudio = { fileName: string; storageBucket: string; storagePath: string };
export type AudioChunkReference = { key: string; byteLength: number; sha256: string };
export type ChunkedLessonAudio = {
  version: 1; contentType: string; extension: string; totalBytes: number;
  integrityDigest: string; chunks: AudioChunkReference[];
};
type Reference = { storageBucket: string; storagePath: string };
export const MAX_AUDIO_RESPONSE_BYTES = 2 * 1024 * 1024;

export function usesNetlifyLessonAudio() {
  // Credentials configure an explicitly selected remote store; their presence
  // in .env.local must not redirect ordinary local development to Netlify.
  return shouldUseNetlifyAudioStorage();
}
export async function lessonAudioBlobStore(signal?: AbortSignal) {
  const { getStore } = await import("@netlify/blobs");
  const siteID = serverEnv("NETLIFY_SITE_ID") ?? serverEnv("SITE_ID");
  const token = serverEnv("NETLIFY_BLOBS_TOKEN") ?? serverEnv("NETLIFY_AUTH_TOKEN") ?? serverEnv("NETLIFY_TOKEN");
  return getStore({
    name: NETLIFY_LESSON_AUDIO_STORE, consistency: "strong",
    ...(siteID && token ? { siteID, token } : {}),
    fetch: (input, init) => fetch(input, { ...init, signal: signal ?? AbortSignal.timeout(30_000) }),
  });
}
// These paths address runtime uploads and temporary worker files, not bundled
// source assets. Mark read arguments so Turbopack does not trace the whole repo.
function localObjectPath(key: string) {
  if (!/^[a-z0-9._-]+$/i.test(key)) throw new Error("Invalid audio object key.");
  return path.join(LOCAL_LESSON_AUDIO_DIRECTORY, key);
}
export function lessonAudioReference(fileName: string): StoredLessonAudio {
  return usesNetlifyLessonAudio()
    ? { fileName, storageBucket: NETLIFY_LESSON_AUDIO_BUCKET, storagePath: netlifyLessonRecordingStoragePath(fileName) }
    : { fileName, storageBucket: LOCAL_LESSON_AUDIO_BUCKET, storagePath: localLessonRecordingStoragePath(fileName) };
}
export async function readAudioObject(key: string, remote = usesNetlifyLessonAudio(), signal?: AbortSignal) {
  if (remote) {
    const value = await (await lessonAudioBlobStore(signal)).get(key, { type: "arrayBuffer" });
    return value ? Buffer.from(value) : null;
  }
  try { return await readFile(/* turbopackIgnore: true */ localObjectPath(key), { signal }); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function readAudioObjectMetadata(key: string, remote = usesNetlifyLessonAudio()): Promise<Record<string, unknown> | null> {
  if (remote) return (await (await lessonAudioBlobStore()).getMetadata(key))?.metadata ?? null;
  try { return JSON.parse(await readFile(/* turbopackIgnore: true */ `${localObjectPath(key)}.metadata.json`, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function writeAudioObject(key: string, buffer: Buffer, metadata: Record<string, unknown> = {}, onlyIfNew = false) {
  if (usesNetlifyLessonAudio()) {
    const value = Uint8Array.from(buffer).buffer;
    return (await (await lessonAudioBlobStore()).set(key, value, { metadata: { ...metadata, byteLength: buffer.length }, onlyIfNew })).modified;
  }
  await mkdir(LOCAL_LESSON_AUDIO_DIRECTORY, { recursive: true });
  try { await writeFile(localObjectPath(key), buffer, onlyIfNew ? { flag: "wx" } : undefined); }
  catch (error) { if (onlyIfNew && (error as NodeJS.ErrnoException).code === "EEXIST") return false; throw error; }
  await writeFile(`${localObjectPath(key)}.metadata.json`, JSON.stringify({ ...metadata, byteLength: buffer.length }));
  return true;
}
export async function deleteAudioObject(key: string, remote = usesNetlifyLessonAudio()) {
  if (remote) return (await lessonAudioBlobStore()).delete(key);
  await Promise.all([rm(localObjectPath(key), { force: true }), rm(`${localObjectPath(key)}.metadata.json`, { force: true })]);
}
export function audioIntegrityDigest(chunks: Pick<AudioChunkReference, "byteLength" | "sha256">[]) {
  return createHash("sha256").update(chunks.map((chunk, index) => `${index}:${chunk.byteLength}:${chunk.sha256}\n`).join("")).digest("hex");
}
export async function saveLessonAudio({ buffer, contentType, fileName }: { buffer: Buffer; contentType: string; fileName: string }): Promise<StoredLessonAudio> {
  await writeAudioObject(fileName, buffer, { contentType, uploadedAt: new Date().toISOString() });
  return lessonAudioReference(fileName);
}
export async function saveChunkedLessonAudio(fileName: string, manifest: ChunkedLessonAudio) {
  const encoded = Buffer.from(JSON.stringify(manifest));
  if (!await writeAudioObject(fileName, encoded, { contentType: "application/json" }, true)) {
    const existing = await readAudioObject(fileName);
    if (!existing?.equals(encoded)) throw new Error("This upload has already been finalised with different audio.");
  }
  return lessonAudioReference(fileName);
}
function objectKey(reference: Reference) {
  const local = localLessonAudioPath(reference.storageBucket, reference.storagePath);
  return local ? path.basename(local) : netlifyLessonAudioKey(reference.storageBucket, reference.storagePath);
}
async function readChunkedManifest(reference: Reference, signal?: AbortSignal): Promise<ChunkedLessonAudio | null> {
  if (!reference.storagePath.endsWith(".chunks.json")) return null;
  const key = objectKey(reference);
  if (!key) return null;
  const value = await readAudioObject(key, reference.storageBucket === NETLIFY_LESSON_AUDIO_BUCKET, signal);
  if (!value) return null;
  const manifest = JSON.parse(value.toString("utf8")) as ChunkedLessonAudio;
  if (manifest.version !== 1 || !Array.isArray(manifest.chunks) ||
      manifest.totalBytes !== manifest.chunks.reduce((total, chunk) => total + chunk.byteLength, 0) ||
      manifest.integrityDigest !== audioIntegrityDigest(manifest.chunks)) throw new Error("Invalid audio manifest.");
  return manifest;
}
async function verifiedChunk(chunk: AudioChunkReference, remote: boolean, signal?: AbortSignal) {
  const buffer = await readAudioObject(chunk.key, remote, signal);
  if (!buffer || buffer.length !== chunk.byteLength || createHash("sha256").update(buffer).digest("hex") !== chunk.sha256)
    throw new Error("A recording chunk is missing or damaged. Please retry the upload.");
  return buffer;
}
export function contentTypeForAudioPath(storagePath: string) {
  const extension = path.extname(storagePath.replace(/\.chunks\.json$/, "")).toLowerCase();
  return ({ ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".aac": "audio/aac", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".webm": "audio/webm" } as Record<string, string>)[extension] ?? "application/octet-stream";
}
export async function describeLessonAudio(reference: Reference) {
  const manifest = await readChunkedManifest(reference);
  if (manifest) return { fileSize: manifest.totalBytes, contentType: manifest.contentType, manifest };
  const filePath = localLessonAudioPath(reference.storageBucket, reference.storagePath);
  if (filePath) return { fileSize: (await stat(/* turbopackIgnore: true */ filePath)).size, contentType: contentTypeForAudioPath(reference.storagePath), manifest: null };
  const key = netlifyLessonAudioKey(reference.storageBucket, reference.storagePath);
  if (!key) return null;
  const metadata = await readAudioObjectMetadata(key, true);
  if (typeof metadata?.byteLength === "number") return { fileSize: metadata.byteLength, contentType: contentTypeForAudioPath(reference.storagePath), manifest: null };
  // Old single objects have no stored size. Compatibility needs one full read;
  // all new uploads use chunk manifests and never take this path.
  const legacy = await readAudioObject(key, true);
  return legacy ? { fileSize: legacy.length, contentType: contentTypeForAudioPath(reference.storagePath), manifest: null } : null;
}
export async function readLessonAudioRange(reference: Reference, start: number, end: number, knownManifest?: ChunkedLessonAudio | null) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end - start + 1 > MAX_AUDIO_RESPONSE_BYTES) throw new Error("Invalid audio range.");
  const manifest = knownManifest === undefined ? await readChunkedManifest(reference) : knownManifest;
  if (manifest) {
    const parts: Buffer[] = [];
    let offset = 0;
    for (const chunk of manifest.chunks) {
      const chunkEnd = offset + chunk.byteLength - 1;
      if (chunkEnd >= start && offset <= end) {
        const buffer = await verifiedChunk(chunk, reference.storageBucket === NETLIFY_LESSON_AUDIO_BUCKET);
        parts.push(buffer.subarray(Math.max(0, start - offset), Math.min(chunk.byteLength, end - offset + 1)));
      }
      offset += chunk.byteLength;
      if (offset > end) break;
    }
    return Buffer.concat(parts);
  }
  const filePath = localLessonAudioPath(reference.storageBucket, reference.storagePath);
  if (filePath) {
    const handle = await open(/* turbopackIgnore: true */ filePath, "r");
    try { const buffer = Buffer.alloc(end - start + 1); const { bytesRead } = await handle.read(buffer, 0, buffer.length, start); return buffer.subarray(0, bytesRead); }
    finally { await handle.close(); }
  }
  const key = netlifyLessonAudioKey(reference.storageBucket, reference.storagePath);
  if (!key) return null;
  // The installed Blobs SDK has no Range API. Legacy single-blob recordings
  // remain readable, but need a full object fetch until explicitly migrated.
  return (await readAudioObject(key, true))?.subarray(start, end + 1) ?? null;
}
export async function readLessonAudioBuffer(reference: Reference) {
  const materialized = await materializeLessonAudioFile(reference);
  if (!materialized) return null;
  try { return await readFile(/* turbopackIgnore: true */ materialized.filePath); } finally { await materialized.cleanup(); }
}
export async function materializeLessonAudioFile(reference: Reference) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const signal = controller.signal;
  let tempPath: string | undefined;
  try {
    const manifest = await readChunkedManifest(reference, signal);
    const local = localLessonAudioPath(reference.storageBucket, reference.storagePath);
    if (local && !manifest) {
      try { await access(/* turbopackIgnore: true */ local); } catch { return null; }
      return { cleanup: async () => {}, filePath: local };
    }
    const extension = manifest ? `.${manifest.extension}` : path.extname(reference.storagePath) || ".webm";
    tempPath = path.join(os.tmpdir(), `practice-loop-transcription-${randomUUID()}${extension}`);
    if (manifest) {
      const remote = reference.storageBucket === NETLIFY_LESSON_AUDIO_BUCKET;
      async function* chunks() { for (const chunk of manifest!.chunks) yield await verifiedChunk(chunk, remote, signal); }
      await pipeline(Readable.from(chunks()), createWriteStream(tempPath), { signal });
    } else {
      const key = netlifyLessonAudioKey(reference.storageBucket, reference.storagePath);
      if (!key) return null;
      const stream = await (await lessonAudioBlobStore(signal)).get(key, { type: "stream" });
      if (!stream) return null;
      await pipeline(Readable.fromWeb(stream as unknown as NodeReadableStream<Uint8Array>), createWriteStream(tempPath), { signal });
    }
    const filePath = tempPath;
    return { cleanup: async () => { await rm(filePath, { force: true }); }, filePath };
  } catch (error) {
    if (tempPath) await rm(tempPath, { force: true });
    if (signal.aborted) throw new Error("Preparing the recording timed out. Your audio and saved transcription passages are retained; retry to continue.");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function deleteLessonAudio(reference: Reference) {
  const manifest = await readChunkedManifest(reference);
  const remote = reference.storageBucket === NETLIFY_LESSON_AUDIO_BUCKET;
  if (manifest) for (const chunk of manifest.chunks) await deleteAudioObject(chunk.key, remote);
  const key = objectKey(reference);
  if (key) await deleteAudioObject(key, remote);
  const completedUploadId = key?.match(/^([0-9a-f-]{36})\.[a-z0-9]+\.chunks\.json$/i)?.[1];
  if (completedUploadId) {
    // A deleted recording must not remain a successful resume result.
    await deleteAudioObject(`pending-lesson-upload-${completedUploadId}-result.json`, remote);
    await deleteAudioObject(`pending-lesson-upload-${completedUploadId}-manifest.json`, remote);
  }
}
