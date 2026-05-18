"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit3, Plus, Trash2, Upload, X } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { ComingSoonButton } from "@/components/coming-soon-button";
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
  const activeLesson = sortedLessons[0];
  const recording = activeLesson
    ? lessonRecordings.find((item) => item.lessonId === activeLesson.id)
    : undefined;
  const recordingAudioSrc =
    recording?.storageBucket === "local-test-audio" ||
    recording?.storageBucket === "local-lesson-audio"
      ? `/api/lesson-recordings/${recording.id}/file`
      : undefined;
  const isTestAudioRecording =
    recording?.storagePath === TEST_LESSON_FIXTURE_STORAGE_PATH;
  const transcript = activeLesson
    ? transcripts.find((item) => item.lessonId === activeLesson.id)
    : undefined;
  const extracts = activeLesson
    ? lessonExtracts.filter((item) => item.lessonId === activeLesson.id)
    : [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState<LessonFormValues>(emptyLessonForm);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [attachState, setAttachState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
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
          <p className="mt-4 text-sm leading-6 text-stone-600">
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
            <LessonRecorder />
            <ComingSoonButton className="min-h-12 w-full py-3" icon={Upload}>
              {t("uploadAudio")}
            </ComingSoonButton>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-950">
                {recording?.title ?? t("recordings")}
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
        <Section title={t("transcript")}>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            {transcript?.text ? (
              <ul className="space-y-2 text-sm leading-7 text-stone-700">
                {transcriptBulletItems(transcript.text).map((item, index) => (
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
          </div>
        </Section>

        <Section title={t("extractedCandidates")}>
          <div className="space-y-3">
            {extracts.map((extract) => (
              <article
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={extract.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-stone-950">
                      {extract.title}
                    </h3>
                    <p className="text-sm leading-6 text-stone-600">
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
                  <ComingSoonButton icon={Check} tone="primary">
                    {t("keep")}
                  </ComingSoonButton>
                  <ComingSoonButton icon={Edit3}>
                    {t("edit")}
                  </ComingSoonButton>
                  <ComingSoonButton icon={Trash2} tone="danger">
                    {t("discard")}
                  </ComingSoonButton>
                </div>
              </article>
            ))}
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
