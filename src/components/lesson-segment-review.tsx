"use client";

import { FormEvent, useRef, useState } from "react";
import {
  Check,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
} from "lucide-react";
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

const studioBars = [
  32, 46, 39, 63, 42, 55, 74, 38, 58, 45, 69, 52, 44, 61, 36, 49, 71, 41, 57,
  66, 47, 53, 76, 43, 59, 48, 67, 51, 40, 62, 72, 46,
];

function percentAt(seconds: number, durationSeconds: number) {
  if (durationSeconds <= 0) return 0;
  return clamp((seconds / durationSeconds) * 100, 0, 100);
}

function timelineMarks(durationSeconds: number) {
  const markCount = durationSeconds > 360 ? 7 : 5;

  return Array.from({ length: markCount }, (_, index) =>
    Math.round((durationSeconds / Math.max(markCount - 1, 1)) * index),
  );
}

function chapterCountForDuration(durationSeconds: number) {
  if (durationSeconds >= 2700) return 6;
  if (durationSeconds >= 1200) return 5;
  if (durationSeconds >= 600) return 4;

  return 3;
}

function lessonChapters(durationSeconds: number) {
  const maxSeconds = Math.max(durationSeconds, 1);
  const chapterCount = chapterCountForDuration(maxSeconds);

  return Array.from({ length: chapterCount }, (_, index) => {
    const startsAtSeconds = Math.round((maxSeconds / chapterCount) * index);
    const endsAtSeconds =
      index === chapterCount - 1
        ? maxSeconds
        : Math.round((maxSeconds / chapterCount) * (index + 1));

    return {
      endsAtSeconds,
      index,
      startsAtSeconds,
    };
  });
}

