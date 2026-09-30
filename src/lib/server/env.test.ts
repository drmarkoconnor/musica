import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isNetlifyRuntime, serverEnv, shouldUseNetlifyAudioStorage } from "./env";
import { localWhisperConfiguration } from "./local-whisper";
import { dispatchLessonTranscription } from "./transcription-dispatch";

type Runtime = { env: { get(key: string): string | undefined } };
const globals = globalThis as typeof globalThis & { Netlify?: Runtime };
const previousRuntime = globals.Netlify;
const previousFetch = globalThis.fetch;
const keys = ["NETLIFY", "PRACTICE_LOOP_AUDIO_STORAGE", "PRACTICE_LOOP_SITE_URL"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
afterEach(() => {
  if (previousRuntime) globals.Netlify = previousRuntime;
  else delete globals.Netlify;
  globalThis.fetch = previousFetch;
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("modern Netlify runtime selects cloud storage without the build-only NETLIFY flag", async () => {
  delete process.env.NETLIFY;
  delete process.env.PRACTICE_LOOP_AUDIO_STORAGE;
  globals.Netlify = { env: { get: () => undefined } };
  assert.equal(isNetlifyRuntime(), true);
  assert.equal(shouldUseNetlifyAudioStorage(), true);
  assert.equal(await localWhisperConfiguration(), null);
});

test("runtime settings take precedence while local process settings remain available", () => {
  process.env.PRACTICE_LOOP_AUDIO_STORAGE = "local";
  globals.Netlify = { env: { get: (key) => key === "PRACTICE_LOOP_AUDIO_STORAGE" ? "netlify-blobs" : undefined } };
  assert.equal(serverEnv("PRACTICE_LOOP_AUDIO_STORAGE"), "netlify-blobs");
  assert.equal(shouldUseNetlifyAudioStorage(), true);
  globals.Netlify.env.get = () => undefined;
  assert.equal(shouldUseNetlifyAudioStorage(), false);
});

test("a configured hosted origin dispatches background work without build URL variables", async () => {
  globals.Netlify = { env: { get: (key) => key === "PRACTICE_LOOP_SITE_URL" ? "https://private-app.example" : undefined } };
  let sent = false;
  globalThis.fetch = async (url, options) => {
    sent = true;
    assert.equal(String(url), "https://private-app.example/.netlify/functions/transcribe-lesson-background");
    assert.equal(options?.method, "POST");
    return new Response(null, { status: 202 });
  };
  await dispatchLessonTranscription({ jobId: "fixture", token: "fixture-token" });
  assert.equal(sent, true);
});
