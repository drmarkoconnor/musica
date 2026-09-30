import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLessonTime, searchLessonPassages } from "./lesson-search";
import { analysisCostEstimate, transcriptionCostEstimate } from "./analysis-cost";

test("saved transcript search is case-insensitive and requires all search terms", () => {
  const passages = [
    { id: "1", text: "Guide tones in the left hand.", startsAtSeconds: 1, endsAtSeconds: 10, precision: "timed" as const },
    { id: "2", text: "Let the melody breathe.", startsAtSeconds: 10, endsAtSeconds: 20, precision: "timed" as const },
  ];
  assert.deepEqual(searchLessonPassages(passages, " HAND guide "), [passages[0]]);
  assert.deepEqual(searchLessonPassages(passages, "guide melody"), []);
  assert.deepEqual(searchLessonPassages(passages, ""), passages);
});

test("time entry supports seconds, minutes and hours without accepting invalid fields", () => {
  assert.equal(parseLessonTime("1:02:03"), 3723);
  assert.equal(parseLessonTime("12:30"), 750);
  assert.equal(parseLessonTime("90"), 90);
  for (const value of ["-1", "1:99", "1:60:00", "abc", "", "2.5"]) assert.equal(parseLessonTime(value), null);
});

test("costs stay informational and unknown models never pretend to be free", () => {
  assert.equal(transcriptionCostEstimate("local-whisper:ggml-small", 3600), 0);
  assert.ok(Math.abs(transcriptionCostEstimate("gpt-transcribe", 3600)! - 0.27) < 1e-9);
  assert.equal(transcriptionCostEstimate("unknown", 3600), null);
  assert.equal(analysisCostEstimate({ model: "gpt-6-astra", inputTokens: 10000, cachedInputTokens: 0, outputTokens: 3000 }), 0.25);
  assert.equal(analysisCostEstimate(null), null);
});
