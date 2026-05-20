import type { Piece, PieceStatus } from "./types";
import type { TranslationKey } from "./translations";

export type StatusTone = "green" | "blue" | "amber" | "rose" | "slate";

export function pieceStatusTranslationKey(status: PieceStatus): TranslationKey {
  if (status === "spine") return "maintenance";
  if (status === "learning") return "learning";
  if (status === "maintenance") return "maintenance";
  return "parked";
}

export function pieceStatusTone(status: PieceStatus): StatusTone {
  if (status === "spine") return "green";
  if (status === "learning") return "amber";
  if (status === "maintenance") return "green";
  return "slate";
}

export function pieceCreditLine(
  piece: Pick<Piece, "composer" | "lyricist">,
  labels: { composer: string; lyricist: string },
) {
  const credits = [
    piece.composer ? `${labels.composer}: ${piece.composer}` : null,
    piece.lyricist ? `${labels.lyricist}: ${piece.lyricist}` : null,
  ].filter((credit): credit is string => Boolean(credit));

  return credits.join(" / ");
}

export function tempoValueLabel(value: number) {
  return value > 0 ? String(value) : "-";
}

export function pieceTempoLabel(
  piece: Pick<Piece, "currentTempo" | "targetTempo">,
  bpmLabel: string,
) {
  if (piece.currentTempo <= 0 && piece.targetTempo <= 0) {
    return "-";
  }

  return `${tempoValueLabel(piece.currentTempo)}/${tempoValueLabel(
    piece.targetTempo,
  )} ${bpmLabel}`;
}
