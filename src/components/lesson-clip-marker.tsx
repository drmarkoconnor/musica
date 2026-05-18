"use client";

import { FormEvent, useState } from "react";
import { Flag, Minus, Plus, Save } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { useLanguage } from "@/lib/language";
import { formatDuration } from "@/lib/utils";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultClipEnd(durationSeconds: number) {
  return clamp(Math.min(durationSeconds, 60), 1, Math.max(durationSeconds, 1));
}

export function LessonClipMarker({
  audioSrc,
  durationSeconds,
  lessonId,
  onSaved,
  recordingId,
  transcriptId,
}: {
  audioSrc: string;
  durationSeconds: number;
  lessonId: string;
  onSaved: () => void;
  recordingId: string;
  transcriptId?: string;
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(Math.round(durationSeconds || 1), 1);
  const [startsAtSeconds, setStartsAtSeconds] = useState(0);
  const [endsAtSeconds, setEndsAtSeconds] = useState(defaultClipEnd(maxSeconds));
  const [title, setTitle] = useState(t("manualTeachingClip"));
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  function setStart(value: number) {
    const nextStart = clamp(Math.round(value), 0, Math.max(endsAtSeconds - 1, 0));
    setStartsAtSeconds(nextStart);
  }

  function setEnd(value: number) {
    const nextEnd = clamp(Math.round(value), startsAtSeconds + 1, maxSeconds);
    setEndsAtSeconds(nextEnd);
  }

  function nudgeStart(delta: number) {
    setStart(startsAtSeconds + delta);
  }

  function nudgeEnd(delta: number) {
    setEnd(endsAtSeconds + delta);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");

    const response = await fetch("/api/lesson-extracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        endsAtSeconds,
        lessonId,
        recordingId,
        startsAtSeconds,
        title,
        transcriptId,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    setBody("");
    setTitle(t("manualTeachingClip"));
    onSaved();
  }

  return (
    <form
      className="rounded-lg border border-stone-200 bg-stone-50 p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flag aria-hidden="true" className="h-4 w-4 text-emerald-800" />
            <h3 className="text-sm font-semibold text-stone-950">
              {t("markTeachingClip")}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            {t("markTeachingClipNote")}
          </p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
          {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("startTime")}
            </span>
            <input
              className="mt-2 w-full accent-emerald-900"
              max={maxSeconds}
              min={0}
              onChange={(event) => setStart(Number(event.target.value))}
              type="range"
              value={startsAtSeconds}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => nudgeStart(-5)}
              type="button"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => nudgeStart(5)}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("endTime")}
            </span>
            <input
              className="mt-2 w-full accent-emerald-900"
              max={maxSeconds}
              min={1}
              onChange={(event) => setEnd(Number(event.target.value))}
              type="range"
              value={endsAtSeconds}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => nudgeEnd(-5)}
              type="button"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => nudgeEnd(5)}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AudioStrip
          audioSrc={audioSrc}
          endsAtSeconds={endsAtSeconds}
          startsAtSeconds={startsAtSeconds}
          title={t("selectedTeachingClip")}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[0.75fr_1.25fr]">
        <label className="block">
          <span className="text-sm font-medium text-stone-800">{t("title")}</span>
          <input
            className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-800">{t("notes")}</span>
          <textarea
            className="mt-2 min-h-20 w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("manualTeachingClipPlaceholder")}
            value={body}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {saveState === "saved" ? (
            <span className="font-medium text-emerald-800">
              {t("candidateSaved")}
            </span>
          ) : null}
          {saveState === "error" ? (
            <span className="font-medium text-rose-700">
              {t("candidateSaveFailed")}
            </span>
          ) : null}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saveState === "saving"}
          type="submit"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
          {saveState === "saving" ? t("saving") : t("createCandidate")}
        </button>
      </div>
    </form>
  );
}
