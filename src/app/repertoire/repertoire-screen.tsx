"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Edit3,
  Music2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Section } from "@/components/section";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import {
  pieceStatusTranslationKey,
  pieceTempoLabel,
} from "@/lib/piece-labels";
import type { Confidence, Piece, PieceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type PieceFormValues = {
  title: string;
  composer: string;
  lyricist: string;
  key: string;
  status: PieceStatus;
  confidence: Confidence;
  lastPractised: string;
  targetTempo: string;
  currentTempo: string;
  spotifyUrl: string;
  isSpineTune: boolean;
  notes: string;
};

const statusOptions: PieceStatus[] = ["learning", "maintenance", "parked"];

const confidenceSteps: Confidence[] = [1, 2, 3, 4, 5];

function sortByPracticeNeed(left: Piece, right: Piece) {
  const leftDate = left.lastPractised || "0000-00-00";
  const rightDate = right.lastPractised || "0000-00-00";

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  return left.title.localeCompare(right.title);
}

function emptyForm(): PieceFormValues {
  return {
    title: "",
    composer: "",
    lyricist: "",
    key: "",
    status: "learning",
    confidence: 3,
    lastPractised: "",
    targetTempo: "",
    currentTempo: "",
    spotifyUrl: "",
    isSpineTune: false,
    notes: "",
  };
}

function visiblePieceStatus(status: PieceStatus): PieceStatus {
  return status === "spine" ? "maintenance" : status;
}

function formFromPiece(piece: Piece): PieceFormValues {
  return {
    title: piece.title,
    composer: piece.composer ?? "",
    lyricist: piece.lyricist ?? "",
    key: piece.key,
    status: visiblePieceStatus(piece.status),
    confidence: piece.confidence,
    lastPractised: piece.lastPractised,
    targetTempo: piece.targetTempo ? String(piece.targetTempo) : "",
    currentTempo: piece.currentTempo ? String(piece.currentTempo) : "",
    spotifyUrl: piece.spotifyUrl ?? "",
    isSpineTune: piece.isSpineTune,
    notes: piece.notes,
  };
}

export function RepertoireScreen({
  data,
  isNeon,
}: {
  data: PracticeLoopReadModel;
  isNeon: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { pieces } = data;
  const activePieces = [...pieces]
    .filter((piece) => piece.status !== "parked")
    .sort(sortByPracticeNeed);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [formValues, setFormValues] = useState<PieceFormValues>(emptyForm);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [pieceActionState, setPieceActionState] = useState<
    "idle" | "archiving" | "deleting" | "archived" | "deleted" | "error"
  >("idle");
  const [inlineActionState, setInlineActionState] = useState<
    Record<string, "saving" | "error" | undefined>
  >({});
  const [errorMessage, setErrorMessage] = useState("");

  function openAddModal() {
    setIsModalOpen(true);
    setEditingPiece(null);
    setFormValues(emptyForm());
    setSaveState("idle");
    setPieceActionState("idle");
    setErrorMessage("");
  }

  function openEditModal(piece: Piece) {
    setIsModalOpen(true);
    setEditingPiece(piece);
    setFormValues(formFromPiece(piece));
    setSaveState("idle");
    setPieceActionState("idle");
    setErrorMessage("");
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPiece(null);
    setFormValues(emptyForm());
    setSaveState("idle");
    setPieceActionState("idle");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setErrorMessage("");

    const response = await fetch(
      editingPiece ? `/api/pieces/${editingPiece.id}` : "/api/pieces",
      {
        method: editingPiece ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveState("error");
      setErrorMessage(body?.error ?? t("saveFailed"));
      return;
    }

    setSaveState("saved");
    router.refresh();
    setTimeout(() => closeModal(), 250);
  }

  async function handleArchive(pieceToArchive = editingPiece) {
    if (!pieceToArchive) {
      return;
    }

    setPieceActionState("archiving");
    setErrorMessage("");

    const response = await fetch(`/api/pieces/${pieceToArchive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formFromPiece(pieceToArchive),
        status: "parked",
      }),
    });

    if (!response.ok) {
      setPieceActionState("error");
      setErrorMessage(t("saveFailed"));
      return;
    }

    setPieceActionState("archived");
    router.refresh();
    setTimeout(() => closeModal(), 250);
  }

  async function handleDelete() {
    if (!editingPiece || !window.confirm(t("confirmDeletePiece"))) {
      return;
    }

    setPieceActionState("deleting");
    setErrorMessage("");

    const response = await fetch(`/api/pieces/${editingPiece.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setPieceActionState("error");
      setErrorMessage(t("saveFailed"));
      return;
    }

    setPieceActionState("deleted");
    router.refresh();
    setTimeout(() => closeModal(), 250);
  }

  async function patchPieceInline(
    piece: Piece,
    updates: Partial<PieceFormValues>,
  ) {
    setInlineActionState((current) => ({ ...current, [piece.id]: "saving" }));
    setErrorMessage("");

    const response = await fetch(`/api/pieces/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formFromPiece(piece),
        ...updates,
      }),
    });

    if (!response.ok) {
      setInlineActionState((current) => ({ ...current, [piece.id]: "error" }));
      setErrorMessage(t("saveFailed"));
      return;
    }

    setInlineActionState((current) => ({ ...current, [piece.id]: undefined }));
    router.refresh();
  }

  function openPiece(pieceId: string) {
    router.push(`/repertoire/${pieceId}`);
  }

  return (
    <div className="space-y-8">
      <Section
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              href="/archive"
            >
              <Archive aria-hidden="true" className="h-4 w-4" />
              {t("archiveArea")}
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              onClick={openAddModal}
              type="button"
            >
              <Music2 aria-hidden="true" className="h-4 w-4" />
              {t("addPiece")}
            </button>
          </div>
        }
        title={t("repertoire")}
      >
        {isNeon ? (
          <p className="text-sm font-medium text-emerald-800">
            {t("readingFromNeon")}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(12rem,1.45fr)_4rem_7.5rem_8.5rem_9rem_7.5rem_6.5rem_5.5rem] gap-3 border-b border-stone-200 bg-stone-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 lg:grid">
            <span>{t("piece")}</span>
            <span>{t("musicalKey")}</span>
            <span>{t("spineTune")}</span>
            <span>{t("status")}</span>
            <span>{t("confidence")}</span>
            <span>{t("lastPractised")}</span>
            <span>{t("currentTempo")}</span>
            <span>{t("edit")}</span>
          </div>
          <div className="divide-y divide-stone-200 bg-stone-100">
            {activePieces.length > 0 ? (
              activePieces.map((piece, index) => {
                const isSaving = inlineActionState[piece.id] === "saving";
                const hasInlineError = inlineActionState[piece.id] === "error";

                return (
                  <div
                    aria-label={`${t("piece")}: ${piece.title}`}
                    className={cn(
                      "grid cursor-pointer gap-2 px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/30 lg:grid-cols-[minmax(12rem,1.45fr)_4rem_7.5rem_8.5rem_9rem_7.5rem_6.5rem_5.5rem] lg:items-center lg:gap-3",
                      index % 2 === 0 ? "bg-white" : "bg-stone-50",
                      "hover:bg-emerald-50/70",
                    )}
                    key={piece.id}
                    onClick={() => openPiece(piece.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openPiece(piece.id);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-stone-950">
                        {piece.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500 lg:hidden">
                        {piece.key || "-"} / {pieceTempoLabel(piece, t("bpm"))}
                      </span>
                    </div>

                    <span className="text-sm font-medium text-stone-700">
                      <span className="mr-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500 lg:hidden">
                        {t("musicalKey")}
                      </span>
                      {piece.key || "-"}
                    </span>

                    <button
                      aria-label={`${t("spineTune")}: ${piece.title}`}
                      aria-pressed={piece.isSpineTune}
                      className={cn(
                        "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                        piece.isSpineTune
                          ? "border-emerald-800 bg-emerald-950 text-white"
                          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100",
                      )}
                      disabled={isSaving}
                      onClick={(event) => {
                        event.stopPropagation();
                        void patchPieceInline(piece, {
                          isSpineTune: !piece.isSpineTune,
                        });
                      }}
                      title={t("spineTuneHelp")}
                      type="button"
                    >
                      <Star
                        aria-hidden="true"
                        className={cn("h-4 w-4", piece.isSpineTune ? "fill-current" : "")}
                      />
                      <span>{t("spine")}</span>
                    </button>

                    <label className="block">
                      <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500 lg:hidden">
                        {t("status")}
                      </span>
                      <select
                        className="h-8 w-full rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSaving}
                        onChange={(event) => {
                          event.stopPropagation();
                          void patchPieceInline(piece, {
                            status: event.target.value as PieceStatus,
                          });
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        value={visiblePieceStatus(piece.status)}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {t(pieceStatusTranslationKey(status))}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500 lg:hidden">
                        {t("confidence")}
                      </span>
                      <div className="flex items-end gap-1">
                        {confidenceSteps.map((step) => (
                          <button
                            aria-label={`${t("confidence")} ${step}`}
                            aria-pressed={piece.confidence === step}
                            className={cn(
                              "h-7 w-5 rounded-sm transition disabled:cursor-not-allowed disabled:opacity-60",
                              step <= piece.confidence
                                ? "bg-emerald-800 hover:bg-emerald-950"
                                : "bg-stone-200 hover:bg-stone-300",
                              step === 1 ? "h-3" : "",
                              step === 2 ? "h-4" : "",
                              step === 3 ? "h-5" : "",
                              step === 4 ? "h-6" : "",
                            )}
                            disabled={isSaving}
                            key={step}
                            onClick={(event) => {
                              event.stopPropagation();
                              void patchPieceInline(piece, { confidence: step });
                            }}
                            type="button"
                          />
                        ))}
                      </div>
                    </div>

                    <span className="text-sm font-medium text-stone-700">
                      <span className="mr-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500 lg:hidden">
                        {t("lastPractised")}
                      </span>
                      {piece.lastPractised || t("notYet")}
                    </span>

                    <span className="text-sm text-stone-600">
                      <span className="mr-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500 lg:hidden">
                        {t("currentTempo")}
                      </span>
                      {pieceTempoLabel(piece, t("bpm"))}
                    </span>

                    <div className="flex gap-1.5">
                      <button
                        aria-label={`${t("editPiece")}: ${piece.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(piece);
                        }}
                        type="button"
                      >
                        <Edit3 aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`${t("archivePiece")}: ${piece.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleArchive(piece);
                        }}
                        type="button"
                      >
                        <Archive aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>

                    {hasInlineError ? (
                      <p className="text-xs font-medium text-rose-700 lg:col-span-8">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-6 text-sm text-stone-600">
                {t("notYet")}
              </div>
            )}
          </div>
        </div>
      </Section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">
                  {editingPiece ? t("editPiece") : t("addPiece")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("readingFromNeon")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={closeModal}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("title")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                    value={formValues.title}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("musicalKey")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        key: event.target.value,
                      }))
                    }
                    value={formValues.key}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("composer")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        composer: event.target.value,
                      }))
                    }
                    value={formValues.composer}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("lyricist")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        lyricist: event.target.value,
                      }))
                    }
                    value={formValues.lyricist}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("status")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        status: event.target.value as PieceStatus,
                      }))
                    }
                    value={formValues.status}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {t(pieceStatusTranslationKey(status))}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("confidence")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        confidence: Number(event.target.value) as Confidence,
                      }))
                    }
                    value={formValues.confidence}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("lastPractised")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        lastPractised: event.target.value,
                      }))
                    }
                    type="date"
                    value={formValues.lastPractised}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("currentTempo")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    min="1"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        currentTempo: event.target.value,
                      }))
                    }
                    type="number"
                    value={formValues.currentTempo}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("targetTempo")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    min="1"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        targetTempo: event.target.value,
                      }))
                    }
                    type="number"
                    value={formValues.targetTempo}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("spotify")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        spotifyUrl: event.target.value,
                      }))
                    }
                    value={formValues.spotifyUrl}
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <input
                  checked={formValues.isSpineTune}
                  className="h-4 w-4 accent-emerald-900"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      isSpineTune: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span className="text-sm font-medium text-stone-800">
                  {t("isSpineTune")}
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("notes")}
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  value={formValues.notes}
                />
              </label>

              {saveState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              {pieceActionState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              {saveState === "saved" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("saved")}
                </p>
              ) : null}

              {pieceActionState === "archived" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("archived")}
                </p>
              ) : null}

              {pieceActionState === "deleted" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("deleted")}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {editingPiece ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        pieceActionState === "archiving" ||
                        pieceActionState === "deleting" ||
                        editingPiece.status === "parked"
                      }
                      onClick={() => void handleArchive()}
                      type="button"
                    >
                      <Archive aria-hidden="true" className="h-4 w-4" />
                      {pieceActionState === "archiving" ? t("saving") : t("archive")}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={
                        pieceActionState === "archiving" ||
                        pieceActionState === "deleting"
                      }
                      onClick={handleDelete}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {pieceActionState === "deleting" ? t("saving") : t("delete")}
                    </button>
                  </div>
                ) : (
                  <span />
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                    onClick={closeModal}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saveState === "saving"}
                    type="submit"
                  >
                    {saveState === "saving" ? t("saving") : t("save")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
