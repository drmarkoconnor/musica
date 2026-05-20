import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serverEnv } from "./env";

export const LOCAL_PRACTICE_AUDIO_BUCKET = "local-practice-audio";
export const LOCAL_PRACTICE_AUDIO_STORAGE_PREFIX = "docs/practice-recordings/";
export const NETLIFY_PRACTICE_AUDIO_BUCKET = "netlify-blobs";
export const NETLIFY_PRACTICE_AUDIO_STORE = "practice-recordings";
export const NETLIFY_PRACTICE_AUDIO_STORAGE_PREFIX =
  "netlify-blobs/practice-recordings/";

const LOCAL_PRACTICE_AUDIO_DIRECTORY =
  serverEnv("NETLIFY")
    ? path.join(os.tmpdir(), "practice-loop/practice-recordings")
    : path.join(os.tmpdir(), "practice-loop/practice-recordings");

type StoredPracticeAudio = {
  fileName: string;
  storageBucket: string;
  storagePath: string;
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
      name: NETLIFY_PRACTICE_AUDIO_STORE,
      siteID,
      token,
    });
  }

  return getStore(NETLIFY_PRACTICE_AUDIO_STORE);
}

export function practiceAudioContentTypeForPath(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();

  if (extension === ".m4a" || extension === ".mp4") return "audio/mp4";
  if (extension === ".aac") return "audio/aac";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".ogg") return "audio/ogg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".webm") return "audio/webm";

  return "application/octet-stream";
}

function localPracticeRecordingStoragePath(fileName: string) {
  return `${LOCAL_PRACTICE_AUDIO_STORAGE_PREFIX}${fileName}`;
}

function netlifyPracticeRecordingStoragePath(fileName: string) {
  return `${NETLIFY_PRACTICE_AUDIO_STORAGE_PREFIX}${fileName}`;
}

function safeFileName(value: string) {
  return (
    value.length > 0 &&
    value === path.basename(value) &&
    /^[a-z0-9._-]+$/i.test(value)
  );
}

function localPracticeAudioPath(storageBucket: string, storagePath: string) {
  if (
    storageBucket !== LOCAL_PRACTICE_AUDIO_BUCKET ||
    !storagePath.startsWith(LOCAL_PRACTICE_AUDIO_STORAGE_PREFIX)
  ) {
    return null;
  }

  const fileName = storagePath.slice(LOCAL_PRACTICE_AUDIO_STORAGE_PREFIX.length);

  if (!safeFileName(fileName)) return null;

  return path.join(LOCAL_PRACTICE_AUDIO_DIRECTORY, fileName);
}

function netlifyPracticeAudioKey(storageBucket: string, storagePath: string) {
  if (
    storageBucket !== NETLIFY_PRACTICE_AUDIO_BUCKET ||
    !storagePath.startsWith(NETLIFY_PRACTICE_AUDIO_STORAGE_PREFIX)
  ) {
    return null;
  }

  const key = storagePath.slice(NETLIFY_PRACTICE_AUDIO_STORAGE_PREFIX.length);

  if (!safeFileName(key)) return null;

  return key;
}

export async function savePracticeAudio({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<StoredPracticeAudio> {
  if (shouldUseNetlifyBlobs()) {
    const store = await netlifyBlobStore();
    await store.set(fileName, bufferArrayBuffer(buffer), {
      metadata: {
        contentType,
        uploadedAt: new Date().toISOString(),
      },
    });

    return {
      fileName,
      storageBucket: NETLIFY_PRACTICE_AUDIO_BUCKET,
      storagePath: netlifyPracticeRecordingStoragePath(fileName),
    };
  }

  await mkdir(LOCAL_PRACTICE_AUDIO_DIRECTORY, { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ path.join(LOCAL_PRACTICE_AUDIO_DIRECTORY, fileName),
    buffer,
  );

  return {
    fileName,
    storageBucket: LOCAL_PRACTICE_AUDIO_BUCKET,
    storagePath: localPracticeRecordingStoragePath(fileName),
  };
}

export async function readPracticeAudioBuffer({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}) {
  const filePath = localPracticeAudioPath(storageBucket, storagePath);

  if (filePath) {
    return readFile(/*turbopackIgnore: true*/ filePath).catch(() => null);
  }

  const key = netlifyPracticeAudioKey(storageBucket, storagePath);

  if (!key) return null;

  const store = await netlifyBlobStore();
  const entry = await store.get(key, { type: "arrayBuffer" });

  if (!entry) return null;

  return Buffer.from(entry);
}

export async function deletePracticeAudio({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}) {
  const filePath = localPracticeAudioPath(storageBucket, storagePath);

  if (filePath) {
    await rm(filePath, { force: true });
    return;
  }

  const key = netlifyPracticeAudioKey(storageBucket, storagePath);

  if (!key) return;

  const store = await netlifyBlobStore();
  await store.delete(key);
}
