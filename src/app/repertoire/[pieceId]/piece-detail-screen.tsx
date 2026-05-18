"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Music2,
  StickyNote,
} from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import {
  pieceCreditLine,
  pieceStatusTone,
  pieceStatusTranslationKey,
  tempoValueLabel,
} from "@/lib/piece-labels";

export function PieceDetailScreen({
  data,
  pieceId,
}: {
  data: PracticeLoopReadModel;
  pieceId: string;
}) {
  const { t } = useLanguage();
  const { exercises, pieceAssets, pieces, practiceTasks, recordings } = data;
  const piece = pieces.find((item) => item.id === pieceId);

  if (!piece) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-stone-700">{t("notYet")}</p>
      </div>
    );
  }

  const assets = pieceAssets.filter((asset) => asset.pieceId === piece.id);
  const pieceRecordings = recordings.filter(
    (recording) => recording.pieceId === piece.id,
  );
  const lessonTasks = practiceTasks.filter(
    (task) => task.linkedPieceId === piece.id,
  );
  const creditLine = pieceCreditLine(piece, {
    composer: t("composer"),
    lyricist: t("lyricist"),
  });

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
        href="/repertoire"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("repertoire")}
      </Link>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusPill tone="blue">{piece.key || "-"}</StatusPill>
              <StatusPill tone={pieceStatusTone(piece.status)}>
                {t(pieceStatusTranslationKey(piece.status))}
              </StatusPill>
            </div>
            <h1 className="text-3xl font-semibold text-stone-950">
              {piece.title}
            </h1>
            {creditLine ? (
              <p className="mt-2 text-xs lowercase text-stone-500">
                {creditLine}
              </p>
            ) : null}
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              {piece.notes}
            </p>
          </div>
          <div className="grid min-w-64 gap-3 rounded-lg bg-stone-50 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                {t("confidence")}
              </p>
              <div className="mt-2">
                <ConfidenceMeter value={piece.confidence} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-semibold text-stone-950">
                  {tempoValueLabel(piece.currentTempo)}
                </p>
                <p className="text-stone-500">{t("currentTempo")}</p>
              </div>
              <div>
                <p className="font-semibold text-stone-950">
                  {tempoValueLabel(piece.targetTempo)}
                </p>
                <p className="text-stone-500">{t("targetTempo")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Section title={t("leadSheet")}>
          <div className="space-y-3">
            {assets.length > 0 ? (
              assets.map((asset) => {
                const assetUrl = `/api/piece-assets/${asset.id}/file`;
                const isPdf = asset.type === "lead_sheet_pdf";
                const isImage = asset.type === "lead_sheet_image";

                return (
                  <div
                    className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                    key={asset.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <FileText
                          aria-hidden="true"
                          className="mt-1 h-5 w-5 text-emerald-800"
                        />
                        <div>
                          <h2 className="font-semibold text-stone-950">
                            {asset.title}
                          </h2>
                          <p className="mt-1 text-sm text-stone-500">
                            {asset.versionLabel} / {asset.uploadedAt}
                          </p>
                        </div>
                      </div>
                      {isPdf || isImage ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                          href={assetUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
                          {t("openPdf")}
                        </a>
                      ) : null}
                    </div>

                    {isPdf ? (
                      <div className="mt-4 h-[72vh] min-h-[520px] overflow-hidden rounded-lg border border-stone-300 bg-stone-50">
                        <iframe
                          className="h-full w-full"
                          src={assetUrl}
                          title={asset.title}
                        />
                      </div>
                    ) : isImage ? (
                      <div className="mt-4 overflow-hidden rounded-lg border border-stone-300 bg-stone-50">
                        <img
                          alt={asset.title}
                          className="h-auto w-full"
                          src={assetUrl}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
                        {t("leadSheetUnavailable")}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-sm">
                {t("notYet")}
              </div>
            )}
          </div>
        </Section>

        <div className="space-y-6">
          <Section title={t("lessonNotes")}>
            <div className="space-y-3">
              {lessonTasks.length > 0 ? (
                lessonTasks.map((task) => (
                  <div
                    className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                    key={task.id}
                  >
                    <div className="flex items-start gap-3">
                      <StickyNote
                        aria-hidden="true"
                        className="mt-1 h-5 w-5 text-amber-700"
                      />
                      <div>
                        <h2 className="font-semibold text-stone-950">
                          {task.title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-stone-600">
                          {task.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-sm">
                  {t("notYet")}
                </div>
              )}
            </div>
          </Section>

          <Section title={t("recordings")}>
            <div className="space-y-3">
              {pieceRecordings.length > 0 ? (
                pieceRecordings.map((recording) => (
                  <AudioStrip key={recording.id} title={recording.title} />
                ))
              ) : (
                <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600 shadow-sm">
                  {t("notYet")}
                </div>
              )}
            </div>
          </Section>

          <Section title={t("relatedExercises")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {piece.relatedExerciseIds.map((exerciseId) => {
                const exercise = exercises.find((item) => item.id === exerciseId);
                return exercise ? (
                  <div
                    className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                    key={exercise.id}
                  >
                    <div className="flex items-start gap-3">
                      <Music2
                        aria-hidden="true"
                        className="mt-1 h-5 w-5 text-emerald-800"
                      />
                      <div>
                        <h2 className="font-semibold text-stone-950">
                          {exercise.title}
                        </h2>
                        <p className="mt-1 text-sm text-stone-500">
                          {exercise.keyFocus}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
