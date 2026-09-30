import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseWhisperJson, localWhisperConfiguration, transcribeWithLocalWhisper } from "./local-whisper";
import { resolveTranscriptionProvider } from "./transcription-provider";
import { evidenceFromChunks } from "./transcript-passages";
import type { TranscriptionJobChunkRow } from "@/db/schema";

const previousNetlify = process.env.NETLIFY;
afterEach(() => { if (previousNetlify === undefined) delete process.env.NETLIFY; else process.env.NETLIFY = previousNetlify; });

test("Whisper JSON uses real millisecond offsets and drops non-speech labels", () => {
  assert.deepEqual(parseWhisperJson({ transcription: [
    { offsets: { from: 0, to: 1500 }, text: " [Music] " },
    { offsets: { from: 1800, to: 4500 }, text: " Let the phrase breathe. " },
    { offsets: { from: 5000, to: 12000 }, text: "Keep feeling the pulse." },
  ] }, 10), [
    { startsAtSeconds: 1.8, endsAtSeconds: 4.5, text: "Let the phrase breathe." },
    { startsAtSeconds: 5, endsAtSeconds: 10, text: "Keep feeling the pulse." },
  ]);
  for (const value of [{}, { transcription: [{}] }, { transcription: [{ offsets: { from: -1, to: 10 }, text: "Invalid" }] }]) assert.throws(() => parseWhisperJson(value, 10));
});

test("hosted servers never choose a Mac engine or silently substitute paid transcription", async () => {
  process.env.NETLIFY = "true";
  assert.equal(await localWhisperConfiguration(), null);
  assert.equal((await resolveTranscriptionProvider("auto")).provider, "openai");
  await assert.rejects(resolveTranscriptionProvider("local-whisper"), /not installed/);
  await assert.rejects(resolveTranscriptionProvider("unknown"), /Choose/);
  await assert.rejects(transcribeWithLocalWhisper({ filePath: "never-read.m4a", durationSeconds: 10 }), /needs the local Whisper model/);
});

test("speech passages are grouped using saved timestamps and offset to the original lesson", () => {
  const chunk = { id: "source", startsAtSeconds: 3600, endsAtSeconds: 3780, status: "complete", text: "saved transcript", segmentId: null,
    timedSegments: [{ startsAtSeconds: 2.4, endsAtSeconds: 11.8, text: "Leave space." }, { startsAtSeconds: 12, endsAtSeconds: 22, text: "Listen to the bass." }, { startsAtSeconds: 75, endsAtSeconds: 85.1, text: "Keep the pulse." }],
  } as TranscriptionJobChunkRow;
  assert.deepEqual(evidenceFromChunks([chunk], "full_recording"), [
    { id: "source:0", startsAtSeconds: 3602, endsAtSeconds: 3622, text: "Leave space. Listen to the bass.", segmentId: undefined, precision: "timed" },
    { id: "source:1", startsAtSeconds: 3675, endsAtSeconds: 3686, text: "Keep the pulse.", segmentId: undefined, precision: "timed" },
  ]);
  const untimed = evidenceFromChunks([{ ...chunk, timedSegments: null }], "full_recording");
  assert.equal(untimed[0].precision, "approximate");
  assert.equal(untimed[0].endsAtSeconds, 3780);
  assert.deepEqual(evidenceFromChunks([{ ...chunk, status: "failed" }], "full_recording"), []);
});
