import type { PracticeStatus } from "@/lib/types";

export type PracticeTaskRequestBody = {
  title?: unknown;
  body?: unknown;
  sourceLessonId?: unknown;
  linkedRecordingId?: unknown;
  startsAtSeconds?: unknown;
  endsAtSeconds?: unknown;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function parsePracticeTaskPayload(body: PracticeTaskRequestBody) {
  const title = optionalText(body.title);
  const sourceLessonId = optionalText(body.sourceLessonId);
  const linkedRecordingId = optionalText(body.linkedRecordingId);
  const startsAtSeconds = optionalNonNegativeInt(body.startsAtSeconds);
  const endsAtSeconds = optionalNonNegativeInt(body.endsAtSeconds);

  if (!title) {
    return { error: "Title is required." };
  }

  if (!sourceLessonId || !linkedRecordingId) {
    return { error: "Source lesson and linked recording are required." };
  }

  if (!isUuid(sourceLessonId) || !isUuid(linkedRecordingId)) {
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
      source: "lesson" as const,
      sourceLessonId,
      linkedRecordingId,
      startsAtSeconds,
      endsAtSeconds,
      status: "new" as PracticeStatus,
      importance: 3,
      resurfacingScore: "50",
      updatedAt: new Date().toISOString(),
    },
  };
}
