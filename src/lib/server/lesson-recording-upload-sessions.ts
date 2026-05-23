import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { saveLessonAudio } from "@/lib/server/lesson-audio-storage";
import {
  LOCAL_LESSON_AUDIO_DIRECTORY,
  NETLIFY_LESSON_AUDIO_STORE,
} from "@/lib/server/test-audio-fixtures";
import { serverEnv } from "./env";
import type { LessonRecordingMetadataInput } from "./lesson-recording-metadata";

const LOCAL_UPLOAD_DIRECTORY = path.join(
  LOCAL_LESSON_AUDIO_DIRECTORY,
  "_upload-sessions",
);
const UPLOAD_KEY_PREFIX = "pending-lesson-upload";
const MAX_CHUNKS = 2000;
const MAX_CHUNK_BYTES = 12 * 1024 * 1024;

export type LessonRecordingUploadManifest = {
  contentType: string;
  createdAt: string;
  extension: string;
  id: string;
  metadata: Omit<LessonRecordingMetadataInput, "durationSeconds">;
};

function bufferArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}

function shouldUseNetlifyBlobs() {
  return (
    serverEnv("PRACTICE_LOOP_AUDIO_STORAGE") === "netlify-blobs" ||
    serverEnv("NETLIFY") === "true" ||
    Boolean(serverEnv("SITE_ID") || serverEnv("NETLIFY_SITE_ID"))
  );
}

async function netlifyBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  const siteID = serverEnv("NETLIFY_SITE_ID") ?? serverEnv("SITE_ID");
  const token =
    serverEnv("NETLIFY_BLOBS_TOKEN") ??
    serverEnv("NETLIFY_AUTH_TOKEN") ??
    serverEnv("NETLIFY_TOKEN");

  if (siteID && token) {
    return getStore({
      name: NETLIFY_LESSON_AUDIO_STORE,
      siteID,
      token,
    });
  }

  return getStore(NETLIFY_LESSON_AUDIO_STORE);
}

function isUploadId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function uploadPrefix(uploadId: string) {
  if (!isUploadId(uploadId)) {
    throw new Error("Invalid upload ID.");
  }

  return `${UPLOAD_KEY_PREFIX}-${uploadId}`;
}

function manifestKey(uploadId: string) {
  return `${uploadPrefix(uploadId)}-manifest.json`;
}

function chunkKey(uploadId: string, chunkIndex: number) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= MAX_CHUNKS) {
    throw new Error("Invalid chunk index.");
  }

  return `${uploadPrefix(uploadId)}-chunk-${String(chunkIndex).padStart(
    5,
    "0",
  )}.part`;
}

function localUploadPath(uploadId: string, fileName: string) {
  return path.join(LOCAL_UPLOAD_DIRECTORY, uploadPrefix(uploadId), fileName);
}

function localManifestPath(uploadId: string) {
  return localUploadPath(uploadId, "manifest.json");
}

function localChunkPath(uploadId: string, chunkIndex: number) {
  return localUploadPath(
    uploadId,
    `chunk-${String(chunkIndex).padStart(5, "0")}.part`,
  );
}

function safeExtension(value: string) {
  const extension = value.toLowerCase().replace(/^\./, "");

  if (["aac", "m4a", "mp3", "mp4", "ogg", "wav", "webm"].includes(extension)) {
    return extension;
  }

  return "webm";
}

export async function createLessonRecordingUploadSession({
  contentType,
  extension,
  metadata,
}: {
  contentType: string;
  extension: string;
  metadata: Omit<LessonRecordingMetadataInput, "durationSeconds">;
}) {
  const now = new Date().toISOString();
  const manifest: LessonRecordingUploadManifest = {
    contentType: contentType || "application/octet-stream",
    createdAt: now,
    extension: safeExtension(extension),
    id: randomUUID(),
    metadata,
  };
  const encoded = Buffer.from(JSON.stringify(manifest));

  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();
    await store.set(manifestKey(manifest.id), bufferArrayBuffer(encoded), {
      metadata: {
        contentType: "application/json",
        createdAt: now,
      },
    });
  } else {
    await mkdir(path.dirname(localManifestPath(manifest.id)), { recursive: true });
    await writeFile(localManifestPath(manifest.id), encoded);
  }

  return manifest;
}

