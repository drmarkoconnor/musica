import type { PracticeSource, PracticeStatus } from "@/lib/types";

export type PracticeTaskRequestBody = {
  title?: unknown;
  body?: unknown;
  source?: unknown;
  sourceLessonId?: unknown;
  linkedRecordingId?: unknown;
  linkedPieceId?: unknown;
  linkedExerciseId?: unknown;
  startsAtSeconds?: unknown;
  endsAtSeconds?: unknown;
  confidence?: unknown;
  importance?: unknown;
  targetFrequencyDays?: unknown;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function optionalNonNegativeInt(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
}

function optionalIntInRange(value: unknown, fallback: number, min: number, max: number) {
  if (value === "" || value === null || typeof value === "undefined") {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    return undefined;
  }

  return numberValue;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parsePracticeTaskPayload(body: PracticeTaskRequestBody) {
  const title = optionalText(body.title);
  const source = body.source === "manual" ? "manual" : "lesson";
  const sourceLessonId = optionalText(body.sourceLessonId);
  const linkedRecordingId = optionalText(body.linkedRecordingId);
  const linkedPieceId = optionalText(body.linkedPieceId);
  const linkedExerciseId = optionalText(body.linkedExerciseId);
  const startsAtSeconds = optionalNonNegativeInt(body.startsAtSeconds);
  const endsAtSeconds = optionalNonNegativeInt(body.endsAtSeconds);
  const confidence = optionalIntInRange(body.confidence, 3, 1, 5);
  const importance = optionalIntInRange(body.importance, 3, 1, 5);
  const targetFrequencyDays = optionalIntInRange(
    body.targetFrequencyDays,
    source === "lesson" ? 7 : 3,
    1,
    365,
  );

  if (!title) {
    return { error: "Title is required." };
  }

  if (typeof importance === "undefined") {
    return { error: "Importance must be between 1 and 5." };
  }

  if (typeof confidence === "undefined") {
    return { error: "Confidence must be between 1 and 5." };
  }

  if (typeof targetFrequencyDays === "undefined") {
    return { error: "Frequency must be between 1 and 365 days." };
  }

  if (linkedPieceId && !isUuid(linkedPieceId)) {
    return { error: "Linked piece ID must be a UUID." };
  }

  if (linkedExerciseId && !isUuid(linkedExerciseId)) {
    return { error: "Linked exercise ID must be a UUID." };
  }

  if (source === "lesson" && (!sourceLessonId || !linkedRecordingId)) {
    return { error: "Source lesson and linked recording are required." };
  }

  if (
    source === "lesson" &&
    sourceLessonId &&
    linkedRecordingId &&
    (!isUuid(sourceLessonId) || !isUuid(linkedRecordingId))
  ) {
    return { error: "Source lesson and linked recording IDs must be UUIDs." };
  }

  if (
    typeof startsAtSeconds === "undefined" ||
    typeof endsAtSeconds === "undefined"
  ) {
    return { error: "Timestamps must be whole seconds." };
  }

  if (
    startsAtSeconds !== null &&
    endsAtSeconds !== null &&
    endsAtSeconds < startsAtSeconds
  ) {
    return { error: "End timestamp must be after start timestamp." };
  }

  return {
    value: {
      title,
      body: optionalText(body.body),
      source: source as PracticeSource,
      sourceLessonId: source === "lesson" ? sourceLessonId : null,
      linkedRecordingId: source === "lesson" ? linkedRecordingId : null,
      linkedPieceId,
      linkedExerciseId,
      startsAtSeconds,
      endsAtSeconds,
      status: "new" as PracticeStatus,
      confidence,
      importance,
      targetFrequencyDays,
      resurfacingScore: "50",
      updatedAt: new Date().toISOString(),
    },
  };
}
