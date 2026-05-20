"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Link2, Mic2, MessageSquareText, Radio, Trash2 } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import { formatDuration } from "@/lib/utils";

function practiceRecordingAudioSrc(recording: { id: string; storageBucket: string }) {
  if (
    recording.storageBucket === "local-practice-audio" ||
    recording.storageBucket === "netlify-blobs"
  ) {
    return `/api/practice-recordings/${recording.id}/file`;
  }

  return undefined;
}

export function RecordingsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { exercises, lessonRecordings, lessons, pieces, recordings } = data;
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const sortedLessonRecordings = [...lessonRecordings].sort((left, right) =>
    right.recordedAt.localeCompare(left.recordedAt),
  );
  const practiceRecordings = recordings
    .filter((item) => item.kind !== "lesson")
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));

  async function deleteRecording(recordingId: string, kind: "lesson" | "practice") {
    const pendingId = `${kind}:${recordingId}`;

    setSavingId(pendingId);
    setErrorMessage("");

    const response = await fetch(
      kind === "lesson"
        ? `/api/lesson-recordings/${recordingId}`
        : `/api/practice-recordings/${recordingId}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setErrorMessage(body?.error ?? t("saveFailed"));
      setSavingId("");
      return;
    }

    setPendingDeleteId("");
    setSavingId("");
    router.refresh();
  }

  async function linkPracticeRecording(recordingId: string, pieceId: string) {
    const pendingId = `practice:${recordingId}`;

    setSavingId(pendingId);
    setErrorMessage("");

    const response = await fetch(`/api/practice-recordings/${recordingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pieceId }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setErrorMessage(body?.error ?? t("saveFailed"));
      setSavingId("");
      return;
    }

    setSavingId("");
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title={t("lessonRecordings")}>
        {errorMessage ? (
          <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {errorMessage}
          </p>
        ) : null}
        <div className="space-y-3">
          {sortedLessonRecordings.map((recording) => {
            const lesson = lessons.find((item) => item.id === recording.lessonId);
            const pendingId = `lesson:${recording.id}`;
            const isConfirmingDelete = pendingDeleteId === pendingId;
            const isSaving = savingId === pendingId;

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={recording.id}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
                      <Mic2 aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-stone-950">
                        {recording.title}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {lesson?.title ?? t("notYet")}
                      </p>
                    </div>
                  </div>
                  <StatusPill tone="blue">{t("lessons")}</StatusPill>
                </div>
                <AudioStrip
                  audioSrc={`/api/lesson-recordings/${recording.id}/file`}
                  title={recording.title}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-stone-500">
                    {formatDuration(recording.durationSeconds)} /{" "}
                    {new Date(recording.recordedAt).toLocaleDateString()}
                  </span>
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(savingId)}
                    onClick={() => setPendingDeleteId(pendingId)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    {t("delete")}
                  </button>
                </div>
                {isConfirmingDelete ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                    <span className="font-medium">
                      {t("confirmDeleteRecording")}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() => void deleteRecording(recording.id, "lesson")}
                        type="button"
                      >
                        {isSaving ? t("saving") : t("delete")}
                      </button>
                      <button
                        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                        disabled={isSaving}
                        onClick={() => setPendingDeleteId("")}
                        type="button"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {sortedLessonRecordings.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
              {t("notYet")}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title={t("practiceRecordings")}>
        <div className="space-y-3">
          {practiceRecordings.map((recording) => {
            const piece = recording.pieceId
              ? pieces.find((item) => item.id === recording.pieceId)
              : null;
            const exercise = recording.exerciseId
              ? exercises.find((item) => item.id === recording.exerciseId)
              : null;
            const pendingId = `practice:${recording.id}`;
            const isConfirmingDelete = pendingDeleteId === pendingId;
            const isSaving = savingId === pendingId;

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={recording.id}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-900">
                      <Radio aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-stone-950">
                        {recording.title}
                      </h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {piece?.title ?? exercise?.title ?? t("notYet")}
                      </p>
                    </div>
                  </div>
                  <StatusPill
                    tone={recording.kind === "voice_note" ? "amber" : "green"}
                  >
                    {recording.kind}
                  </StatusPill>
                </div>
                <AudioStrip
                  audioSrc={practiceRecordingAudioSrc(recording)}
                  title={recording.title}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <label className="flex min-w-0 items-center gap-2">
                    <Link2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-stone-500"
                    />
                    <select
                      aria-label={t("linkToPiece")}
                      className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={Boolean(savingId)}
                      onChange={(event) =>
                        void linkPracticeRecording(
                          recording.id,
                          event.target.value,
                        )
                      }
                      value={recording.pieceId ?? ""}
                    >
                      <option value="">{t("linkToPiece")}</option>
                      {pieces.map((pieceOption) => (
                        <option key={pieceOption.id} value={pieceOption.id}>
                          {pieceOption.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    {piece ? (
                      <Link
                        className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                        href={`/repertoire/${piece.id}`}
                      >
                        {t("piece")}
                      </Link>
                    ) : null}
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={Boolean(savingId)}
                      onClick={() => setPendingDeleteId(pendingId)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {t("delete")}
                    </button>
                  </div>
                </div>
                {isConfirmingDelete ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                    <span className="font-medium">
                      {t("confirmDeleteRecording")}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() =>
                          void deleteRecording(recording.id, "practice")
                        }
                        type="button"
                      >
                        {isSaving ? t("saving") : t("delete")}
                      </button>
                      <button
                        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                        disabled={isSaving}
                        onClick={() => setPendingDeleteId("")}
                        type="button"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
                {recording.spokenNote ? (
                  <div className="mt-4 flex items-start gap-3 rounded-lg bg-stone-50 p-3">
                    <MessageSquareText
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 text-stone-500"
                    />
                    <p className="text-sm leading-6 text-stone-700">
                      {recording.spokenNote}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
          {practiceRecordings.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
              {t("notYet")}
            </p>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