export async function readLessonRecordingUploadManifest(uploadId: string) {
  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();
    const entry = await store.get(manifestKey(uploadId), { type: "arrayBuffer" });

    if (!entry) return null;

    return JSON.parse(
      Buffer.from(entry).toString("utf8"),
    ) as LessonRecordingUploadManifest;
  }

  try {
    return JSON.parse(
      await readFile(localManifestPath(uploadId), "utf8"),
    ) as LessonRecordingUploadManifest;
  } catch {
    return null;
  }
}

export async function saveLessonRecordingUploadChunk({
  buffer,
  chunkIndex,
  contentType,
  uploadId,
}: {
  buffer: Buffer;
  chunkIndex: number;
  contentType: string;
  uploadId: string;
}) {
  if (buffer.length <= 0 || buffer.length > MAX_CHUNK_BYTES) {
    throw new Error("Invalid chunk size.");
  }

  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();
    await store.set(chunkKey(uploadId, chunkIndex), bufferArrayBuffer(buffer), {
      metadata: {
        chunkIndex,
        contentType: contentType || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      },
    });
    return;
  }

  await mkdir(path.dirname(localChunkPath(uploadId, chunkIndex)), {
    recursive: true,
  });
  await writeFile(localChunkPath(uploadId, chunkIndex), buffer);
}

async function readLessonRecordingUploadChunk({
  chunkIndex,
  uploadId,
}: {
  chunkIndex: number;
  uploadId: string;
}) {
  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();
    const entry = await store.get(chunkKey(uploadId, chunkIndex), {
      type: "arrayBuffer",
    });

    return entry ? Buffer.from(entry) : null;
  }

  try {
    return await readFile(localChunkPath(uploadId, chunkIndex));
  } catch {
    return null;
  }
}

export async function deleteLessonRecordingUploadSession({
  chunkCount,
  uploadId,
}: {
  chunkCount?: number;
  uploadId: string;
}) {
  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();

    await store.delete(manifestKey(uploadId));

    if (typeof chunkCount === "number") {
      await Promise.all(
        Array.from({ length: chunkCount }, (_, index) =>
          store.delete(chunkKey(uploadId, index)),
        ),
      );
      return;
    }

    const listed = await store.list({ prefix: uploadPrefix(uploadId) });
    await Promise.all(listed.blobs.map((blob) => store.delete(blob.key)));
    return;
  }

  await rm(path.join(LOCAL_UPLOAD_DIRECTORY, uploadPrefix(uploadId)), {
    force: true,
    recursive: true,
  });
}

export async function completeLessonRecordingUploadSession({
  chunkCount,
  durationSeconds,
  uploadId,
}: {
  chunkCount: number;
  durationSeconds: number | null;
  uploadId: string;
}) {
  if (!Number.isInteger(chunkCount) || chunkCount <= 0 || chunkCount > MAX_CHUNKS) {
    throw new Error("Invalid chunk count.");
  }

  const manifest = await readLessonRecordingUploadManifest(uploadId);

  if (!manifest) {
    throw new Error("Upload session not found.");
  }

  const chunks: Buffer[] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = await readLessonRecordingUploadChunk({
      chunkIndex: index,
      uploadId,
    });

    if (!chunk) {
      throw new Error(`Missing recording chunk ${index + 1}.`);
    }

    chunks.push(chunk);
  }

  const recordedAt = manifest.metadata.recordedAt;
  const fileName = `${recordedAt.replace(/[:.]/g, "-")}-${randomUUID()}.${
    manifest.extension
  }`;
  const storedAudio = await saveLessonAudio({
    buffer: Buffer.concat(chunks),
    contentType: manifest.contentType,
    fileName,
  });

  await deleteLessonRecordingUploadSession({ chunkCount, uploadId }).catch(
    (error) => {
      console.error("Completed lesson upload session cleanup failed", error);
    },
  );

  return {
    manifest,
    storedAudio,
    metadata: {
      ...manifest.metadata,
      durationSeconds,
    } satisfies LessonRecordingMetadataInput,
  };
}

export async function listLocalUploadSessionFiles(uploadId: string) {
  try {
    return await readdir(path.join(LOCAL_UPLOAD_DIRECTORY, uploadPrefix(uploadId)));
  } catch {
    return [];
  }
}
