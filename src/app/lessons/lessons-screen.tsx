"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, Plus, Trash2, Upload, X } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { LessonClipMarker } from "@/components/lesson-clip-marker";
import { LessonRecorder } from "@/components/lesson-recorder";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import { TeachingTranscriptReview } from "@/components/teaching-transcript-review";
import { TranscriptionGate } from "@/components/transcription-password-modal";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import {
  TEST_LESSON_FIXTURE_ID,
  TEST_LESSON_FIXTURE_STORAGE_PATH,
} from "@/lib/teaching-review";

type LessonFormValues = {
  title: string;
  teacher: string;
  lessonDate: string;
  summary: string;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLessonForm(): LessonFormValues {
  return {
    title: "",
    teacher: "Leo",
    lessonDate: todayDate(),
    summary: "",
  };
}

function transcriptBulletItems(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function summaryBulletItems(text: string) {
  return text
    .split(/\n+/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function audioSrcForRecording(recording?: { id: string; storageBucket: string }) {
  if (
    recording?.storageBucket === "local-test-audio" ||
    recording?.storageBucket === "local-lesson-audio" ||
    recording?.storageBucket === "netlify-blobs"
  ) {
    return `/api/lesson-recordings/${recording.id}/file`;
  }

  return undefined;
}

export function LessonsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { lessonExtracts, lessonRecordings, lessons, transcripts } = data;
  const sortedLessons = [...lessons].sort((a, b) =>
    (
      lessonRecordings.find((item) => item.lessonId === b.id)?.recordedAt ??
      b.lessonDate
    ).localeCompare(
      lessonRecordings.find((item) => item.lessonId === a.id)?.recordedAt ??
        a.lessonDate,
    ),
  );
  const [selectedLessonId, setSelectedLessonId] = useState(
    sortedLessons[0]?.id ?? "",
  );
  const activeLesson =
    sortedLessons.find((lesson) => lesson.id === selectedLessonId) ??
    sortedLessons[0];
  const recordingsForActiveLesson = activeLesson
    ? lessonRecordings
        .filter((item) => item.lessonId === activeLesson.id)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    : [];
  const recording = recordingsForActiveLesson.at(-1);
  const recordingAudioSrc = audioSrcForRecording(recording);
  const isTestAudioRecording =
    recording?.storagePath === TEST_LESSON_FIXTURE_STORAGE_PATH;
  const lessonTranscripts = activeLesson
    ? transcripts.filter((item) => item.lessonId === activeLesson.id)
    : [];
  const transcript = lessonTranscripts[0];
  const extracts = activeLesson
    ? lessonExtracts.filter((item) => item.lessonId === activeLesson.id)
    : [];
  const joinedTranscriptText = lessonTranscripts.map((item) => item.text).join("\n");
  const executiveSummaryItems = summaryBulletItems(activeLesson?.summary ?? "");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<LessonFormValues>(emptyLessonForm);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [attachState, setAttachState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [extractActionState, setExtractActionState] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});
  const [errorMessage, setErrorMessage] = useState("");

  function openModal() {
    setIsModalOpen(true);
    setFormValues(emptyLessonForm());
    setSaveState("idle");
    setErrorMessage("");
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormValues(emptyLessonForm());
    setSaveState("idle");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setErrorMessage("");

    const response = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    });

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

  async function handleAttachTestAudio() {
    if (!activeLesson) return;

    setAttachState("saving");
    const response = await fetch("/api/lesson-recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: activeLesson.id,
        fixtureId: TEST_LESSON_FIXTURE_ID,
      }),
    });

    if (!response.ok) {
      setAttachState("error");
      return;
    }

    setAttachState("saved");
    router.refresh();
  }

  async function handleExtractAction(
    extractId: string,
    action: "keep" | "discard",
  ) {
    setExtractActionState((current) => ({ ...current, [extractId]: "saving" }));

    const response = await fetch(`/api/lesson-extracts/${extractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setExtractActionState((current) => ({ ...current, [extractId]: "error" }));
      return;
    }

    setExtractActionState((current) => ({ ...current, [extractId]: "saved" }));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                {t("lessons")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-stone-950">
                {activeLesson?.title ?? t("notYet")}
              </h1>
              {activeLesson ? (
                <p className="mt-2 text-sm text-stone-600">
                  {activeLesson.lessonDate} / {activeLesson.teacher}
                </p>
              ) : null}
            </div>
            {activeLesson ? (
              <StatusPill tone="green">{activeLesson.status}</StatusPill>
            ) : null}
          </div>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-stone-600">
            {activeLesson?.summary || t("notYet")}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              className="w-full"
              onClick={openModal}
              type="button"
            >
              <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900">
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("createLesson")}
              </span>
            </button>
            <LessonRecorder
              lessonId={activeLesson?.id}
              onSaved={(lessonId) => {
                setSelectedLessonId(lessonId);
                router.refresh();
              }}
            />
            <ComingSoonButton className="min-h-12 w-full py-3" icon={Upload}>
              {t("uploadAudio")}
            </ComingSoonButton>
          </div>
          <div className="mt-6 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-950">
                {t("lessonHistory")}
              </h2>
              <span className="text-xs font-medium text-stone-500">
                {sortedLessons.length}
              </span>
            </div>
            <div className="mt-3 max-h-80 divide-y divide-stone-200 overflow-y-auto rounded-md border border-stone-200">
              {sortedLessons.map((lesson) => {
                const recordingCount = lessonRecordings.filter(
                  (item) => item.lessonId === lesson.id,
                ).length;
                const extractCount = lessonExtracts.filter(
                  (item) =>
                    item.lessonId === lesson.id && item.status !== "discarded",
                ).length;
                const isSelected = activeLesson?.id === lesson.id;

                return (
                  <button
                    className={`grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left transition ${
                      isSelected ? "bg-emerald-50" : "bg-white hover:bg-stone-50"
                    }`}
                    key={lesson.id}
                    onClick={() => setSelectedLessonId(lesson.id)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-stone-950">
                        {lesson.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {lesson.lessonDate} / {lesson.teacher || t("notYet")}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 text-xs text-stone-500">
                      <span>
                        {recordingCount} {t("clips")}
                      </span>
                      <span>
                        {extractCount} {t("practiceElement")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-950">
                {recording ? t("latestClip") : t("recordings")}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {recording?.storagePath}
              </p>
            </div>
            <StatusPill tone="blue">{t("ready")}</StatusPill>
          </div>
          {recording ? (
            <AudioStrip audioSrc={recordingAudioSrc} title={recording.title} />
          ) : null}
          {recordingsForActiveLesson.length > 1 ? (
            <div className="space-y-2">
              {recordingsForActiveLesson.map((item, index) => (
                <div
                  className="rounded-md border border-stone-200 p-2"
                  key={item.id}
                >
                  <AudioStrip
                    audioSrc={audioSrcForRecording(item)}
                    title={`${t("recordings")} ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          ) : null}
          {!recording && activeLesson ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={attachState === "saving"}
              onClick={() => void handleAttachTestAudio()}
              type="button"
            >
              <Upload aria-hidden="true" className="h-4 w-4" />
              {attachState === "saving"
                ? t("saving")
                : attachState === "saved"
                  ? t("audioAttached")
                  : t("attachTestAudio")}
            </button>
          ) : null}
          {attachState === "error" ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {t("saveFailed")}
            </p>
          ) : null}
          {recording ? (
            <TranscriptionGate
              lessonId={activeLesson?.id ?? ""}
              recordingId={recording.id}
            />
          ) : null}
          {activeLesson && recording && recordingAudioSrc ? (
            <LessonClipMarker
              audioSrc={recordingAudioSrc}
              durationSeconds={recording.durationSeconds}
              lessonId={activeLesson.id}
              onSaved={() => router.refresh()}
              recordingId={recording.id}
              transcriptId={transcript?.id}
            />
          ) : null}
        </section>
      </div>

      {activeLesson && recording && recordingAudioSrc && isTestAudioRecording ? (
        <TeachingTranscriptReview
          audioSrc={recordingAudioSrc}
          lessonId={activeLesson.id}
          recordingId={recording.id}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Section title={t("lessonSummary")}>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            {executiveSummaryItems.length > 0 ? (
              <ul className="space-y-2 text-sm leading-7 text-stone-700">
                {executiveSummaryItems.map((item, index) => (
                  <li className="flex gap-3" key={`${item}-${index}`}>
                    <span
                      aria-hidden="true"
                      className="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-emerald-800"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-7 text-stone-700">{t("notYet")}</p>
            )}

            {joinedTranscriptText ? (
              <details className="mt-5 rounded-md border border-stone-200 bg-stone-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800">
                  {t("rawTranscript")}
                </summary>
                <div className="border-t border-stone-200 bg-white px-3 py-3">
                  <ul className="space-y-2 text-sm leading-7 text-stone-700">
                    {transcriptBulletItems(joinedTranscriptText).map(
                      (item, index) => (
                        <li className="flex gap-3" key={`${item}-${index}`}>
                          <span
                            aria-hidden="true"
                            className="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-stone-400"
                          />
                          <span>{item}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </details>
            ) : null}
          </div>
        </Section>

        <Section title={t("extractedCandidates")}>
          <div className="space-y-3">
            {extracts.length === 0 ? (
              <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-600 shadow-sm">
                {t("notYet")}
              </div>
            ) : null}
            {extracts.map((extract) => {
              const actionState = extractActionState[extract.id] ?? "idle";

              return (
                <article
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                  key={extract.id}
                >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-stone-950">
                      {extract.title}
                    </h3>
                    <p className="whitespace-pre-line text-sm leading-6 text-stone-600">
                      {extract.body}
                    </p>
                    {extract.similarExtractId ? (
                      <StatusPill tone="amber">{t("duplicateWarning")}</StatusPill>
                    ) : null}
                  </div>
                  <StatusPill
                    tone={extract.status === "kept" ? "green" : "slate"}
                  >
                    {extract.status}
                  </StatusPill>
                </div>
                <div className="mt-4">
                  <AudioStrip
                    audioSrc={recordingAudioSrc}
                    endsAtSeconds={extract.endsAtSeconds}
                    startsAtSeconds={extract.startsAtSeconds}
                    title={extract.title}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {extract.status === "candidate" ? (
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionState === "saving"}
                      onClick={() => void handleExtractAction(extract.id, "keep")}
                      type="button"
                    >
                      <Check aria-hidden="true" className="h-4 w-4" />
                      {actionState === "saving" ? t("saving") : t("keep")}
                    </button>
                  ) : null}
                  <ComingSoonButton icon={Edit3}>
                    {t("edit")}
                  </ComingSoonButton>
                  {extract.status === "candidate" ? (
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={actionState === "saving"}
                      onClick={() => void handleExtractAction(extract.id, "discard")}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {t("discard")}
                    </button>
                  ) : null}
                </div>
                {actionState === "error" ? (
                  <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {t("candidateActionFailed")}
                  </p>
                ) : null}
              </article>
              );
            })}
          </div>
        </Section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">
                  {t("createLesson")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("recordAudio")} / {t("uploadAudio")}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("teacher")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        teacher: event.target.value,
                      }))
                    }
                    value={formValues.teacher}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("lessonDate")}
                  </span>
                  <input
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        lessonDate: event.target.value,
                      }))
                    }
                    required
                    type="date"
                    value={formValues.lessonDate}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("summary")}
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  value={formValues.summary}
                />
              </label>

              {saveState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {errorMessage}
                </p>
              ) : null}

              {saveState === "saved" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("lessonCreated")}
                </p>
              ) : null}

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
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
