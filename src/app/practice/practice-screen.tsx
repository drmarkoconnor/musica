"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock3,
  ExternalLink,
  ListPlus,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { Confidence, SmartQueueItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionPlanItem = {
  id: string;
  title: string;
  reason: string;
  minutes: number;
  confidence?: Confidence;
  tempo?: number;
  sourceLabel: string;
  queueItemId?: string;
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(90, Math.max(1, Math.round(value)));
}

export function PracticeScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { sessionItems, smartQueue } = data;
  const [planItems, setPlanItems] = useState<SessionPlanItem[]>(() =>
    sessionItems.map((item) => ({
      id: `session-${item.id}`,
      title: item.title,
      reason: item.reason,
      minutes: item.plannedMinutes,
      confidence: item.confidenceBefore,
      tempo: item.tempo,
      sourceLabel: t("practiceSession"),
    })),
  );
  const [activePlanItemId, setActivePlanItemId] = useState<string | null>(
    () => (sessionItems[0] ? `session-${sessionItems[0].id}` : null),
  );
  const [customTitle, setCustomTitle] = useState("");
  const [customMinutes, setCustomMinutes] = useState("10");
  const activePlanItem =
    planItems.find((item) => item.id === activePlanItemId) ?? planItems[0] ?? null;
  const currentMinutes = activePlanItem?.minutes ?? 10;
  const currentTempo = activePlanItem?.tempo ?? 72;
  const plannedSeconds = Math.max(60, currentMinutes * 60);
  const totalMinutes = planItems.reduce((total, item) => total + item.minutes, 0);
  const [secondsRemaining, setSecondsRemaining] = useState(plannedSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [bpm, setBpm] = useState(currentTempo);
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  function sourceLabelFor(item: SmartQueueItem) {
    if (item.kind === "lesson_task") return t("sourceLesson");
    if (item.kind === "exercise") return t("exercise");
    return t("piece");
  }

  function addSuggestion(item: SmartQueueItem) {
    const existing = planItems.find((planItem) => planItem.queueItemId === item.id);
    if (existing) {
      setActivePlanItemId(existing.id);
      return;
    }

    const planItem: SessionPlanItem = {
      id: `queue-${item.id}`,
      title: item.title,
      reason: item.reason,
      minutes: item.minutes,
      confidence: item.confidence,
      sourceLabel: sourceLabelFor(item),
      queueItemId: item.id,
    };

    setPlanItems((current) => [...current, planItem]);
    setActivePlanItemId(planItem.id);
  }

  function addCustomItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = customTitle.trim();
    if (!title) return;

    const planItem: SessionPlanItem = {
      id: `custom-${Date.now()}`,
      title,
      reason: t("manualPracticeItem"),
      minutes: clampMinutes(Number(customMinutes)),
      sourceLabel: t("manualPracticeItem"),
    };

    setPlanItems((current) => [...current, planItem]);
    setActivePlanItemId(planItem.id);
    setCustomTitle("");
    setCustomMinutes("10");
  }

  function removePlanItem(itemId: string) {
    setPlanItems((current) => current.filter((item) => item.id !== itemId));
    if (activePlanItemId === itemId) {
      const nextItem = planItems.find((item) => item.id !== itemId);
      setActivePlanItemId(nextItem?.id ?? null);
    }
  }

  useEffect(() => {
    setSecondsRemaining(plannedSeconds);
    setIsTimerRunning(false);
    setBpm(currentTempo);
    setIsMetronomeRunning(false);
  }, [activePlanItem?.id, currentTempo, plannedSeconds]);

  useEffect(() => {
    if (!isTimerRunning) return;

    const timerId = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          setIsTimerRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimerRunning]);

  function playMetronomeClick() {
    const AudioContextClass =
      window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;

    const context =
      audioContextRef.current ?? new AudioContextClass({ latencyHint: "interactive" });
    audioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    oscillator.type = "square";
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.05);
    setBeatFlash(true);
    window.setTimeout(() => setBeatFlash(false), 80);
  }

  useEffect(() => {
    if (!isMetronomeRunning) return;

    playMetronomeClick();
    const intervalId = window.setInterval(playMetronomeClick, 60000 / bpm);

    return () => window.clearInterval(intervalId);
  }, [bpm, isMetronomeRunning]);

  function resetTimer() {
    setIsTimerRunning(false);
    setSecondsRemaining(plannedSeconds);
  }

  function adjustBpm(amount: number) {
    setBpm((current) => Math.min(240, Math.max(30, current + amount)));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {t("practiceSession")}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-stone-950">
              {t("sessionPlan")}
            </h1>
            <p className="mt-2 text-sm font-medium text-stone-600">
              {activePlanItem?.title ?? t("emptySessionPlan")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="blue">
              {planItems.length} {t("addItem")}
            </StatusPill>
            <StatusPill tone="green">
              {totalMinutes} {t("minutes")}
            </StatusPill>
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
                    {formatClock(secondsRemaining)}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    {activePlanItem?.title ?? t("notYet")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={isTimerRunning ? t("pause") : t("play")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-950 text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!activePlanItem}
                    onClick={() => setIsTimerRunning((current) => !current)}
                    type="button"
                  >
                    {isTimerRunning ? (
                      <Pause aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <Play aria-hidden="true" className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    aria-label={t("restore")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100"
                    onClick={resetTimer}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <span className="hidden h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-900 sm:inline-flex">
                    <Timer aria-hidden="true" className="h-6 w-6" />
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("metronome")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-5xl font-semibold tabular-nums text-stone-950">
                    {bpm}
                  </p>
                  <p className="mt-2 text-sm font-medium text-stone-500">
                    {t("bpm")}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    aria-label={isMetronomeRunning ? t("pause") : t("play")}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition hover:bg-emerald-900",
                      beatFlash ? "bg-emerald-700" : "bg-emerald-950",
                    )}
                    onClick={() =>
                      setIsMetronomeRunning((current) => !current)
                    }
                    type="button"
                  >
                    {isMetronomeRunning ? (
                      <Pause aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <Play aria-hidden="true" className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    aria-label="-5 BPM"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100"
                    onClick={() => adjustBpm(-5)}
                    type="button"
                  >
                    <Minus aria-hidden="true" className="h-5 w-5" />
                  </button>
                  <button
                    aria-label="+5 BPM"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100"
                    onClick={() => adjustBpm(5)}
                    type="button"
                  >
                    <Plus aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("confidence")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-stone-950">
                    {activePlanItem?.title ?? t("notYet")}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {t("currentTempo")}: {bpm} {t("bpm")}
                  </p>
                </div>
                <ConfidenceMeter value={activePlanItem?.confidence ?? 3} />
              </div>
            </div>
          </Section>

          <Section title={t("trackOverride")}>
            <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <a
                className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                href="https://www.quartetapp.com/"
                rel="noreferrer"
                target="_blank"
              >
                Quartet
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
              <textarea
                className="min-h-28 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                placeholder={t("notes")}
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t("sessionPlan")}>
            <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
              {planItems.length === 0 ? (
                <p className="p-4 text-sm text-stone-600">
                  {t("emptySessionPlan")}
                </p>
              ) : null}
              <ul className="divide-y divide-stone-200">
                {planItems.map((item, index) => {
                  const isActive = activePlanItem?.id === item.id;

                  return (
                    <li
                      className={cn(
                        "grid gap-3 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_auto] sm:items-center",
                        isActive ? "bg-emerald-50" : "bg-white",
                      )}
                      key={item.id}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-950">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-stone-600">
                          {item.reason}
                        </p>
                      </div>
                      <StatusPill tone="blue">
                        {item.minutes} {t("minutes")}
                      </StatusPill>
                      <div className="flex gap-1.5 sm:justify-end">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100"
                          onClick={() => setActivePlanItemId(item.id)}
                          title={t("start")}
                          type="button"
                        >
                          <Play aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("start")}</span>
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-800 transition hover:bg-rose-50"
                          onClick={() => removePlanItem(item.id)}
                          title={t("remove")}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("remove")}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <form
                className="grid gap-2 border-t border-stone-200 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
                onSubmit={addCustomItem}
              >
                <input
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder={t("customItem")}
                  value={customTitle}
                />
                <input
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  min="1"
                  max="90"
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  type="number"
                  value={customMinutes}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                  type="submit"
                >
                  <ListPlus aria-hidden="true" className="h-4 w-4" />
                  {t("addItem")}
                </button>
              </form>
            </div>
          </Section>

          <Section title={t("smartQueue")}>
            <div className="space-y-2">
              {smartQueue.map((item, index) => {
                const isInPlan = planItems.some(
                  (planItem) => planItem.queueItemId === item.id,
                );

                return (
                  <div
                    className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
                    key={item.id}
                  >
                    <div className="grid gap-3 sm:grid-cols-[2rem_minmax(0,1fr)_6rem_auto] sm:items-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-stone-100 text-sm font-semibold text-stone-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-950">
                          {item.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-sm text-stone-600">
                          {item.reason}
                        </p>
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
                      <button
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isInPlan}
                        onClick={() => addSuggestion(item)}
                        type="button"
                      >
                        <Check aria-hidden="true" className="h-4 w-4" />
                        {isInPlan ? t("selected") : t("accept")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title={t("notes")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-stone-600">
                <Clock3 aria-hidden="true" className="h-5 w-5 text-emerald-800" />
                {t("today")}
              </div>
              <textarea
                className="mt-4 min-h-28 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                placeholder={t("spokenNote")}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
