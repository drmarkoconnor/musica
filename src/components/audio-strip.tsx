"use client";

import { useRef, useState } from "react";
import { Headphones, Pause, Play, Square } from "lucide-react";
import { ComingSoonButton } from "./coming-soon-button";
import { useLanguage } from "@/lib/language";
import { cn, formatDuration } from "@/lib/utils";

const bars = [28, 42, 36, 58, 34, 46, 68, 38, 54, 32, 62, 48, 36, 56, 30, 44];

export function AudioStrip({
  title,
  audioSrc,
  controlsMode = "native",
  density = "regular",
  showLabel = true,
  showWaveform = true,
  startsAtSeconds,
  endsAtSeconds,
}: {
  title: string;
  audioSrc?: string;
  controlsMode?: "native" | "buttons";
  density?: "regular" | "compact";
  showLabel?: boolean;
  showWaveform?: boolean;
  startsAtSeconds?: number;
  endsAtSeconds?: number;
}) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const isCompact = density === "compact";
  const playLabel =
    typeof startsAtSeconds === "number"
      ? t("listenToClip")
      : isPlaying
        ? t("pause")
        : t("play");

  async function playFrom(seconds: number) {
    const player = audioRef.current;
    if (!player) return;

    setPlaybackError("");
    pendingSeekRef.current = seconds;

    if (player.readyState >= HTMLMediaElement.HAVE_METADATA) {
      player.currentTime = seconds;
    } else {
      player.load();
    }

    try {
      await player.play();
    } catch {
      setPlaybackError(t("playbackFailed"));
    }
  }

  function togglePlayback() {
    const player = audioRef.current;

    if (isPlaying && player) {
      player.pause();
      return;
    }

    void playFrom(startsAtSeconds ?? 0);
  }

  function stopPlayback() {
    const player = audioRef.current;
    if (!player) return;

    player.pause();
    player.currentTime = startsAtSeconds ?? 0;
    setIsPlaying(false);
  }

  function handleLoadedMetadata() {
    const player = audioRef.current;
    if (!player || pendingSeekRef.current === null) return;

    player.currentTime = pendingSeekRef.current;
    pendingSeekRef.current = null;
  }

  function handleTimeUpdate() {
    const player = audioRef.current;
    if (
      player &&
      typeof endsAtSeconds === "number" &&
      player.currentTime >= endsAtSeconds
    ) {
      player.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center",
        isCompact
          ? "gap-2"
          : "gap-3 rounded-lg border border-stone-200 bg-white p-3",
      )}
    >
      {showLabel ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-900",
              isCompact ? "h-8 w-8" : "h-10 w-10",
            )}
          >
            <Headphones
              aria-hidden="true"
              className={isCompact ? "h-4 w-4" : "h-5 w-5"}
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-950">
              {title}
            </p>
            {typeof startsAtSeconds === "number" ? (
              <p className="text-xs text-stone-500">
                {formatDuration(startsAtSeconds)}
                {typeof endsAtSeconds === "number"
                  ? ` - ${formatDuration(endsAtSeconds)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {showWaveform ? (
        <div
          className={cn("flex items-end gap-1", isCompact ? "h-8" : "h-10")}
          aria-hidden="true"
        >
          {bars.map((height, index) => (
            <span
              className={cn(
                "rounded-t bg-emerald-800/70",
                isCompact ? "w-1" : "w-1.5",
              )}
              key={`${height}-${index}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : null}
      {audioSrc ? (
        <div
          className={cn(
            "flex gap-2",
            isCompact
              ? "w-full flex-row items-center justify-end sm:w-auto"
              : "w-full flex-col sm:w-64",
          )}
        >
          <audio
            className={controlsMode === "native" ? "w-full" : "hidden"}
            controls={controlsMode === "native"}
            controlsList="nodownload"
            onCanPlay={() => {
              pendingSeekRef.current = null;
            }}
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={handleLoadedMetadata}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onTimeUpdate={handleTimeUpdate}
            playsInline
            preload="auto"
            ref={audioRef}
            src={audioSrc}
          />
          <div className={cn("grid grid-cols-2", isCompact ? "gap-1" : "gap-2")}>
            <button
              aria-label={playLabel}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 font-semibold text-stone-700 transition hover:bg-stone-100",
                isCompact ? "h-9 w-9 text-xs" : "px-3 py-2 text-sm",
              )}
              onClick={togglePlayback}
              title={playLabel}
              type="button"
            >
              {isPlaying ? (
                <Pause aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Play aria-hidden="true" className="h-4 w-4" />
              )}
              <span className={isCompact ? "sr-only" : ""}>{playLabel}</span>
            </button>
            <button
              aria-label={t("stopClip")}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 font-semibold text-stone-700 transition hover:bg-stone-100",
                isCompact ? "h-9 w-9 text-xs" : "px-3 py-2 text-sm",
              )}
              onClick={stopPlayback}
              title={t("stopClip")}
              type="button"
            >
              <Square aria-hidden="true" className="h-4 w-4" />
              <span className={isCompact ? "sr-only" : ""}>{t("stopClip")}</span>
            </button>
          </div>
          {playbackError ? (
            <p className="text-xs leading-5 text-rose-700">{playbackError}</p>
          ) : null}
        </div>
      ) : (
        <ComingSoonButton icon={Play}>
          {t("listenToClip")}
        </ComingSoonButton>
      )}
    </div>
  );
}
