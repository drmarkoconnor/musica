import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  LOCAL_LESSON_AUDIO_BUCKET,
  LOCAL_LESSON_AUDIO_DIRECTORY,
  NETLIFY_LESSON_AUDIO_BUCKET,
  NETLIFY_LESSON_AUDIO_STORE,
  localLessonAudioPath,
  localLessonRecordingStoragePath,
  netlifyLessonAudioKey,
  netlifyLessonRecordingStoragePath,
} from "@/lib/server/test-audio-fixtures";
import { serverEnv } from "./env";

type StoredLessonAudio = {
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
    serverEnv("NETLIFY") === "true"
  );
}

async function netlifyBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(NETLIFY_LESSON_AUDIO_STORE);
}

export async function saveLessonAudio({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<StoredLessonAudio> {
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
      storageBucket: NETLIFY_LESSON_AUDIO_BUCKET,
      storagePath: netlifyLessonRecordingStoragePath(fileName),
    };
  }

  await mkdir(LOCAL_LESSON_AUDIO_DIRECTORY, { recursive: true });
  await writeFile(path.join(LOCAL_LESSON_AUDIO_DIRECTORY, fileName), buffer);

  return {
    fileName,
    storageBucket: LOCAL_LESSON_AUDIO_BUCKET,
    storagePath: localLessonRecordingStoragePath(fileName),
  };
}

export async function readLessonAudioBuffer({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}) {
  const filePath = localLessonAudioPath(storageBucket, storagePath);

  if (filePath) {
    return readFile(filePath);
  }

  const key = netlifyLessonAudioKey(storageBucket, storagePath);

  if (!key) return null;

  const store = await netlifyBlobStore();
  const entry = await store.get(key, { type: "arrayBuffer" });

  if (!entry) return null;

  return Buffer.from(entry);
}

export async function materializeLessonAudioFile({
  storageBucket,
  storagePath,
}: {
  storageBucket: string;
  storagePath: string;
}) {
  const filePath = localLessonAudioPath(storageBucket, storagePath);

  if (filePath) {
    return {
      cleanup: async () => {},
      filePath,
    };
  }

  const buffer = await readLessonAudioBuffer({ storageBucket, storagePath });

  if (!buffer) return null;

  const extension = path.extname(storagePath) || ".webm";
  const tempPath = path.join(
    os.tmpdir(),
    `practice-loop-transcription-${randomUUID()}${extension}`,
  );

  await writeFile(tempPath, buffer);

  return {
    cleanup: async () => {
      const { rm } = await import("node:fs/promises");
      await rm(tempPath, { force: true });
    },
    filePath: tempPath,
  };
}
