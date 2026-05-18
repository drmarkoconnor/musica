import "server-only";

import os from "node:os";
import path from "node:path";
import {
  TEST_LESSON_FIXTURE_ID,
  TEST_LESSON_FIXTURE_STORAGE_PATH,
} from "@/lib/teaching-review";

export const LOCAL_LESSON_AUDIO_BUCKET = "local-lesson-audio";
export const LOCAL_LESSON_AUDIO_STORAGE_PREFIX = "docs/lesson-recordings/";
export const NETLIFY_LESSON_AUDIO_BUCKET = "netlify-blobs";
export const NETLIFY_LESSON_AUDIO_STORE = "lesson-recordings";
export const NETLIFY_LESSON_AUDIO_STORAGE_PREFIX = "netlify-blobs/lesson-recordings/";
export const LOCAL_LESSON_AUDIO_DIRECTORY = path.join(
  process.env.LOCAL_LESSON_AUDIO_DIRECTORY ??
    (process.env.NETLIFY
      ? path.join(os.tmpdir(), "practice-loop/lesson-recordings")
      : path.join(
          /*turbopackIgnore: true*/ process.cwd(),
          "docs/lesson-recordings",
        )),
);

export type TestAudioFixture = {
  id: string;
  title: string;
  storageBucket: string;
  storagePath: string;
  filePath: string;
  durationSeconds: number;
  recordedAt: string;
};

export const testAudioFixtures: Record<string, TestAudioFixture> = {
  [TEST_LESSON_FIXTURE_ID]: {
    id: TEST_LESSON_FIXTURE_ID,
    title: "Leo lesson test clip - central 15 minutes",
    storageBucket: "local-test-audio",
    storagePath: TEST_LESSON_FIXTURE_STORAGE_PATH,
    filePath: path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "docs/test-audio/Leo Lesson_20260424_1200.central-15m.m4a",
    ),
    durationSeconds: 900,
    recordedAt: "2026-04-24T11:20:31.000Z",
  },
};

export function getTestAudioFixture(fixtureId: string) {
  return testAudioFixtures[fixtureId] ?? null;
}

export function localLessonRecordingStoragePath(fileName: string) {
  return `${LOCAL_LESSON_AUDIO_STORAGE_PREFIX}${fileName}`;
}

export function netlifyLessonRecordingStoragePath(fileName: string) {
  return `${NETLIFY_LESSON_AUDIO_STORAGE_PREFIX}${fileName}`;
}

export function netlifyLessonAudioKey(storageBucket: string, storagePath: string) {
  if (
    storageBucket !== NETLIFY_LESSON_AUDIO_BUCKET ||
    !storagePath.startsWith(NETLIFY_LESSON_AUDIO_STORAGE_PREFIX)
  ) {
    return null;
  }

  const key = storagePath.slice(NETLIFY_LESSON_AUDIO_STORAGE_PREFIX.length);

  if (
    key.length === 0 ||
    key !== path.basename(key) ||
    !/^[a-z0-9._-]+$/i.test(key)
  ) {
    return null;
  }

  return key;
}

export function localLessonAudioPath(storageBucket: string, storagePath: string) {
  const fixture = Object.values(testAudioFixtures).find(
    (item) =>
      item.storageBucket === storageBucket && item.storagePath === storagePath,
  );

  if (fixture) return fixture.filePath;

  if (
    storageBucket !== LOCAL_LESSON_AUDIO_BUCKET ||
    !storagePath.startsWith(LOCAL_LESSON_AUDIO_STORAGE_PREFIX)
  ) {
    return null;
  }

  const fileName = storagePath.slice(LOCAL_LESSON_AUDIO_STORAGE_PREFIX.length);

  if (
    fileName.length === 0 ||
    fileName !== path.basename(fileName) ||
    !/^[a-z0-9._-]+$/i.test(fileName)
  ) {
    return null;
  }

  return path.join(LOCAL_LESSON_AUDIO_DIRECTORY, fileName);
}
