import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTranscriptionMode, splitRangeIntoChunks, transcriptionRequestKey, validateDuration } from "./transcription-policy";
import { parseLessonAnalysis, type LessonEvidence } from "./lesson-analysis";

const evidence: LessonEvidence[] = [{ id: "chunk-one", startsAtSeconds: 3600, endsAtSeconds: 3780, text: "Let the melody breathe. Practise the voicing through twelve keys.", precision: "approximate" }];
const valid = { overallSummary: "Melodic phrasing and voicings.", summaryBullets: [{ title: "Let the phrase breathe", body: "Leave space at the end of the melodic line.", evidenceId: "chunk-one", kind: "teaching" }], practiceCandidates: [] };

test("whole recording is the default and an explicit full request takes precedence over clips", () => {
  assert.equal(resolveTranscriptionMode(), "full_recording");
  assert.equal(resolveTranscriptionMode(true), "full_recording");
  assert.equal(resolveTranscriptionMode(false), "selected_segments");
});
test("ninety-minute and slightly-over-hour lessons produce complete bounded passage plans", () => {
  for (const seconds of [3601, 5400, 7200]) {
    const chunks = splitRangeIntoChunks({ startsAtSeconds: 0, endsAtSeconds: validateDuration(seconds), label: "Lesson" });
    assert.equal(chunks[0].startsAtSeconds, 0);
    assert.equal(chunks.at(-1)?.endsAtSeconds, seconds);
    assert.ok(chunks.every((chunk) => chunk.endsAtSeconds - chunk.startsAtSeconds <= 180));
    for (let i = 1; i < chunks.length; i++) assert.equal(chunks[i].startsAtSeconds, chunks[i - 1].endsAtSeconds);
  }
  for (const invalid of [0, -1, NaN, Infinity, 7201]) assert.throws(() => validateDuration(invalid));
});
test("job retry identity distinguishes same-length moved clips and changed sources", () => {
  const base = { lessonId: "lesson", recordingId: "recording", storageBucket: "store", storagePath: "immutable-version-one", mode: "selected_segments" as const, model: "unchanged-model", chunks: [{ segmentId: "clip", startsAtSeconds: 100, endsAtSeconds: 160, label: "Voicing" }] };
  assert.equal(transcriptionRequestKey(base), transcriptionRequestKey(structuredClone(base)));
  assert.notEqual(transcriptionRequestKey(base), transcriptionRequestKey({ ...base, chunks: [{ ...base.chunks[0], startsAtSeconds: 200, endsAtSeconds: 260 }] }));
  assert.notEqual(transcriptionRequestKey(base), transcriptionRequestKey({ ...base, storagePath: "immutable-version-two" }));
  assert.notEqual(transcriptionRequestKey(base), transcriptionRequestKey({ ...base, model: "different-model" }));
});
test("whole-recording identity is stable when background duration probing fills in the plan", () => {
  const base = { lessonId: "lesson", recordingId: "recording", storageBucket: "store", storagePath: "immutable-source", mode: "full_recording" as const, model: "same-model", chunks: [] };
  assert.equal(transcriptionRequestKey(base), transcriptionRequestKey({ ...base, chunks: splitRangeIntoChunks({ startsAtSeconds: 0, endsAtSeconds: 5400, label: "Lesson" }) }));
});
test("malformed JSON and missing arrays fail extraction instead of publishing an empty success", () => {
  for (const bad of ["not json", "null", "{}", "[]", JSON.stringify({ ...valid, summaryBullets: null }), JSON.stringify({ ...valid, summaryBullets: [{ title: "missing body" }] })]) assert.throws(() => parseLessonAnalysis(bad, evidence));
  const empty = parseLessonAnalysis(JSON.stringify({ overallSummary: "No intelligible teaching was found.", summaryBullets: [], practiceCandidates: [] }), evidence);
  assert.deepEqual(empty.summaryBullets, []);
});
test("learning point evidence uses known passage spans, never narrower model guesses", () => {
  const result = parseLessonAnalysis(JSON.stringify({ ...valid, summaryBullets: [{ ...valid.summaryBullets[0], startsAtSeconds: 3640, endsAtSeconds: 3650, evidenceText: "Let the melody breathe." }] }), evidence);
  assert.equal(result.summaryBullets[0].startsAtSeconds, 3600);
  assert.equal(result.summaryBullets[0].endsAtSeconds, 3780);
  assert.equal(result.summaryBullets[0].evidencePrecision, "approximate");
  assert.deepEqual(parseLessonAnalysis(JSON.stringify(result), evidence), result);
});
test("unknown references, out-of-bounds ranges and invented quotations reject the entire analysis", () => {
  for (const changes of [{ evidenceId: "unknown" }, { startsAtSeconds: -1 }, { endsAtSeconds: 9999 }, { startsAtSeconds: 3700, endsAtSeconds: 3699 }, { evidenceText: "Invented teaching quotation." }, { kind: "unknown" }]) {
    assert.throws(() => parseLessonAnalysis(JSON.stringify({ ...valid, summaryBullets: [{ ...valid.summaryBullets[0], ...changes }] }), evidence));
  }
});
test("practice suggestions require explicit task text and retain source provenance", () => {
  assert.throws(() => parseLessonAnalysis(JSON.stringify({ ...valid, practiceCandidates: valid.summaryBullets }), evidence));
  const result = parseLessonAnalysis(JSON.stringify({ ...valid, practiceCandidates: [{ ...valid.summaryBullets[0], suggestedPracticeNote: "Move this voicing through twelve keys." }] }), evidence);
  assert.equal(result.practiceCandidates[0].kind, "practice");
  assert.equal(result.practiceCandidates[0].startsAtSeconds, 3600);
});
