"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  Plus,
  Rows3,
  Upload,
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
  const router = useRouter();
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const attachCount = Object.values(choices).filter((choice) => choice === "attach")
    .length;
  const createCount = Object.values(choices).filter((choice) => choice === "create")
    .length;
  const hasLocalSuggestions = suggestions.length > 0;
  const allMatched =
    hasLocalSuggestions &&
    suggestions.every((suggestion) => suggestion.matchedPieceId);

  async function uploadSelectedFiles() {
    if (selectedFiles.length === 0) return;

    setUploadState("uploading");
    setUploadMessage("");

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("assets", file));

    const response = await fetch("/api/piece-assets/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setUploadState("error");
      setUploadMessage(body?.error ?? t("leadSheetsUploadFailed"));
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      imported?: { pieceTitle: string }[];
    } | null;
    const importedCount = body?.imported?.length ?? selectedFiles.length;

    setUploadState("done");
    setUploadMessage(`${importedCount} ${t("leadSheetsUploadComplete")}`);
    setSelectedFiles([]);
    setUploadInputKey((current) => current + 1);
    router.refresh();
  }

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
            {!hasLocalSuggestions
              ? t("uploadLeadSheets")
              : allMatched
                ? t("leadSheetsImported")
                : t("importComesNext")}
          </button>
        }
        title={t("leadSheetReview")}
      >
        <div className="mb-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-950">
                {t("uploadLeadSheets")}
              </span>
              <input
                accept="application/pdf,image/png,image/jpeg"
                className="mt-2 block w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-stone-700"
                key={uploadInputKey}
                multiple
                onChange={(event) => {
                  setSelectedFiles(Array.from(event.target.files ?? []));
                  setUploadState("idle");
                  setUploadMessage("");
                }}
                type="file"
              />
            </label>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                selectedFiles.length === 0 || uploadState === "uploading"
              }
              onClick={() => void uploadSelectedFiles()}
              type="button"
            >
              {uploadState === "uploading" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="h-4 w-4" />
              )}
              {t("importLeadSheets")}
            </button>
          </div>
          {selectedFiles.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone="blue">
                {selectedFiles.length} {t("selectedFiles")}
              </StatusPill>
              {selectedFiles.slice(0, 4).map((file) => (
                <span
                  className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600"
                  key={`${file.name}-${file.size}`}
                >
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
          {uploadMessage ? (
            <p
              className={cn(
                "mt-3 rounded-md border px-3 py-2 text-sm",
                uploadState === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
              )}
            >
              {uploadMessage}
            </p>
          ) : null}
        </div>

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
