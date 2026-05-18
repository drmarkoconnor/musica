"use client";

import { FormEvent, useState } from "react";
import { Check, Minus, Plus, RotateCcw, Save, Scissors, Trash2 } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { useLanguage } from "@/lib/language";
import type { LessonSegment } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultClipEnd(durationSeconds: number) {
  return clamp(Math.min(durationSeconds, 60), 1, Math.max(durationSeconds, 1));
}

function selectedSeconds(segments: LessonSegment[]) {
  return segments
    .filter((segment) => segment.status === "selected")
    .reduce(
      (total, segment) =>
        total + Math.max(segment.endsAtSeconds - segment.startsAtSeconds, 0),
      0,
    );
}

function SegmentEditor({
  audioSrc,
  durationSeconds,
  onChanged,
  segment,
}: {
  audioSrc: string;
  durationSeconds: number;
  onChanged: () => void;
  segment: LessonSegment;
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(Math.round(durationSeconds || 1), 1);
  const [startsAtSeconds, setStartsAtSeconds] = useState(segment.startsAtSeconds);
  const [endsAtSeconds, setEndsAtSeconds] = useState(segment.endsAtSeconds);
  const [title, setTitle] = useState(segment.title);
  const [notes, setNotes] = useState(segment.notes);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  function setStart(value: number) {
    setStartsAtSeconds(
      clamp(Math.round(value), 0, Math.max(endsAtSeconds - 1, 0)),
    );
  }

  function setEnd(value: number) {
    setEndsAtSeconds(clamp(Math.round(value), startsAtSeconds + 1, maxSeconds));
  }

  async function saveSegment(action?: "discard" | "select") {
    setSaveState("saving");

    const response = await fetch(`/api/lesson-segments/${segment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        endsAtSeconds,
        notes,
        startsAtSeconds,
        title,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    onChanged();
  }

  return (
    <article className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
          <p className="mt-2 text-xs font-medium text-stone-500">
            {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ${
            segment.status === "selected"
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
              : "bg-stone-100 text-stone-600 ring-1 ring-stone-200"
          }`}
        >
          {segment.status}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => setStart(startsAtSeconds - 5)}
              type="button"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => setStart(startsAtSeconds + 5)}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
          </div>
        </label>

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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => setEnd(endsAtSeconds - 5)}
              type="button"
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={() => setEnd(endsAtSeconds + 5)}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              5s
            </button>
          </div>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-stone-800">{t("notes")}</span>
        <textarea
          className="mt-2 min-h-16 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>

      <div className="mt-3">
        <AudioStrip
          audioSrc={audioSrc}
          endsAtSeconds={endsAtSeconds}
          startsAtSeconds={startsAtSeconds}
          title={title}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {saveState === "saved" ? (
            <span className="font-medium text-emerald-800">{t("saved")}</span>
          ) : null}
          {saveState === "error" ? (
            <span className="font-medium text-rose-700">
              {t("segmentSaveFailed")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveState === "saving"}
            onClick={() => void saveSegment("select")}
            type="button"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            {saveState === "saving" ? t("saving") : t("save")}
          </button>
          {segment.status === "selected" ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saveState === "saving"}
              onClick={() => void saveSegment("discard")}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {t("discard")}
            </button>
          ) : (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saveState === "saving"}
              onClick={() => void saveSegment("select")}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {t("restore")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function LessonSegmentReview({
  audioSrc,
  durationSeconds,
  lessonId,
  onChanged,
  recordingId,
  segments,
}: {
  audioSrc: string;
  durationSeconds: number;
  lessonId: string;
  onChanged: () => void;
  recordingId: string;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(Math.round(durationSeconds || 1), 1);
  const [startsAtSeconds, setStartsAtSeconds] = useState(0);
  const [endsAtSeconds, setEndsAtSeconds] = useState(defaultClipEnd(maxSeconds));
  const [title, setTitle] = useState(t("teachingSegment"));
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const selectedTotalSeconds = selectedSeconds(segments);
  const selectedCount = segments.filter((segment) => segment.status === "selected")
    .length;

  function setStart(value: number) {
    setStartsAtSeconds(
      clamp(Math.round(value), 0, Math.max(endsAtSeconds - 1, 0)),
    );
  }

  function setEnd(value: number) {
    setEndsAtSeconds(clamp(Math.round(value), startsAtSeconds + 1, maxSeconds));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");

    const response = await fetch("/api/lesson-segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endsAtSeconds,
        lessonId,
        notes,
        recordingId,
        startsAtSeconds,
        title,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    setNotes("");
    setTitle(t("teachingSegment"));
    onChanged();
  }

  return (
    <section className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scissors aria-hidden="true" className="h-4 w-4 text-emerald-800" />
            <h3 className="text-sm font-semibold text-stone-950">
              {t("teachingSegments")}
            </h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
            {t("teachingSegmentsNote")}
          </p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
          {selectedCount} / {formatDuration(selectedTotalSeconds)}
        </span>
      </div>

      <form className="rounded-md border border-stone-200 bg-white p-3" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-stone-950">
            {t("addTeachingSegment")}
          </h4>
          <span className="text-xs font-medium text-stone-500">
            {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
          </span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[0.75fr_1.25fr]">
          <label className="block">
            <span className="text-sm font-medium text-stone-800">
              {t("title")}
            </span>
            <input
              className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-800">
              {t("notes")}
            </span>
            <textarea
              className="mt-2 min-h-16 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("teachingSegmentPlaceholder")}
              value={notes}
            />
          </label>
        </div>

        <div className="mt-3">
          <AudioStrip
            audioSrc={audioSrc}
            endsAtSeconds={endsAtSeconds}
            startsAtSeconds={startsAtSeconds}
            title={t("selectedTeachingClip")}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {saveState === "saved" ? (
              <span className="font-medium text-emerald-800">
                {t("segmentSaved")}
              </span>
            ) : null}
            {saveState === "error" ? (
              <span className="font-medium text-rose-700">
                {t("segmentSaveFailed")}
              </span>
            ) : null}
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveState === "saving"}
            type="submit"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            {saveState === "saving" ? t("saving") : t("addSegment")}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {segments.length === 0 ? (
          <p className="rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-600">
            {t("noTeachingSegments")}
          </p>
        ) : null}
        {segments.map((segment) => (
          <SegmentEditor
            audioSrc={audioSrc}
            durationSeconds={durationSeconds}
            key={segment.id}
            onChanged={onChanged}
            segment={segment}
          />
        ))}
      </div>
    </section>
  );
}
