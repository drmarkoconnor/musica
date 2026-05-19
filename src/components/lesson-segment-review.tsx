"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, Minus, Plus, RotateCcw, Scissors, Trash2 } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { useLanguage } from "@/lib/language";
import type { LessonSegment } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

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

function FineTrimControl({
  activeEdge,
  onActiveEdgeChange,
  onNudge,
}: {
  activeEdge: "start" | "end";
  onActiveEdgeChange: (edge: "start" | "end") => void;
  onNudge: (seconds: number) => void;
}) {
  const { t } = useLanguage();
  const lastClientXRef = useRef<number | null>(null);

  function handleMove(clientX: number) {
    if (lastClientXRef.current === null) return;

    const deltaPixels = clientX - lastClientXRef.current;
    const deltaSeconds = Math.trunc(deltaPixels / 12);

    if (deltaSeconds === 0) return;

    lastClientXRef.current += deltaSeconds * 12;
    onNudge(deltaSeconds);
  }

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          {t("fineTrim")}
        </span>
        <div className="grid grid-cols-2 rounded-md border border-stone-300 bg-white p-0.5">
          {(["start", "end"] as const).map((edge) => (
            <button
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold transition",
                activeEdge === edge
                  ? "bg-emerald-950 text-white"
                  : "text-stone-600 hover:bg-stone-100",
              )}
              key={edge}
              onClick={() => onActiveEdgeChange(edge)}
              type="button"
            >
              {edge === "start" ? t("startTime") : t("endTime")}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-3 flex h-14 touch-none select-none items-center justify-center rounded-md border border-stone-300 bg-white px-3"
        onPointerCancel={() => {
          lastClientXRef.current = null;
        }}
        onPointerDown={(event) => {
          lastClientXRef.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => handleMove(event.clientX)}
        onPointerUp={() => {
          lastClientXRef.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          onNudge(event.deltaY > 0 ? 1 : -1);
        }}
        role="slider"
        tabIndex={0}
        title={t("dragToTrim")}
      >
        <div className="grid w-full grid-cols-7 items-end gap-2">
          {[-3, -2, -1, 0, 1, 2, 3].map((tick) => (
            <span
              aria-hidden="true"
              className={cn(
                "mx-auto block w-0.5 rounded-full bg-stone-300",
                tick === 0 ? "h-9 bg-emerald-900" : "h-5",
              )}
              key={tick}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
          onClick={() => onNudge(-1)}
          type="button"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
          1s
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
          onClick={() => onNudge(1)}
          type="button"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          1s
        </button>
      </div>
    </div>
  );
}

function SegmentRow({
  audioSrc,
  index,
  onChanged,
  segment,
}: {
  audioSrc: string;
  index: number;
  onChanged: () => void;
  segment: LessonSegment;
}) {
  const { t } = useLanguage();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function saveSegment(action?: "discard" | "select") {
    setSaveState("saving");

    const response = await fetch(`/api/lesson-segments/${segment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    onChanged();
  }

  const isSelected = segment.status === "selected";
  const isDiscarded = segment.status === "discarded";

  return (
    <article
      className={cn(
        "rounded-md border p-3 shadow-sm",
        index % 2 === 0
          ? "border-stone-200 bg-white"
          : "border-sky-100 bg-sky-50/70",
      )}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(9rem,0.45fr)_1fr_auto] md:items-center">
        <div className="rounded-md bg-stone-950 px-3 py-2 text-white">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
            {t("clipTime")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatDuration(segment.startsAtSeconds)} -{" "}
            {formatDuration(segment.endsAtSeconds)}
          </p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-stone-950">
              {segment.title}
            </h4>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                isSelected
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : isDiscarded
                    ? "bg-rose-50 text-rose-800 ring-rose-200"
                    : "bg-blue-50 text-blue-800 ring-blue-200",
              )}
            >
              {segment.status}
            </span>
          </div>
          {segment.notes ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600">
              {segment.notes}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
          {isSelected ? (
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
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
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
      <div className="mt-2">
        <AudioStrip
          audioSrc={audioSrc}
          controlsMode="buttons"
          density="compact"
          endsAtSeconds={segment.endsAtSeconds}
          showLabel={false}
          showWaveform={false}
          startsAtSeconds={segment.startsAtSeconds}
          title={segment.title}
        />
      </div>
      {saveState === "error" ? (
        <p className="mt-2 text-sm font-medium text-rose-700">
          {t("segmentSaveFailed")}
        </p>
      ) : null}
    </article>
  );
}

export function LessonSegmentReview({
  audioSrc,
  durationSeconds,
  lessonId,
  lessonTitle,
  onChanged,
  recordingId,
  segments,
}: {
  audioSrc: string;
  durationSeconds: number;
  lessonId: string;
  lessonTitle: string;
  onChanged: () => void;
  recordingId: string;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(Math.round(durationSeconds || 1), 1);
  const [startsAtSeconds, setStartsAtSeconds] = useState(0);
  const [endsAtSeconds, setEndsAtSeconds] = useState(defaultClipEnd(maxSeconds));
  const [activeEdge, setActiveEdge] = useState<"start" | "end">("end");
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

  function nudgeActiveEdge(seconds: number) {
    if (activeEdge === "start") {
      setStart(startsAtSeconds + seconds);
      return;
    }

    setEnd(endsAtSeconds + seconds);
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
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-950 text-white">
              <Scissors aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="text-2xl font-semibold leading-tight text-stone-950">
              {t("usefulClipsFrom")} {lessonTitle}
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

      <form
        className="rounded-md border border-stone-200 bg-white p-4"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-xl font-semibold leading-tight text-stone-950">
              {t("addTeachingSegment")}
            </h4>
            <p className="mt-1 text-xs text-stone-500">
              {t("dragToTrim")}
            </p>
          </div>
          <div className="rounded-md bg-emerald-950 px-3 py-2 text-right text-white shadow-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-100">
              {t("clipTime")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_17rem]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block rounded-md border border-stone-200 bg-stone-50 p-3">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  {t("startTime")}
                </span>
                <span className="text-lg font-semibold tabular-nums text-emerald-950">
                  {formatDuration(startsAtSeconds)}
                </span>
              </span>
              <input
                className="mt-3 w-full accent-emerald-900"
                max={maxSeconds}
                min={0}
                onChange={(event) => setStart(Number(event.target.value))}
                onFocus={() => setActiveEdge("start")}
                onPointerDown={() => setActiveEdge("start")}
                type="range"
                value={startsAtSeconds}
              />
            </label>
            <label className="block rounded-md border border-stone-200 bg-stone-50 p-3">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  {t("endTime")}
                </span>
                <span className="text-lg font-semibold tabular-nums text-emerald-950">
                  {formatDuration(endsAtSeconds)}
                </span>
              </span>
              <input
                className="mt-3 w-full accent-emerald-900"
                max={maxSeconds}
                min={1}
                onChange={(event) => setEnd(Number(event.target.value))}
                onFocus={() => setActiveEdge("end")}
                onPointerDown={() => setActiveEdge("end")}
                type="range"
                value={endsAtSeconds}
              />
            </label>
          </div>

          <FineTrimControl
            activeEdge={activeEdge}
            onActiveEdgeChange={setActiveEdge}
            onNudge={nudgeActiveEdge}
          />
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
        {segments.map((segment, index) => (
          <SegmentRow
            audioSrc={audioSrc}
            index={index}
            key={segment.id}
            onChanged={onChanged}
            segment={segment}
          />
        ))}
      </div>
    </section>
  );
}
