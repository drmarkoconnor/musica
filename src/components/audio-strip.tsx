"use client";

import { useRef } from "react";
import { Headphones, Play } from "lucide-react";
import { ComingSoonButton } from "./coming-soon-button";
import { useLanguage } from "@/lib/language";
import { formatDuration } from "@/lib/utils";

const bars = [28, 42, 36, 58, 34, 46, 68, 38, 54, 32, 62, 48, 36, 56, 30, 44];

export function AudioStrip({
  title,
  audioSrc,
  startsAtSeconds,
  endsAtSeconds,
}: {
  title: string;
  audioSrc?: string;
  startsAtSeconds?: number;
  endsAtSeconds?: number;
}) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);

  function playFromStart() {
    const player = audioRef.current;
    if (!player) return;

    player.currentTime = startsAtSeconds ?? 0;
    void player.play();
  }

  function handleTimeUpdate() {
    const player = audioRef.current;
    if (
      player &&
      typeof endsAtSeconds === "number" &&
      player.currentTime >= endsAtSeconds
    ) {
      player.pause();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
          <Headphones aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-950">{title}</p>
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
      <div className="flex h-10 items-end gap-1" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            className="w-1.5 rounded-t bg-emerald-800/70"
            key={`${height}-${index}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      {audioSrc ? (
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <audio
            className="w-full"
            controls
            onTimeUpdate={handleTimeUpdate}
            preload="metadata"
            ref={audioRef}
            src={audioSrc}
          />
          {typeof startsAtSeconds === "number" ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              onClick={playFromStart}
              type="button"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              {t("listenToClip")}
            </button>
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
