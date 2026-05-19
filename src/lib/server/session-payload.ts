import type { Confidence, SessionItemStatus } from "@/lib/types";

export type SessionItemRequestBody = {
  confidence?: unknown;
  exerciseId?: unknown;
  minutes?: unknown;
  pieceId?: unknown;
  reason?: unknown;
  taskId?: unknown;
  tempo?: unknown;
  title?: unknown;
};

export type SessionItemUpdateBody = {
  actualSeconds?: unknown;
  confidenceAfter?: unknown;
  notes?: unknown;
  status?: unknown;
};

export const sessionItemStatuses = new Set<SessionItemStatus>([
  "accepted",
  "done",
  "queued",
  "replaced",
  "skipped",
]);

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function optionalUuid(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  return typeof value === "string" && isUuid(value) ? value : undefined;
}

export function intInRange(
  value: unknown,
  fallback: number | null,
  min: number,
  max: number,
) {
  if (value === "" || value === null || typeof value === "undefined") {
    return fallback;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    return undefined;
  }

  return numberValue;
}

export function parseSessionItemPayload(
  item: SessionItemRequestBody,
  position: number,
) {
  const title = optionalText(item.title);
  const practiceTaskId = optionalUuid(item.taskId);
  const pieceId = optionalUuid(item.pieceId);
  const exerciseId = optionalUuid(item.exerciseId);
  const plannedMinutes = intInRange(item.minutes, 10, 1, 180);
  const confidenceBefore = intInRange(item.confidence, null, 1, 5);
  const tempo = intInRange(item.tempo, null, 1, 320);

  if (!title) {
    return { error: "Title is required." };
  }

  if (
    typeof practiceTaskId === "undefined" ||
    typeof pieceId === "undefined" ||
    typeof exerciseId === "undefined"
  ) {
    return { error: "Linked item ID is invalid." };
  }

  if (typeof plannedMinutes === "undefined") {
    return { error: "Minutes must be between 1 and 180." };
  }

  if (typeof confidenceBefore === "undefined") {
    return { error: "Confidence must be between 1 and 5." };
  }

  if (typeof tempo === "undefined") {
    return { error: "Tempo must be between 1 and 320." };
  }

  return {
    value: {
      confidenceBefore: confidenceBefore as Confidence | null,
      exerciseId,
      pieceId,
      plannedMinutes,
      position,
      practiceTaskId,
      queueReason: optionalText(item.reason),
      status: "accepted" as SessionItemStatus,
      tempo,
      title,
    },
  };
}
