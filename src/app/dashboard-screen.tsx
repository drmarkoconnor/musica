"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Mic2,
  Music2,
  Timer,
} from "lucide-react";
import { ActionCard } from "@/components/action-card";
import { AudioStrip } from "@/components/audio-strip";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { LanguageToggle } from "@/components/language-toggle";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import { pieceTempoLabel } from "@/lib/piece-labels";

export function DashboardScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { pieces, practiceTasks, smartQueue } = data;
  const activePieces = pieces.filter((piece) => piece.status !== "parked");
  const neglectedPieces = activePieces.filter((piece) =>
    ["blue-in-green", "stella-by-starlight", "on-green-dolphin-street"].includes(
      piece.id,
    ),
  ).length > 0
    ? activePieces.filter((piece) =>
        ["blue-in-green", "stella-by-starlight", "on-green-dolphin-street"].includes(
          piece.id,
        ),
      )
    : activePieces
        .filter((piece) => piece.isSpineTune)
        .sort((a, b) => a.lastPractised.localeCompare(b.lastPractised))
        .slice(0, 3);
  const activeSpineTuneCount = activePieces.filter((piece) => piece.isSpineTune)
    .length;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            detail="Leo lesson, quick capture, audio first."
            href="/lessons"
            icon={Mic2}
            title={t("startLessonRecording")}
          />
          <ActionCard
            detail="Queue, timer, notes, tempo, confidence."
            href="/practice"
            icon={Timer}
            title={t("startPracticeSession")}
            tone="blue"
          />
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                {t("today")}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-stone-950">
                {t("dashboard")}
              </h1>
            </div>
            <LanguageToggle />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-2xl font-semibold text-emerald-950">3</p>
              <p className="text-xs font-medium text-emerald-800">
                {t("newFromLesson")}
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-2xl font-semibold text-sky-950">
                {activeSpineTuneCount}
              </p>
              <p className="text-xs font-medium text-sky-800">
                {t("spineTune")}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-2xl font-semibold text-amber-950">
                {neglectedPieces.length}
              </p>
              <p className="text-xs font-medium text-amber-800">{t("overdue")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Section title={t("smartQueue")}>
          <div className="space-y-3">
            {smartQueue.map((item) => (
              <div
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={item.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        tone={
                          item.kind === "lesson_task"
                            ? "amber"
                            : item.kind === "exercise"
                              ? "green"
                              : "blue"
                        }
                      >
                        {item.kind === "lesson_task"
                          ? t("newFromLesson")
                          : item.kind === "exercise"
                            ? t("warmUp")
                            : t("spineTune")}
                      </StatusPill>
                      <span className="text-sm text-stone-500">
                        {item.minutes} {t("minutes")}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-stone-950">
                      {item.title}
                    </h3>
                    <p className="text-sm text-stone-600">{item.reason}</p>
                  </div>
                  {item.confidence ? (
                    <ConfidenceMeter value={item.confidence} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("recentLessonItems")}>
          <div className="space-y-3">
            {practiceTasks.slice(0, 2).map((task) => (
              <div
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                key={task.id}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-stone-950">
                    {task.title}
                  </h3>
                  <StatusPill tone="green">{task.status}</StatusPill>
                </div>
                <p className="text-sm leading-6 text-stone-600">{task.body}</p>
                <div className="mt-3">
                  <AudioStrip
                    endsAtSeconds={task.endsAtSeconds}
                    startsAtSeconds={task.startsAtSeconds}
                    title={task.title}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section
        action={
          <Link
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
            href="/repertoire"
          >
            <Music2 aria-hidden="true" className="h-4 w-4" />
            {t("repertoire")}
          </Link>
        }
        title={t("neglectedRepertoire")}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {neglectedPieces.map((piece) => (
            <Link
              className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
              href={`/repertoire/${piece.id}`}
              key={piece.id}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-1 h-5 w-5 text-amber-700"
                />
                <div className="space-y-2">
                  <h3 className="font-semibold text-stone-950">{piece.title}</h3>
                  <p className="text-sm text-stone-600">
                    {t("lastPractised")}: {piece.lastPractised}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    {pieceTempoLabel(piece, t("bpm"))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
