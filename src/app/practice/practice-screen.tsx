"use client";

import {
  Check,
  Clock3,
  ListPlus,
  RotateCcw,
  SkipForward,
  Timer,
} from "lucide-react";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

export function PracticeScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { sessionItems, smartQueue } = data;
  const currentItem = sessionItems[0] ?? {
    id: "current-smart-queue",
    sessionId: "current",
    position: 1,
    title: smartQueue[0]?.title ?? t("notYet"),
    reason: smartQueue[0]?.reason ?? "",
    status: "queued" as const,
    plannedMinutes: smartQueue[0]?.minutes ?? 10,
    confidenceBefore: smartQueue[0]?.confidence,
    tempo: 72,
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {t("practiceSession")}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-stone-950">
              {currentItem.title}
            </h1>
            <p className="mt-2 text-sm text-stone-600">{currentItem.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ComingSoonButton icon={Check} tone="primary">
              {t("accept")}
            </ComingSoonButton>
            <ComingSoonButton icon={SkipForward}>
              {t("skip")}
            </ComingSoonButton>
            <ComingSoonButton icon={RotateCcw}>
              {t("replace")}
            </ComingSoonButton>
            <ComingSoonButton icon={ListPlus}>
              {t("addItem")}
            </ComingSoonButton>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <Section title={t("timer")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-5xl font-semibold tabular-nums text-stone-950">
                    10:00
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    {currentItem.plannedMinutes} {t("minutes")}
                  </p>
                </div>
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-md bg-emerald-50 text-emerald-900">
                  <Timer aria-hidden="true" className="h-8 w-8" />
                </span>
              </div>
            </div>
          </Section>

          <Section title={t("metronome")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-5xl font-semibold tabular-nums text-stone-950">
                    {currentItem.tempo ?? 72}
                  </p>
                  <p className="mt-2 text-sm font-medium text-stone-500">
                    {t("bpm")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="h-11 w-11 cursor-not-allowed rounded-md border border-stone-300 bg-stone-100 text-lg font-semibold text-stone-400"
                    disabled
                    title={t("comingSoon")}
                    type="button"
                  >
                    -
                  </button>
                  <button
                    className="h-11 w-11 cursor-not-allowed rounded-md border border-stone-300 bg-stone-100 text-lg font-semibold text-stone-400"
                    disabled
                    title={t("comingSoon")}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("trackOverride")}>
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <textarea
                className="min-h-28 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                placeholder={t("notes")}
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t("smartQueue")}>
            <div className="space-y-3">
              {smartQueue.map((item, index) => (
                <div
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
                          {index + 1}
                        </span>
                        <h2 className="font-semibold text-stone-950">
                          {item.title}
                        </h2>
                      </div>
                      <p className="mt-2 text-sm text-stone-600">{item.reason}</p>
                    </div>
                    <StatusPill
                      tone={
                        item.kind === "lesson_task"
                          ? "amber"
                          : item.kind === "exercise"
                            ? "green"
                            : "blue"
                      }
                    >
                      {item.minutes} {t("minutes")}
                    </StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t("confidence")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    {currentItem.title}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {t("currentTempo")}: {currentItem.tempo ?? 72} {t("bpm")}
                  </p>
                </div>
                <ConfidenceMeter value={currentItem.confidenceBefore ?? 3} />
              </div>
            </div>
          </Section>

          <Section title={t("notes")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-stone-600">
                <Clock3 aria-hidden="true" className="h-5 w-5 text-emerald-800" />
                09:00 / {t("today")}
              </div>
              <textarea
                className="mt-4 min-h-36 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                placeholder={t("spokenNote")}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
