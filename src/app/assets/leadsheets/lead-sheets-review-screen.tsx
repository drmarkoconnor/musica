"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  Plus,
  Rows3,
} from "lucide-react";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { LeadSheetSuggestion } from "@/lib/lead-sheet-types";
import { useLanguage } from "@/lib/language";
import { pieceCreditLine } from "@/lib/piece-labels";
import { cn } from "@/lib/utils";

type Choice = LeadSheetSuggestion["suggestedAction"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

export function LeadSheetsReviewScreen({
  suggestions,
}: {
  suggestions: LeadSheetSuggestion[];
}) {
  const { t } = useLanguage();
  const initialChoices = useMemo(
    () =>
      Object.fromEntries(
        suggestions.map((suggestion) => [
          suggestion.filename,
          suggestion.suggestedAction,
        ]),
      ) as Record<string, Choice>,
    [suggestions],
  );
  const [choices, setChoices] = useState(initialChoices);
  const attachCount = Object.values(choices).filter((choice) => choice === "attach")
    .length;
  const createCount = Object.values(choices).filter((choice) => choice === "create")
    .length;
  const allMatched = suggestions.every((suggestion) => suggestion.matchedPieceId);

  return (
    <div className="space-y-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
        href="/assets"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("assets")}
      </Link>

      <Section
        action={
          <button
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-500"
            disabled
            type="button"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {allMatched ? t("leadSheetsImported") : t("importComesNext")}
          </button>
        }
        title={t("leadSheetReview")}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <StatusPill tone="blue">
            {attachCount} {t("attachToExisting")}
          </StatusPill>
          <StatusPill tone="green">
            {createCount} {t("createPiece")}
          </StatusPill>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {suggestions.map((suggestion) => {
            const selectedChoice = choices[suggestion.filename];
            const creditLine = pieceCreditLine(suggestion, {
              composer: t("composer"),
              lyricist: t("lyricist"),
            });

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={suggestion.filename}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
                    <FileText aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-stone-950">
                        {suggestion.suggestedTitle}
                      </h2>
                      <StatusPill
                        tone={
                          suggestion.suggestedAction === "attach" ? "blue" : "green"
                        }
                      >
                        {suggestion.suggestedAction === "attach"
                          ? t("attachToExisting")
                          : t("createPiece")}
                      </StatusPill>
                    </div>
                    {creditLine ? (
                      <p className="mt-1 text-xs lowercase text-stone-500">
                        {creditLine}
                      </p>
                    ) : null}
                    <p className="mt-2 break-words text-sm text-stone-600">
                      {suggestion.filename}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="font-semibold text-stone-950">
                      {formatFileSize(suggestion.fileSizeBytes)}
                    </p>
                    <p className="text-stone-500">{t("fileSize")}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-950">
                      {suggestion.pageCount ?? "-"}
                    </p>
                    <p className="text-stone-500">{t("pages")}</p>
                  </div>
                  <div>
                    <p className="truncate font-semibold text-stone-950">
                      {suggestion.matchedPieceTitle ?? "-"}
                    </p>
                    <p className="text-stone-500">{t("matchedPiece")}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {allMatched && suggestion.matchedPieceId ? (
                    <Link
                      className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                      href={`/repertoire/${suggestion.matchedPieceId}`}
                    >
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                      {t("repertoire")}
                    </Link>
                  ) : (
                    <>
                      <button
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition",
                          selectedChoice === "attach"
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-stone-300 text-stone-700 hover:bg-stone-100",
                          !suggestion.matchedPieceId &&
                            "cursor-not-allowed opacity-50 hover:bg-transparent",
                        )}
                        disabled={!suggestion.matchedPieceId}
                        onClick={() =>
                          setChoices((current) => ({
                            ...current,
                            [suggestion.filename]: "attach",
                          }))
                        }
                        type="button"
                      >
                        <Rows3 aria-hidden="true" className="h-4 w-4" />
                        {t("attachToExisting")}
                      </button>
                      <button
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition",
                          selectedChoice === "create"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-stone-300 text-stone-700 hover:bg-stone-100",
                        )}
                        onClick={() =>
                          setChoices((current) => ({
                            ...current,
                            [suggestion.filename]: "create",
                          }))
                        }
                        type="button"
                      >
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        {t("createPiece")}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
