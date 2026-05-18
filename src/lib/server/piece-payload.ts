import type { PieceStatus } from "@/lib/types";

const pieceStatuses: PieceStatus[] = [
  "spine",
  "learning",
  "maintenance",
  "parked",
];

export type PieceRequestBody = {
  title?: unknown;
  composer?: unknown;
  lyricist?: unknown;
  key?: unknown;
  status?: unknown;
  confidence?: unknown;
  lastPractised?: unknown;
  targetTempo?: unknown;
  currentTempo?: unknown;
  spotifyUrl?: unknown;
  isSpineTune?: unknown;
  notes?: unknown;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function optionalPositiveInt(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return undefined;
  }

  return numberValue;
}

export function parsePiecePayload(body: PieceRequestBody) {
  const title = optionalText(body.title);

  if (!title) {
    return { error: "Title is required." };
  }

  const status =
    typeof body.status === "string" &&
    pieceStatuses.includes(body.status as PieceStatus)
      ? (body.status as PieceStatus)
      : "learning";

  const confidenceValue = Number(body.confidence);
  const confidence =
    Number.isInteger(confidenceValue) && confidenceValue >= 1 && confidenceValue <= 5
      ? confidenceValue
      : 3;

  const targetTempo = optionalPositiveInt(body.targetTempo);
  const currentTempo = optionalPositiveInt(body.currentTempo);

  if (typeof targetTempo === "undefined" || typeof currentTempo === "undefined") {
    return { error: "Tempo values must be positive whole numbers." };
  }

  const lastPractised = optionalText(body.lastPractised);

  if (lastPractised && !/^\d{4}-\d{2}-\d{2}$/.test(lastPractised)) {
    return { error: "Last practised must be a YYYY-MM-DD date." };
  }

  return {
    value: {
      title,
      composer: optionalText(body.composer),
      lyricist: optionalText(body.lyricist),
      musicalKey: optionalText(body.key),
      status,
      confidence,
      lastPractisedOn: lastPractised,
      targetTempo,
      currentTempo,
      spotifyUrl: optionalText(body.spotifyUrl),
      isSpineTune: Boolean(body.isSpineTune),
      notes: optionalText(body.notes),
      updatedAt: new Date().toISOString(),
    },
  };
}