function StudioTimeline({
  audioSrc,
  durationSeconds,
  endsAtSeconds,
  onEndChange,
  onStartChange,
  segments,
  startsAtSeconds,
}: {
  audioSrc: string;
  durationSeconds: number;
  endsAtSeconds: number;
  onEndChange: (seconds: number) => void;
  onStartChange: (seconds: number) => void;
  segments: LessonSegment[];
  startsAtSeconds: number;
}) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const clipEndRef = useRef<number | null>(null);
  const lastScrubSecondRef = useRef<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSeconds, setPlayheadSeconds] = useState(startsAtSeconds);
  const [playbackError, setPlaybackError] = useState("");
  const maxSeconds = Math.max(durationSeconds, 1);

  function seekTo(seconds: number) {
    const nextSeconds = clamp(Math.round(seconds), 0, maxSeconds);
    const player = audioRef.current;

    setPlayheadSeconds(nextSeconds);

    if (player && player.readyState >= HTMLMediaElement.HAVE_METADATA) {
      player.currentTime = nextSeconds;
    }

    return nextSeconds;
  }

  function secondFromPointer(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

    return Math.round(ratio * maxSeconds);
  }

  async function playFrom(seconds: number, endAt?: number) {
    const player = audioRef.current;
    if (!player) return;

    setPlaybackError("");
    clipEndRef.current = typeof endAt === "number" ? endAt : null;
    player.playbackRate = 1;
    player.currentTime = clamp(seconds, 0, maxSeconds);

    try {
      await player.play();
    } catch {
      setPlaybackError(t("playbackFailed"));
    }
  }

  function stopPlayback() {
    const player = audioRef.current;
    if (!player) return;

    player.pause();
    player.playbackRate = 1;
    clipEndRef.current = null;
    setIsPlaying(false);
  }

  async function scrubTo(seconds: number) {
    const player = audioRef.current;
    const previousSecond = lastScrubSecondRef.current;
    const nextSeconds = seekTo(seconds);

    if (!player) return;

    if (previousSecond !== null && nextSeconds !== previousSecond) {
      player.playbackRate = nextSeconds > previousSecond ? 1.75 : 1.25;
    }

    lastScrubSecondRef.current = nextSeconds;

    try {
      await player.play();
    } catch {
      // Scrubbing still moves the playhead even if a browser blocks audio.
    }
  }

  function finishScrub() {
    const player = audioRef.current;
    lastScrubSecondRef.current = null;

    if (!player) return;

    player.playbackRate = 1;

    if (!wasPlayingBeforeScrubRef.current) {
      player.pause();
      setIsPlaying(false);
    }
  }

  function setTwentySecondClip() {
    const nextStart = clamp(playheadSeconds, 0, Math.max(maxSeconds - 1, 0));
    const nextEnd = clamp(nextStart + 20, nextStart + 1, maxSeconds);

    onStartChange(nextStart);
    onEndChange(nextEnd);
  }

  function handleTimeUpdate() {
    const player = audioRef.current;
    if (!player) return;

    setPlayheadSeconds(Math.round(player.currentTime));

    if (
      typeof clipEndRef.current === "number" &&
      player.currentTime >= clipEndRef.current
    ) {
      stopPlayback();
    }
  }

  const selectedLeft = percentAt(startsAtSeconds, maxSeconds);
  const selectedRight = percentAt(endsAtSeconds, maxSeconds);
  const playheadLeft = percentAt(playheadSeconds, maxSeconds);

  return (
    <div className="rounded-md border border-stone-200 bg-stone-950 p-3 text-white">
      <audio
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
        ref={audioRef}
        src={audioSrc}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {t("audioStudio")}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatDuration(playheadSeconds)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={() => void playFrom(playheadSeconds)}
            title={t("playFromPlayhead")}
            type="button"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Play aria-hidden="true" className="h-4 w-4" />
            )}
            {t("play")}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={() => void playFrom(startsAtSeconds, endsAtSeconds)}
            title={t("playSelection")}
            type="button"
          >
            <SkipForward aria-hidden="true" className="h-4 w-4" />
            {t("selection")}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={stopPlayback}
            type="button"
          >
            <Square aria-hidden="true" className="h-4 w-4" />
            {t("stopClip")}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={setTwentySecondClip}
            title={t("makeTwentySecondClip")}
            type="button"
          >
            <Scissors aria-hidden="true" className="h-4 w-4" />
            20s
          </button>
        </div>
      </div>

      <div
        className="relative mt-4 h-28 touch-none select-none overflow-hidden rounded-md border border-white/15 bg-stone-900"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            seekTo(playheadSeconds - (event.shiftKey ? 5 : 1));
          }
          if (event.key === "ArrowRight") {
            seekTo(playheadSeconds + (event.shiftKey ? 5 : 1));
          }
        }}
        onPointerCancel={finishScrub}
        onPointerDown={(event) => {
          wasPlayingBeforeScrubRef.current = isPlaying;
          event.currentTarget.setPointerCapture(event.pointerId);
          void scrubTo(secondFromPointer(event.clientX, event.currentTarget));
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          void scrubTo(secondFromPointer(event.clientX, event.currentTarget));
        }}
        onPointerUp={finishScrub}
        role="slider"
        tabIndex={0}
        title={t("scrubTimeline")}
      >
        <div className="absolute inset-x-3 bottom-4 top-8 flex items-end gap-1">
          {studioBars.map((height, index) => (
            <span
              aria-hidden="true"
              className="flex-1 rounded-t bg-emerald-200/45"
              key={`${height}-${index}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {segments.map((segment) => (
          <span
            aria-hidden="true"
            className="absolute top-2 h-4 rounded-sm bg-sky-300/60 ring-1 ring-sky-100/50"
            key={segment.id}
            style={{
              left: `${percentAt(segment.startsAtSeconds, maxSeconds)}%`,
              width: `${Math.max(
                percentAt(segment.endsAtSeconds, maxSeconds) -
                  percentAt(segment.startsAtSeconds, maxSeconds),
                0.8,
              )}%`,
            }}
          />
        ))}

        <span
          aria-hidden="true"
          className="absolute bottom-0 top-0 bg-emerald-400/25 ring-1 ring-emerald-200/80"
          style={{
            left: `${selectedLeft}%`,
            width: `${Math.max(selectedRight - selectedLeft, 0.8)}%`,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.35)]"
          style={{ left: `${playheadLeft}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between gap-2 text-xs font-semibold text-stone-300">
        {timelineMarks(maxSeconds).map((mark, index) => (
          <span className="tabular-nums" key={`${mark}-${index}`}>
            {formatDuration(mark)}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white/10 p-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
              {t("selectedRange")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
              {t("existingClips")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {segments.length}
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
          onClick={() => onStartChange(playheadSeconds)}
          title={t("setStartAtPlayhead")}
          type="button"
        >
          <SkipBack aria-hidden="true" className="h-4 w-4" />
          {t("setStart")}
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
          onClick={() => onEndChange(playheadSeconds)}
          title={t("setEndAtPlayhead")}
          type="button"
        >
          <SkipForward aria-hidden="true" className="h-4 w-4" />
          {t("setEnd")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            aria-label={t("backFiveSeconds")}
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={() => seekTo(playheadSeconds - 5)}
            type="button"
          >
            -5s
          </button>
          <button
            aria-label={t("forwardFiveSeconds")}
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            onClick={() => seekTo(playheadSeconds + 5)}
            type="button"
          >
            +5s
          </button>
        </div>
      </div>

      {playbackError ? (
        <p className="mt-2 text-xs leading-5 text-rose-200">{playbackError}</p>
      ) : null}
    </div>
  );
}

function LessonChapterRail({
  activeSegmentId,
  durationSeconds,
  endsAtSeconds,
  onSegmentSelect,
  segments,
  startsAtSeconds,
}: {
  activeSegmentId: string;
  durationSeconds: number;
  endsAtSeconds: number;
  onSegmentSelect: (segment: LessonSegment) => void;
  segments: LessonSegment[];
  startsAtSeconds: number;
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(durationSeconds, 1);
  const chapters = lessonChapters(maxSeconds);
  const activeSegment = segments.find((segment) => segment.id === activeSegmentId);
  const focusStart = activeSegment?.startsAtSeconds ?? startsAtSeconds;
  const focusEnd = activeSegment?.endsAtSeconds ?? endsAtSeconds;

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            {t("lessonMap")}
          </p>
          <h4 className="mt-1 text-base font-semibold text-stone-950">
            {t("chapterRail")}
          </h4>
        </div>
        <span className="rounded-md bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
          {segments.length} {t("existingClips")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {chapters.map((chapter) => {
          const chapterSegments = segments.filter(
            (segment) =>
              segment.startsAtSeconds < chapter.endsAtSeconds &&
              segment.endsAtSeconds > chapter.startsAtSeconds,
          );
          const isFocused =
            focusStart < chapter.endsAtSeconds && focusEnd > chapter.startsAtSeconds;

          return (
            <div
              className={cn(
                "rounded-md border p-2",
                isFocused
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-stone-200 bg-stone-50",
              )}
              key={chapter.index}
            >
              <p className="text-xs font-semibold text-stone-950">
                {t("lessonRegion")} {chapter.index + 1}
              </p>
              <p className="mt-1 text-xs tabular-nums text-stone-500">
                {formatDuration(chapter.startsAtSeconds)} -{" "}
                {formatDuration(chapter.endsAtSeconds)}
              </p>
              <p className="mt-2 text-xs font-semibold text-stone-600">
                {chapterSegments.length} {t("clips")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 h-20 overflow-hidden rounded-md border border-stone-200 bg-stone-950">
        <div className="absolute inset-x-3 bottom-3 top-6 flex items-end gap-1">
          {studioBars.map((height, index) => (
            <span
              aria-hidden="true"
              className="flex-1 rounded-t bg-emerald-200/35"
              key={`${height}-${index}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        <span
          aria-hidden="true"
          className="absolute bottom-0 top-0 bg-emerald-300/20 ring-1 ring-emerald-200/70"
          style={{
            left: `${percentAt(startsAtSeconds, maxSeconds)}%`,
            width: `${Math.max(
              percentAt(endsAtSeconds, maxSeconds) -
                percentAt(startsAtSeconds, maxSeconds),
              0.8,
            )}%`,
          }}
        />

        {chapters.slice(1).map((chapter) => (
          <span
            aria-hidden="true"
            className="absolute bottom-0 top-0 w-px bg-white/15"
            key={chapter.index}
            style={{ left: `${percentAt(chapter.startsAtSeconds, maxSeconds)}%` }}
          />
        ))}

        {segments.map((segment) => {
          const isActive = segment.id === activeSegmentId;
          const left = percentAt(segment.startsAtSeconds, maxSeconds);
          const width = Math.max(
            percentAt(segment.endsAtSeconds, maxSeconds) - left,
            1.2,
          );

          return (
            <button
              aria-label={`${segment.title}: ${formatDuration(
                segment.startsAtSeconds,
              )} - ${formatDuration(segment.endsAtSeconds)}`}
              className={cn(
                "absolute top-2 h-4 rounded-sm transition",
                segment.status === "discarded"
                  ? "bg-rose-300/70"
                  : "bg-sky-300/80",
                isActive
                  ? "ring-2 ring-white"
                  : "ring-1 ring-white/40 hover:ring-white/80",
              )}
              key={segment.id}
              onClick={() => onSegmentSelect(segment)}
              style={{
                left: `${left}%`,
                width: `${width}%`,
              }}
              title={segment.title}
              type="button"
            />
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-500">
        <span>
          {t("focusRange")}: {formatDuration(focusStart)} -{" "}
          {formatDuration(focusEnd)}
        </span>
        {activeSegment ? (
          <span className="truncate text-stone-700">{activeSegment.title}</span>
        ) : (
          <span>{t("currentDraftClip")}</span>
        )}
      </div>
    </div>
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

function SegmentReviewPanel({
  audioSrc,
  onChanged,
  segment,
  onSelect,
}: {
  audioSrc: string;
  onChanged: () => void;
  segment: LessonSegment;
  onSelect: (segment: LessonSegment) => void;
}) {
  const { t } = useLanguage();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [title, setTitle] = useState(segment.title);
  const [notes, setNotes] = useState(segment.notes);

  async function saveSegment(action?: "discard" | "select") {
    setSaveState("saving");

    const response = await fetch(`/api/lesson-segments/${segment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        notes,
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

  const isSelected = segment.status === "selected";
  const isDiscarded = segment.status === "discarded";

  return (
    <article className="rounded-md border border-stone-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[11rem_1fr]">
        <div className="rounded-md bg-stone-950 px-3 py-2 text-white">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
            {t("clipTime")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatDuration(segment.startsAtSeconds)} -{" "}
            {formatDuration(segment.endsAtSeconds)}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
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

        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
            <label className="block">
              <span className="text-sm font-medium text-stone-800">
                {t("title")}
              </span>
              <input
                className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                onChange={(event) => {
                  setSaveState("idle");
                  setTitle(event.target.value);
                }}
                required
                value={title}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-800">
                {t("notes")}
              </span>
              <textarea
                className="mt-2 min-h-20 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                onChange={(event) => {
                  setSaveState("idle");
                  setNotes(event.target.value);
                }}
                placeholder={t("teachingSegmentPlaceholder")}
                value={notes}
              />
            </label>
          </div>

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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {saveState === "saved" ? (
                <span className="font-medium text-emerald-800">
                  {t("clipDetailsSaved")}
                </span>
              ) : null}
              {saveState === "error" ? (
                <span className="font-medium text-rose-700">
                  {t("segmentSaveFailed")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-start gap-2 md:justify-end">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saveState === "saving"}
                onClick={() => void saveSegment()}
                type="button"
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                {saveState === "saving" ? t("saving") : t("saveClipDetails")}
              </button>
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
                  onClick={() => {
                    onSelect(segment);
                    void saveSegment("select");
                  }}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  {t("restore")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SegmentReviewQueue({
  activeSegmentId,
  audioSrc,
  onActiveSegmentChange,
  onChanged,
  segments,
}: {
  activeSegmentId: string;
  audioSrc: string;
  onActiveSegmentChange: (segment: LessonSegment) => void;
  onChanged: () => void;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const activeSegment =
    segments.find((segment) => segment.id === activeSegmentId) ?? segments[0];

  if (segments.length === 0) {
    return (
      <p className="rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-600">
        {t("noTeachingSegments")}
      </p>
    );
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            {t("clipReviewQueue")}
          </p>
          <h4 className="mt-1 text-base font-semibold text-stone-950">
            {t("reviewCreatedClips")}
          </h4>
        </div>
        <span className="rounded-md bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
          {segments.length} {t("clips")}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[17rem_1fr]">
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {segments.map((segment) => {
            const isActive = segment.id === activeSegment?.id;
            const isDiscarded = segment.status === "discarded";

            return (
              <button
                aria-pressed={isActive}
                className={cn(
                  "w-full rounded-md border p-3 text-left transition",
                  isActive
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
                )}
                key={segment.id}
                onClick={() => onActiveSegmentChange(segment)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-stone-950">
                    {segment.title}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                      isDiscarded
                        ? "bg-rose-50 text-rose-800 ring-rose-200"
                        : "bg-emerald-50 text-emerald-900 ring-emerald-200",
                    )}
                  >
                    {segment.status}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-semibold tabular-nums text-stone-500">
                  {formatDuration(segment.startsAtSeconds)} -{" "}
                  {formatDuration(segment.endsAtSeconds)}
                </span>
                {segment.notes ? (
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-stone-600">
                    {segment.notes}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {activeSegment ? (
          <SegmentReviewPanel
            audioSrc={audioSrc}
            key={activeSegment.id}
            onChanged={onChanged}
            onSelect={onActiveSegmentChange}
            segment={activeSegment}
          />
        ) : null}
      </div>
    </div>
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
  const [activeSegmentId, setActiveSegmentId] = useState("");
  const [title, setTitle] = useState(t("teachingSegment"));
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const selectedTotalSeconds = selectedSeconds(segments);
  const selectedCount = segments.filter((segment) => segment.status === "selected")
    .length;

  function selectSegment(segment: LessonSegment) {
    setActiveSegmentId(segment.id);
  }

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

    const body = (await response.json().catch(() => null)) as { id?: string } | null;

    setSaveState("saved");
    if (body?.id) {
      setActiveSegmentId(body.id);
    }
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

        <div className="mt-4">
          <LessonChapterRail
            activeSegmentId={activeSegmentId}
            durationSeconds={maxSeconds}
            endsAtSeconds={endsAtSeconds}
            onSegmentSelect={selectSegment}
            segments={segments}
            startsAtSeconds={startsAtSeconds}
          />
        </div>

        <div className="mt-4">
          <StudioTimeline
            audioSrc={audioSrc}
            durationSeconds={maxSeconds}
            endsAtSeconds={endsAtSeconds}
            onEndChange={(seconds) => {
              setActiveEdge("end");
              setEnd(seconds);
            }}
            onStartChange={(seconds) => {
              setActiveEdge("start");
              setStart(seconds);
            }}
            segments={segments}
            startsAtSeconds={startsAtSeconds}
          />
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

      <SegmentReviewQueue
        activeSegmentId={activeSegmentId}
        audioSrc={audioSrc}
        onActiveSegmentChange={selectSegment}
        onChanged={onChanged}
        segments={segments}
      />
    </section>
  );
}
