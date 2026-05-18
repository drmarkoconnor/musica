"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Play, Plus, Square } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { useLanguage } from "@/lib/language";
import {
  originalLessonSeconds,
  teachingTranscriptBullets,
  type TeachingTranscriptBullet,
} from "@/lib/teaching-review";
import { formatDuration } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "error";

export function TeachingTranscriptReview({
  audioSrc,
  lessonId,
  recordingId,
}: {
  audioSrc: string;
  lessonId: string;
  recordingId: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [clipEnd, setClipEnd] = useState<number | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  function playClip(item: TeachingTranscriptBullet) {
    const player = audioRef.current;
    if (!player) return;

    setActiveClipId(item.id);
    setClipEnd(item.endsAtSeconds);
    player.currentTime = item.startsAtSeconds;
    void player.play();
  }

  function stopClip(item: TeachingTranscriptBullet) {
    const player = audioRef.current;
    if (!player) return;

    player.pause();
    player.currentTime = item.startsAtSeconds;
    setClipEnd(null);
    setActiveClipId(null);
  }

  function handleTimeUpdate() {
    const player = audioRef.current;
    if (player && clipEnd !== null && player.currentTime >= clipEnd) {
      player.pause();
      setClipEnd(null);
      setActiveClipId(null);
    }
  }

  async function createPracticeNote(item: TeachingTranscriptBullet) {
    if (!item.suggestedPracticeNote) return;

    setSaveStates((current) => ({ ...current, [item.id]: "saving" }));

    const response = await fetch("/api/practice-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        body: `${item.suggestedPracticeNote} Source context: ${
          item.body
        } Original lesson timestamp: ${formatDuration(
          originalLessonSeconds(item.startsAtSeconds),
        )}.`,
        sourceLessonId: lessonId,
        linkedRecordingId: recordingId,
        startsAtSeconds: item.startsAtSeconds,
        endsAtSeconds: item.endsAtSeconds,
      }),
    });

    if (!response.ok) {
      setSaveStates((current) => ({ ...current, [item.id]: "error" }));
      return;
    }

    setSaveStates((current) => ({ ...current, [item.id]: "saved" }));
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            {t("teachingReview")}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">
            {t("lessonSummary")}
          </h2>
        </div>
        <StatusPill tone="blue">{t("fixtureTranscript")}</StatusPill>
      </div>

      <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks
                aria-hidden="true"
                className="h-5 w-5 text-emerald-800"
              />
              <h3 className="text-lg font-semibold text-stone-950">
                {t("whatWasCovered")}
              </h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
              {t("lessonSummaryNote")}
            </p>
          </div>
          <audio
            className="w-full md:w-80"
            controls
            onTimeUpdate={handleTimeUpdate}
            preload="metadata"
            ref={audioRef}
            src={audioSrc}
          />
        </div>

        <ul className="mt-5 divide-y divide-stone-200">
          {teachingTranscriptBullets.map((item) => {
            const saveState = saveStates[item.id] ?? "idle";

            return (
              <li className="grid gap-3 py-4 md:grid-cols-[auto_1fr_auto]" key={item.id}>
                <div className="flex gap-1 md:flex-col">
                  <button
                    aria-label={`${t("listenToClip")}: ${item.title}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 text-emerald-900 transition hover:bg-emerald-50"
                    onClick={() => playClip(item)}
                    title={`${formatDuration(item.startsAtSeconds)} - ${formatDuration(
                      item.endsAtSeconds,
                    )}`}
                    type="button"
                  >
                    <Play aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`${t("stopClip")}: ${item.title}`}
                    className="inline-flex h-7 w-9 items-center justify-center rounded-md border border-stone-300 text-stone-600 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={activeClipId !== item.id}
                    onClick={() => stopClip(item)}
                    title={t("stopClip")}
                    type="button"
                  >
                    <Square aria-hidden="true" className="h-3 w-3" />
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-stone-950">{item.title}</p>
                    <span className="text-xs font-medium text-stone-500">
                      {formatDuration(originalLessonSeconds(item.startsAtSeconds))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    {item.body}
                  </p>
                  {item.suggestedPracticeNote ? (
                    <p className="mt-2 text-sm font-medium text-stone-800">
                      {t("possibleFollowUp")}: {item.suggestedPracticeNote}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-start justify-end">
                  {item.suggestedPracticeNote ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={saveState === "saving" || saveState === "saved"}
                      onClick={() => void createPracticeNote(item)}
                      type="button"
                    >
                      {saveState === "saved" ? (
                        <Check aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Plus aria-hidden="true" className="h-4 w-4" />
                      )}
                      {saveState === "saving"
                        ? t("saving")
                        : saveState === "saved"
                          ? t("saved")
                          : t("savePracticeNote")}
                    </button>
                  ) : (
                    <StatusPill tone="slate">{t("contextOnly")}</StatusPill>
                  )}
                  {saveState === "error" ? (
                    <p className="ml-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      {t("saveFailed")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
