"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, RotateCcw, Trash2 } from "lucide-react";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import {
  pieceCreditLine,
  pieceStatusTone,
  pieceStatusTranslationKey,
  pieceTempoLabel,
} from "@/lib/piece-labels";
import type { Piece, PieceStatus } from "@/lib/types";

function piecePayload(piece: Piece, status: PieceStatus) {
  return {
    title: piece.title,
    composer: piece.composer ?? "",
    lyricist: piece.lyricist ?? "",
    key: piece.key,
    status,
    confidence: piece.confidence,
    lastPractised: piece.lastPractised,
    targetTempo: piece.targetTempo ? String(piece.targetTempo) : "",
    currentTempo: piece.currentTempo ? String(piece.currentTempo) : "",
    spotifyUrl: piece.spotifyUrl ?? "",
    isSpineTune: piece.isSpineTune,
    notes: piece.notes,
  };
}

export function ArchiveScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const archivedPieces = data.pieces.filter((piece) => piece.status === "parked");
  const [busyPieceId, setBusyPieceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function restorePiece(piece: Piece) {
    setBusyPieceId(piece.id);
    setErrorMessage("");

    const response = await fetch(`/api/pieces/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(piecePayload(piece, "maintenance")),
    });

    if (!response.ok) {
      setErrorMessage(t("saveFailed"));
      setBusyPieceId(null);
      return;
    }

    router.refresh();
    setBusyPieceId(null);
  }

  async function deletePiece(piece: Piece) {
    if (!window.confirm(t("confirmDeletePiece"))) {
      return;
    }

    setBusyPieceId(piece.id);
    setErrorMessage("");

    const response = await fetch(`/api/pieces/${piece.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setErrorMessage(t("saveFailed"));
      setBusyPieceId(null);
      return;
    }

    router.refresh();
    setBusyPieceId(null);
  }

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
        href="/repertoire"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("repertoire")}
      </Link>

      <Section title={t("archiveArea")}>
        {errorMessage ? (
          <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {archivedPieces.length > 0 ? (
            archivedPieces.map((piece) => {
              const creditLine = pieceCreditLine(piece, {
                composer: t("composer"),
                lyricist: t("lyricist"),
              });
              const isBusy = busyPieceId === piece.id;

              return (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                  key={piece.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="font-semibold text-stone-950 hover:text-emerald-800"
                          href={`/repertoire/${piece.id}`}
                        >
                          {piece.title}
                        </Link>
                        <StatusPill tone={pieceStatusTone(piece.status)}>
                          {t(pieceStatusTranslationKey(piece.status))}
                        </StatusPill>
                      </div>
                      {creditLine ? (
                        <p className="mt-1 text-xs lowercase text-stone-500">
                          {creditLine}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      aria-label={`${t("repertoire")}: ${piece.title}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100"
                      href={`/repertoire/${piece.id}`}
                    >
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="font-semibold text-stone-950">
                        {piece.key || "-"}
                      </p>
                      <p className="text-stone-500">{t("musicalKey")}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-stone-950">
                        {pieceTempoLabel(piece, t("bpm"))}
                      </p>
                      <p className="text-stone-500">{t("currentTempo")}</p>
                    </div>
                    <div>
                      <ConfidenceMeter value={piece.confidence} />
                      <p className="mt-1 text-stone-500">{t("confidence")}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => void restorePiece(piece)}
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                      {isBusy ? t("saving") : t("restore")}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => void deletePiece(piece)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {t("delete")}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-sm">
              {t("notYet")}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
