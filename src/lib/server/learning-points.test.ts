import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLearningPointId,
  LearningPointError,
  mapLearningPoint,
  parseLearningPointPractice,
  parseLearningPointUpdate,
} from "./learning-points";
import { PATCH } from "@/app/api/learning-points/[id]/route";
import { POST } from "@/app/api/learning-points/[id]/practice/route";

const pointId = "fac74130-4d40-4096-b17e-1fd28393bfc2";

test("keeping or dismissing an insight does not imply a practice action", () => {
  assert.deepEqual(parseLearningPointUpdate({ status: "kept" }), { status: "kept" });
  assert.deepEqual(parseLearningPointUpdate({ status: "discarded" }), { status: "discarded" });
  assert.deepEqual(parseLearningPointUpdate({ status: "candidate" }), { status: "candidate" });
});

test("edits accept teaching text independently of an optional practice action", () => {
  assert.deepEqual(parseLearningPointUpdate({
    title: "  Keep the phrase moving  ",
    body: "  A shorter note can carry the phrase into the next bar.  ",
    practiceAction: null,
  }), {
    title: "Keep the phrase moving",
    body: "A shorter note can carry the phrase into the next bar.",
    practiceAction: null,
  });
});

test("malformed edits and attempts to replace source evidence are rejected", () => {
  const badInputs: unknown[] = [
    null, [], "kept", {}, { status: "complete" }, { title: " " },
    { body: null }, { practiceAction: 42 }, { title: "x".repeat(241) },
    { body: "x".repeat(12001) }, { practiceAction: "x".repeat(6001) },
    { status: "kept", recordingId: pointId }, { startsAtSeconds: 0 },
    { evidenceText: "Invented quote" }, { practiceTaskId: pointId },
  ];
  for (const value of badInputs) {
    assert.throws(() => parseLearningPointUpdate(value), (error: unknown) =>
      error instanceof LearningPointError && error.status === 400,
    );
  }
});

test("practice creation accepts a stored suggestion or a specific user action", () => {
  assert.deepEqual(parseLearningPointPractice({}), {});
  assert.deepEqual(parseLearningPointPractice({ practiceAction: "  Play two bars slowly.  " }), {
    practiceAction: "Play two bars slowly.",
  });
  for (const value of [null, [], { practiceAction: "" }, { practiceAction: null }, { title: "Override" }]) {
    assert.throws(() => parseLearningPointPractice(value), LearningPointError);
  }
});

test("database mapping preserves recording provenance and nullable optional fields", () => {
  const point = mapLearningPoint({
    id: pointId,
    lessonId: "7657aeaa-2d8f-4187-a2f0-6afebd3f51db",
    recordingId: "49e5a913-46a0-4455-bfaf-b0a562383f45",
    analysisRunId: null,
    sourceKey: "teaching:2",
    title: "Keep the pulse steady",
    body: "The pulse continues through the rest.",
    kind: "teaching",
    practiceAction: null,
    startsAtSeconds: 3610,
    endsAtSeconds: 3645,
    evidencePrecision: "approximate",
    evidenceText: "Keep feeling the beat there.",
    status: "kept",
    practiceTaskId: null,
    createdAt: "2026-09-13T14:00:00Z",
    updatedAt: "2026-09-13T14:05:00Z",
  });
  assert.equal(point.startsAtSeconds, 3610);
  assert.equal(point.endsAtSeconds, 3645);
  assert.equal(point.evidencePrecision, "approximate");
  assert.equal(point.evidenceText, "Keep feeling the beat there.");
  assert.equal(point.practiceTaskId, undefined);
  assert.equal(point.practiceAction, undefined);
  assert.equal(point.analysisRunId, undefined);
});

test("the update and practice endpoints reject bad payloads before database access", async () => {
  for (const handler of [PATCH, POST]) {
    const invalidId = await handler(new Request("http://localhost/api/learning-points/bad", {
      method: handler === PATCH ? "PATCH" : "POST",
      body: "{}",
    }), { params: Promise.resolve({ id: "bad" }) });
    assert.equal(invalidId.status, 400);

    for (const body of ["null", "[]", "{broken", '{"recordingId":"override"}']) {
      const response = await handler(new Request(`http://localhost/api/learning-points/${pointId}`, {
        method: handler === PATCH ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }), { params: Promise.resolve({ id: pointId }) });
      assert.equal(response.status, 400);
    }
  }
});

test("learning point identifiers must be complete UUIDs", () => {
  assert.equal(isLearningPointId(pointId), true);
  assert.equal(isLearningPointId("lesson-1"), false);
  assert.equal(isLearningPointId(`${pointId}; drop table learning_points`), false);
});
