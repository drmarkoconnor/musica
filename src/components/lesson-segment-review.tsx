"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListMusic,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  X,
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
    .filter((segment) => segment.status !== "discarded")
    .reduce(
      (total, segment) =>
        total + Math.max(segment.endsAtSeconds - segment.startsAtSeconds, 0),
      0,
    );
}

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

type FocusWindow = "all" | 900 | 300 | 60;

const focusWindowOptions: FocusWindow[] = ["all", 900, 300, 60];

function parseTimecode(value: string) {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (
    parts.length === 0 ||
    parts.length > 3 ||
    parts.some((part) => !Number.isFinite(part) || part < 0)
  ) {
    return null;
  }

  if (parts.length === 1) return Math.round(parts[0]);
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);

  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function windowStartFor(
  seconds: number,
  windowSeconds: number,
  durationSeconds: number,
) {
  return clamp(
    Math.round(seconds - windowSeconds / 2),
    0,
    Math.max(durationSeconds - windowSeconds, 0),
  );
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
  const pendingSeekRef = useRef<number | null>(null);
  const clipEndRef = useRef<number | null>(null);
  const lastScrubSecondRef = useRef<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const maxSeconds = Math.max(durationSeconds, 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSeconds, setPlayheadSeconds] = useState(startsAtSeconds);
  const [playbackError, setPlaybackError] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [focusWindow, setFocusWindow] = useState<FocusWindow>(
    maxSeconds > 900 ? 300 : "all",
  );
  const [viewStartSeconds, setViewStartSeconds] = useState(0);
  const focusedSeconds =
    focusWindow === "all" ? maxSeconds : Math.min(focusWindow, maxSeconds);
  const viewEndSeconds = Math.min(viewStartSeconds + focusedSeconds, maxSeconds);

  useEffect(() => {
    setViewStartSeconds((current) =>
      clamp(current, 0, Math.max(maxSeconds - focusedSeconds, 0)),
    );
  }, [focusedSeconds, maxSeconds]);

  useEffect(() => {
    setViewStartSeconds((current) => {
      const currentEnd = current + focusedSeconds;

      if (startsAtSeconds >= current && endsAtSeconds <= currentEnd) {
        return current;
      }

      const selectionCenter = (startsAtSeconds + endsAtSeconds) / 2;
      return windowStartFor(selectionCenter, focusedSeconds, maxSeconds);
    });
  }, [endsAtSeconds, focusedSeconds, maxSeconds, startsAtSeconds]);

  function seekTo(seconds: number) {
    const nextSeconds = clamp(Math.round(seconds), 0, maxSeconds);
    const player = audioRef.current;

    setPlayheadSeconds(nextSeconds);

    pendingSeekRef.current = nextSeconds;
    if (player && player.readyState >= HTMLMediaElement.HAVE_METADATA) {
      player.currentTime = nextSeconds;
      pendingSeekRef.current = null;
    }

    if (
      focusWindow !== "all" &&
      (nextSeconds < viewStartSeconds || nextSeconds > viewEndSeconds)
    ) {
      setViewStartSeconds(
        windowStartFor(nextSeconds, focusedSeconds, maxSeconds),
      );
    }

    return nextSeconds;
  }

  function secondFromPointer(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

    return Math.round(viewStartSeconds + ratio * focusedSeconds);
  }

  function secondFromOverviewPointer(clientX: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

    return Math.round(ratio * maxSeconds);
  }

  async function playFrom(seconds: number, endAt?: number) {
    const player = audioRef.current;
    if (!player) return;

    setPlaybackError("");
    clipEndRef.current = typeof endAt === "number" ? endAt : null;
    player.playbackRate = playbackRate;
    seekTo(seconds);

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
    clipEndRef.current = null;
    setIsPlaying(false);
  }

  function togglePlayback() {
    const player = audioRef.current;

    if (isPlaying && player) {
      player.pause();
      clipEndRef.current = null;
      return;
    }

    void playFrom(playheadSeconds);
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

    player.playbackRate = playbackRate;

    if (!wasPlayingBeforeScrubRef.current) {
      player.pause();
      setIsPlaying(false);
    }
  }

  function setFortyFiveSecondClip() {
    const nextStart = clamp(
      playheadSeconds - 15,
      0,
      Math.max(maxSeconds - 1, 0),
    );
    const nextEnd = clamp(playheadSeconds + 30, nextStart + 1, maxSeconds);

    onStartChange(nextStart);
    onEndChange(nextEnd);
  }

  function changeFocusWindow(nextWindow: FocusWindow) {
    const nextFocusedSeconds =
      nextWindow === "all" ? maxSeconds : Math.min(nextWindow, maxSeconds);

    setFocusWindow(nextWindow);
    setViewStartSeconds(
      windowStartFor(playheadSeconds, nextFocusedSeconds, maxSeconds),
    );
  }

  function moveFocusWindow(direction: -1 | 1) {
    const nextStart = clamp(
      viewStartSeconds + direction * focusedSeconds * 0.8,
      0,
      Math.max(maxSeconds - focusedSeconds, 0),
    );
    const nextEnd = Math.min(nextStart + focusedSeconds, maxSeconds);

    setViewStartSeconds(nextStart);

    if (playheadSeconds < nextStart || playheadSeconds > nextEnd) {
      const nextPlayhead = Math.round(nextStart + focusedSeconds * 0.1);
      setPlayheadSeconds(nextPlayhead);
      pendingSeekRef.current = nextPlayhead;
      if (audioRef.current && audioRef.current.readyState >= HTMLMediaElement.HAVE_METADATA) {
        audioRef.current.currentTime = nextPlayhead;
        pendingSeekRef.current = null;
      }
    }
  }

  function handleTimeUpdate() {
    const player = audioRef.current;
    if (!player || pendingSeekRef.current !== null) return;

    const nextPlayheadSeconds = Math.round(player.currentTime);
    setPlayheadSeconds(nextPlayheadSeconds);

    if (
      focusWindow !== "all" &&
      nextPlayheadSeconds >= viewEndSeconds &&
      nextPlayheadSeconds < maxSeconds
    ) {
      setViewStartSeconds(
        windowStartFor(nextPlayheadSeconds, focusedSeconds, maxSeconds),
      );
    }

    if (
      typeof clipEndRef.current === "number" &&
      player.currentTime >= clipEndRef.current
    ) {
      stopPlayback();
    }
  }

  const selectedLeft = percentAt(
    clamp(startsAtSeconds - viewStartSeconds, 0, focusedSeconds),
    focusedSeconds,
  );
  const selectedRight = percentAt(
    clamp(endsAtSeconds - viewStartSeconds, 0, focusedSeconds),
    focusedSeconds,
  );
  const playheadLeft = percentAt(
    clamp(playheadSeconds - viewStartSeconds, 0, focusedSeconds),
    focusedSeconds,
  );
  const overviewSelectionLeft = percentAt(startsAtSeconds, maxSeconds);
  const overviewSelectionRight = percentAt(endsAtSeconds, maxSeconds);
  const overviewPlayheadLeft = percentAt(playheadSeconds, maxSeconds);
  const overviewWindowLeft = percentAt(viewStartSeconds, maxSeconds);
  const overviewWindowRight = percentAt(viewEndSeconds, maxSeconds);

  return (
    <div className="rounded-md border border-stone-200 bg-stone-950 p-3 text-white">
      <audio
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => {
          document.querySelectorAll("audio").forEach((audio) => { if (audio !== audioRef.current) audio.pause(); });
          setIsPlaying(true);
        }}
        onLoadedMetadata={() => {
          const player = audioRef.current;
          if (player && pendingSeekRef.current !== null) {
            player.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        preload="none"
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <button
              aria-label={t("backFifteenSeconds")}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              onClick={() => seekTo(playheadSeconds - 15)}
              title={t("backFifteenSeconds")}
              type="button"
            >
              <SkipBack aria-hidden="true" className="h-4 w-4" />
              15s
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={togglePlayback}
              title={t("playFromPlayhead")}
              type="button"
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Play aria-hidden="true" className="h-4 w-4" />
              )}
              {isPlaying ? t("pause") : t("play")}
            </button>
            <button
              aria-label={t("forwardFifteenSeconds")}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              onClick={() => seekTo(playheadSeconds + 15)}
              title={t("forwardFifteenSeconds")}
              type="button"
            >
              <SkipForward aria-hidden="true" className="h-4 w-4" />
              15s
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={() => void playFrom(startsAtSeconds, endsAtSeconds)}
              title={t("playSelection")}
              type="button"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              {t("selection")}
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={stopPlayback}
              type="button"
            >
              <Square aria-hidden="true" className="h-4 w-4" />
              {t("stopClip")}
            </button>
            <button
              aria-label={t("captureFortyFiveSecondClip")}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-emerald-200/30 bg-emerald-200/15 px-2.5 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-200/20"
              onClick={setFortyFiveSecondClip}
              title={t("captureFortyFiveSecondClip")}
              type="button"
            >
              <BookmarkPlus aria-hidden="true" className="h-4 w-4" />
              45s
            </button>
          </div>
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 text-xs font-semibold text-stone-200">
            <Gauge aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only">{t("playbackSpeed")}</span>
            <select
              aria-label={t("playbackSpeed")}
              className="bg-transparent text-sm font-semibold text-white outline-none"
              onChange={(event) => {
                const nextRate = Number(event.target.value);
                setPlaybackRate(nextRate);
                if (audioRef.current) {
                  audioRef.current.playbackRate = nextRate;
                }
              }}
              value={playbackRate}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <option className="text-stone-950" key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-white/15 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
            {t("recordingOverview")}
          </p>
          <div className="grid grid-cols-4 rounded-md border border-white/15 bg-white/10 p-0.5">
            {focusWindowOptions.map((option) => {
              const label =
                option === "all"
                  ? t("fullLesson")
                  : option === 900
                    ? t("fifteenMinutes")
                    : option === 300
                      ? t("fiveMinutes")
                      : t("oneMinute");

              return (
                <button
                  aria-pressed={focusWindow === option}
                  className={cn(
                    "min-h-8 rounded px-2 text-xs font-semibold transition",
                    focusWindow === option
                      ? "bg-white text-stone-950"
                      : "text-stone-300 hover:bg-white/10 hover:text-white",
                  )}
                  key={option}
                  onClick={() => changeFocusWindow(option)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          aria-label={t("recordingOverview")}
          aria-valuemax={maxSeconds}
          aria-valuemin={0}
          aria-valuenow={playheadSeconds}
          aria-valuetext={formatDuration(playheadSeconds)}
          className="relative mt-3 h-16 touch-none select-none overflow-hidden rounded-md border border-white/15 bg-stone-900"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              seekTo(playheadSeconds - (event.shiftKey ? 60 : 15));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              seekTo(playheadSeconds + (event.shiftKey ? 60 : 15));
            }
          }}
          onPointerDown={(event) => {
            const nextSeconds = secondFromOverviewPointer(
              event.clientX,
              event.currentTarget,
            );
            seekTo(nextSeconds);
            setViewStartSeconds(
              windowStartFor(nextSeconds, focusedSeconds, maxSeconds),
            );
          }}
          role="slider"
          tabIndex={0}
        >
          <span
            aria-hidden="true"
            className="absolute bottom-2 top-2 border border-sky-200/70 bg-sky-200/10"
            style={{
              left: `${overviewWindowLeft}%`,
              width: `${Math.max(
                overviewWindowRight - overviewWindowLeft,
                0.8,
              )}%`,
            }}
          />
          {timelineMarks(maxSeconds).map((mark, index) => (
            <span
              aria-hidden="true"
              className="absolute bottom-0 top-0 w-px bg-white/10"
              key={`${mark}-${index}`}
              style={{ left: `${percentAt(mark, maxSeconds)}%` }}
            />
          ))}
          {segments
            .filter((segment) => segment.status !== "discarded")
            .map((segment) => (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-2 h-3 rounded-sm",
                  segment.status === "transcribed"
                    ? "bg-emerald-300/80"
                    : "bg-sky-300/80",
                )}
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
            className="absolute bottom-2 h-3 rounded-sm bg-emerald-300/80"
            style={{
              left: `${overviewSelectionLeft}%`,
              width: `${Math.max(
                overviewSelectionRight - overviewSelectionLeft,
                0.8,
              )}%`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute bottom-0 top-0 w-0.5 bg-white"
            style={{ left: `${overviewPlayheadLeft}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between gap-2 text-xs font-semibold text-stone-400">
          {timelineMarks(maxSeconds).map((mark, index) => (
            <span className="tabular-nums" key={`${mark}-${index}`}>
              {formatDuration(mark)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            {t("workingWindow")}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-white">
            {formatDuration(viewStartSeconds)} - {formatDuration(viewEndSeconds)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            aria-label={t("previousWindow")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-40"
            disabled={focusWindow === "all" || viewStartSeconds <= 0}
            onClick={() => moveFocusWindow(-1)}
            title={t("previousWindow")}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label={t("nextWindow")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-40"
            disabled={focusWindow === "all" || viewEndSeconds >= maxSeconds}
            onClick={() => moveFocusWindow(1)}
            title={t("nextWindow")}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="relative mt-4 h-28 touch-none select-none overflow-hidden rounded-md border border-white/15 bg-stone-900"
        aria-label={t("workingWindow")}
        aria-valuemax={viewEndSeconds}
        aria-valuemin={viewStartSeconds}
        aria-valuenow={playheadSeconds}
        aria-valuetext={formatDuration(playheadSeconds)}
        onKeyDown={(event) => {
          if (event.key === " ") {
            event.preventDefault();
            togglePlayback();
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            seekTo(playheadSeconds - (event.shiftKey ? 5 : 1));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            seekTo(playheadSeconds + (event.shiftKey ? 5 : 1));
          }
          if (event.key === "[") {
            event.preventDefault();
            onStartChange(playheadSeconds);
          }
          if (event.key === "]") {
            event.preventDefault();
            onEndChange(playheadSeconds);
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
        {timelineMarks(focusedSeconds).map((offset, index) => (
          <span
            aria-hidden="true"
            className="absolute bottom-0 top-0 w-px bg-white/10"
            key={`${offset}-${index}`}
            style={{ left: `${percentAt(offset, focusedSeconds)}%` }}
          />
        ))}

        {segments
          .filter(
            (segment) =>
              segment.status !== "discarded" &&
              segment.endsAtSeconds >= viewStartSeconds &&
              segment.startsAtSeconds <= viewEndSeconds,
          )
          .map((segment) => (
            <span
              aria-hidden="true"
              className="absolute top-2 h-4 rounded-sm bg-sky-300/60 ring-1 ring-sky-100/50"
              key={segment.id}
              style={{
                left: `${percentAt(
                  clamp(
                    segment.startsAtSeconds - viewStartSeconds,
                    0,
                    focusedSeconds,
                  ),
                  focusedSeconds,
                )}%`,
                width: `${Math.max(
                  percentAt(
                    clamp(
                      segment.endsAtSeconds - viewStartSeconds,
                      0,
                      focusedSeconds,
                    ),
                    focusedSeconds,
                  ) -
                    percentAt(
                      clamp(
                        segment.startsAtSeconds - viewStartSeconds,
                        0,
                        focusedSeconds,
                      ),
                      focusedSeconds,
                    ),
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
        {timelineMarks(focusedSeconds).map((offset, index) => (
          <span className="tabular-nums" key={`${offset}-${index}`}>
            {formatDuration(
              Math.min(viewStartSeconds + offset, viewEndSeconds),
            )}
          </span>
        ))}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white/10 p-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
              {t("selectedRange")}
            </p>
            <p className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums">
              {formatDuration(startsAtSeconds)} - {formatDuration(endsAtSeconds)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-300">
              {t("existingClips")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {
                segments.filter((segment) => segment.status !== "discarded")
                  .length
              }
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
            aria-label={t("previewStart")}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
            onClick={() =>
              void playFrom(
                Math.max(startsAtSeconds - 3, 0),
                Math.min(startsAtSeconds + 3, maxSeconds),
              )
            }
            title={t("previewStart")}
            type="button"
          >
            <Play aria-hidden="true" className="h-3.5 w-3.5" />
            {t("startTime")}
          </button>
          <button
            aria-label={t("previewEnd")}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
            onClick={() =>
              void playFrom(
                Math.max(endsAtSeconds - 3, 0),
                Math.min(endsAtSeconds + 3, maxSeconds),
              )
            }
            title={t("previewEnd")}
            type="button"
          >
            <Play aria-hidden="true" className="h-3.5 w-3.5" />
            {t("endTime")}
          </button>
        </div>
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

function SavedClipMap({
  activeSegmentId,
  durationSeconds,
  onSegmentSelect,
  segments,
}: {
  activeSegmentId: string;
  durationSeconds: number;
  onSegmentSelect: (segment: LessonSegment) => void;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const maxSeconds = Math.max(durationSeconds, 1);
  const usefulSegments = segments.filter((segment) => segment.status !== "discarded");
  const activeSegment = usefulSegments.find(
    (segment) => segment.id === activeSegmentId,
  );

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            {t("lessonMap")}
          </p>
          <h4 className="mt-1 text-base font-semibold text-stone-950">
            {t("selectedClipMap")}
          </h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
            {t("selectedClipMapNote")}
          </p>
        </div>
        <span className="rounded-md bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
          {usefulSegments.length} / {segments.length} {t("clips")}
        </span>
      </div>

      <div className="relative mt-3 h-24 overflow-hidden rounded-md border border-stone-200 bg-stone-950">
        {timelineMarks(maxSeconds).map((mark, index) => (
          <span
            aria-hidden="true"
            className="absolute bottom-0 top-0 w-px bg-white/10"
            key={`${mark}-${index}`}
            style={{ left: `${percentAt(mark, maxSeconds)}%` }}
          />
        ))}

        {usefulSegments.map((segment) => {
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
                "absolute top-2 h-6 rounded-sm transition",
                segment.status === "transcribed"
                  ? "bg-emerald-300/85"
                  : "bg-sky-300/85",
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {usefulSegments.map((segment, index) => {
          const isActive = segment.id === activeSegmentId;
          const isTranscribed = segment.status === "transcribed";

          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "rounded-md border p-3 text-left transition",
                isActive
                  ? isTranscribed
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-sky-300 bg-sky-50 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50",
              )}
              key={segment.id}
              onClick={() => onSegmentSelect(segment)}
              type="button"
            >
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {t("clip")} {index + 1}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-stone-950">
                    {segment.title}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold ring-1",
                    isTranscribed
                      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                      : "bg-blue-50 text-blue-800 ring-blue-200",
                  )}
                >
                  {segment.status}
                </span>
              </span>
              <span className="mt-2 block text-xs font-semibold tabular-nums text-stone-500">
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
        <p className="mt-2 text-xs font-semibold text-stone-500">
          {t("focusRange")}: {formatDuration(activeSegment.startsAtSeconds)} -{" "}
          {formatDuration(activeSegment.endsAtSeconds)}
        </p>
      ) : null}
    </div>
  );
}

function TimecodeField({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (seconds: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(formatDuration(value));

  useEffect(() => {
    setDraft(formatDuration(value));
  }, [value]);

  function commit() {
    const parsed = parseTimecode(draft);

    if (parsed === null) {
      setDraft(formatDuration(value));
      return;
    }

    onChange(clamp(parsed, min, max));
  }

  return (
    <input
      aria-label={`${label} ${formatDuration(value)}`}
      className="w-28 rounded-md border border-stone-300 bg-white px-3 py-2 text-right text-base font-semibold tabular-nums text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
      inputMode="numeric"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          setDraft(formatDuration(value));
        }
      }}
      value={draft}
    />
  );
}

function FineTrimControl({
  activeEdge,
  activeValue,
  maxValue,
  onActiveEdgeChange,
  onNudge,
}: {
  activeEdge: "start" | "end";
  activeValue: number;
  maxValue: number;
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
        aria-label={`${t("fineTrim")} ${activeEdge}`}
        aria-valuemax={maxValue}
        aria-valuemin={0}
        aria-valuenow={activeValue}
        aria-valuetext={formatDuration(activeValue)}
        className="mt-3 flex h-14 touch-none select-none items-center justify-center rounded-md border border-stone-300 bg-white px-3"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onNudge(event.shiftKey ? -5 : -1);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onNudge(event.shiftKey ? 5 : 1);
          }
        }}
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

      <div className="mt-2 grid grid-cols-4 gap-2">
        {[-5, -1, 1, 5].map((seconds) => (
          <button
            aria-label={`${seconds > 0 ? "+" : ""}${seconds} seconds`}
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
            key={seconds}
            onClick={() => onNudge(seconds)}
            type="button"
          >
            {seconds < 0 ? (
              <Minus aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {Math.abs(seconds)}s
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentReviewPanel({
  audioSrc,
  onAdjustRange,
  onChanged,
  segment,
  onSelect,
}: {
  audioSrc: string;
  onAdjustRange: (segment: LessonSegment) => void;
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
              {isSelected ? (
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saveState === "saving"}
                  onClick={() => onAdjustRange(segment)}
                  type="button"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  {t("adjustClipRange")}
                </button>
              ) : null}
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
              ) : isDiscarded ? (
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ClipReelControls({
  audioSrc,
  segments,
}: {
  audioSrc: string;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const clips = segments
    .filter((segment) => segment.status !== "discarded")
    .sort((a, b) => a.startsAtSeconds - b.startsAtSeconds);
  const activeClip = clips[activeClipIndex] ?? clips[0];
  const totalSeconds = selectedSeconds(clips);

  useEffect(() => {
    if (activeClipIndex >= clips.length) {
      setActiveClipIndex(Math.max(clips.length - 1, 0));
    }
  }, [activeClipIndex, clips.length]);

  async function playClip(index: number) {
    const player = audioRef.current;
    const clip = clips[index];

    if (!player || !clip) return;

    setActiveClipIndex(index);
    pendingSeekRef.current = clip.startsAtSeconds;
    if (player.readyState >= HTMLMediaElement.HAVE_METADATA) {
      player.currentTime = clip.startsAtSeconds;
      pendingSeekRef.current = null;
    }

    try {
      await player.play();
    } catch {
      setIsPlaying(false);
    }
  }

  function toggleReel() {
    const player = audioRef.current;
    if (!player || !activeClip) return;

    if (isPlaying) {
      player.pause();
      return;
    }

    if (
      player.readyState < HTMLMediaElement.HAVE_METADATA ||
      player.currentTime < activeClip.startsAtSeconds ||
      player.currentTime >= activeClip.endsAtSeconds
    ) {
      void playClip(activeClipIndex);
      return;
    }

    void player.play().catch(() => setIsPlaying(false));
  }

  if (!activeClip) return null;

  return (
    <div className="mt-3 border-y border-stone-800 bg-stone-950 px-3 py-3 text-white">
      <audio
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => {
          document.querySelectorAll("audio").forEach((audio) => { if (audio !== audioRef.current) audio.pause(); });
          setIsPlaying(true);
        }}
        onLoadedMetadata={() => {
          const player = audioRef.current;
          if (player && pendingSeekRef.current !== null) {
            player.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
        }}
        onTimeUpdate={(event) => {
          const player = event.currentTarget;
          const clip = clips[activeClipIndex];

          if (!clip || pendingSeekRef.current !== null || player.currentTime < clip.endsAtSeconds) return;

          if (activeClipIndex < clips.length - 1) {
            void playClip(activeClipIndex + 1);
            return;
          }

          player.pause();
          player.currentTime = clip.startsAtSeconds;
        }}
        preload="none"
        ref={audioRef}
        src={audioSrc}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-emerald-100">
            <ListMusic aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {t("clipReel")} / {clips.length} / {formatDuration(totalSeconds)}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {activeClip.notes || activeClip.title}
              <span className="ml-2 font-normal tabular-nums text-stone-300">
                {formatDuration(activeClip.startsAtSeconds)} -{" "}
                {formatDuration(activeClip.endsAtSeconds)}
              </span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[2.5rem_minmax(8rem,1fr)_2.5rem] gap-2">
          <button
            aria-label={t("previousClip")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-40"
            disabled={activeClipIndex === 0}
            onClick={() => void playClip(Math.max(activeClipIndex - 1, 0))}
            title={t("previousClip")}
            type="button"
          >
            <SkipBack aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
            onClick={toggleReel}
            type="button"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Play aria-hidden="true" className="h-4 w-4" />
            )}
            {isPlaying ? t("pauseClipReel") : t("playClipReel")}
          </button>
          <button
            aria-label={t("nextClip")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-40"
            disabled={activeClipIndex >= clips.length - 1}
            onClick={() =>
              void playClip(Math.min(activeClipIndex + 1, clips.length - 1))
            }
            title={t("nextClip")}
            type="button"
          >
            <SkipForward aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SegmentReviewQueue({
  activeSegmentId,
  audioSrc,
  durationSeconds,
  onActiveSegmentChange,
  onAdjustRange,
  onChanged,
  segments,
}: {
  activeSegmentId: string;
  audioSrc: string;
  durationSeconds: number;
  onActiveSegmentChange: (segment: LessonSegment) => void;
  onAdjustRange: (segment: LessonSegment) => void;
  onChanged: () => void;
  segments: LessonSegment[];
}) {
  const { t } = useLanguage();
  const activeSegment =
    segments.find((segment) => segment.id === activeSegmentId) ??
    segments.find((segment) => segment.status !== "discarded") ??
    segments[0];

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

      <div className="mt-3">
        <SavedClipMap
          activeSegmentId={activeSegment?.id ?? ""}
          durationSeconds={durationSeconds}
          onSegmentSelect={onActiveSegmentChange}
          segments={segments}
        />
      </div>

      <ClipReelControls audioSrc={audioSrc} segments={segments} />

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
                    ? isDiscarded
                      ? "border-rose-300 bg-rose-50 shadow-sm"
                      : "border-emerald-300 bg-emerald-50 shadow-sm"
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
            onAdjustRange={onAdjustRange}
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
  const formRef = useRef<HTMLFormElement>(null);
  const [startsAtSeconds, setStartsAtSeconds] = useState(0);
  const [endsAtSeconds, setEndsAtSeconds] = useState(defaultClipEnd(maxSeconds));
  const [activeEdge, setActiveEdge] = useState<"start" | "end">("end");
  const [activeSegmentId, setActiveSegmentId] = useState("");
  const [editingSegmentId, setEditingSegmentId] = useState("");
  const [title, setTitle] = useState(t("teachingSegment"));
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const selectedTotalSeconds = selectedSeconds(segments);
  const selectedCount = segments.filter(
    (segment) => segment.status !== "discarded",
  ).length;

  function selectSegment(segment: LessonSegment) {
    setActiveSegmentId(segment.id);
  }

  function adjustSegmentRange(segment: LessonSegment) {
    setActiveSegmentId(segment.id);
    setEditingSegmentId(segment.id);
    setStartsAtSeconds(segment.startsAtSeconds);
    setEndsAtSeconds(segment.endsAtSeconds);
    setActiveEdge("end");
    setTitle(segment.title);
    setNotes(segment.notes);
    setSaveState("idle");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelRangeEdit() {
    setEditingSegmentId("");
    setTitle(t("teachingSegment"));
    setNotes("");
    setSaveState("idle");
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

    const response = await fetch(
      editingSegmentId
        ? `/api/lesson-segments/${editingSegmentId}`
        : "/api/lesson-segments",
      {
        method: editingSegmentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endsAtSeconds,
          lessonId,
          notes,
          recordingId,
          startsAtSeconds,
          title,
        }),
      },
    );

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const body = (await response.json().catch(() => null)) as { id?: string } | null;

    setSaveState("saved");
    const savedSegmentId = body?.id ?? editingSegmentId;
    if (savedSegmentId) {
      setActiveSegmentId(savedSegmentId);
    }
    setEditingSegmentId("");
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
        ref={formRef}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-xl font-semibold leading-tight text-stone-950">
              {editingSegmentId
                ? t("editingClipRange")
                : t("addTeachingSegment")}
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
            <div
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
              onFocusCapture={() => setActiveEdge("start")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  {t("startTime")}
                </span>
                <TimecodeField
                  label={t("startTime")}
                  max={Math.max(endsAtSeconds - 1, 0)}
                  min={0}
                  onChange={setStart}
                  value={startsAtSeconds}
                />
              </span>
              <p className="mt-2 text-xs text-stone-500">{t("timecode")}</p>
            </div>
            <div
              className="rounded-md border border-stone-200 bg-stone-50 p-3"
              onFocusCapture={() => setActiveEdge("end")}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  {t("endTime")}
                </span>
                <TimecodeField
                  label={t("endTime")}
                  max={maxSeconds}
                  min={startsAtSeconds + 1}
                  onChange={setEnd}
                  value={endsAtSeconds}
                />
              </span>
              <p className="mt-2 text-xs text-stone-500">{t("timecode")}</p>
            </div>
          </div>

          <FineTrimControl
            activeEdge={activeEdge}
            activeValue={
              activeEdge === "start" ? startsAtSeconds : endsAtSeconds
            }
            maxValue={maxSeconds}
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
          <div className="flex flex-wrap gap-2">
            {editingSegmentId ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                onClick={cancelRangeEdit}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                {t("cancelRangeEdit")}
              </button>
            ) : null}
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saveState === "saving"}
              type="submit"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              {saveState === "saving"
                ? t("saving")
                : editingSegmentId
                  ? t("updateSegment")
                  : t("addSegment")}
            </button>
          </div>
        </div>
      </form>

      <SegmentReviewQueue
        activeSegmentId={activeSegmentId}
        audioSrc={audioSrc}
        durationSeconds={maxSeconds}
        onActiveSegmentChange={selectSegment}
        onAdjustRange={adjustSegmentRange}
        onChanged={onChanged}
        segments={segments}
      />
    </section>
  );
}
