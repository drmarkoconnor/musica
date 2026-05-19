"use client";

import { useEffect, useRef, useState } from "react";
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
  SkipForward,
  Timer,
} from "lucide-react";
import { ComingSoonButton } from "@/components/coming-soon-button";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

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
  const plannedSeconds = Math.max(60, currentItem.plannedMinutes * 60);
  const [secondsRemaining, setSecondsRemaining] = useState(plannedSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [bpm, setBpm] = useState(currentItem.tempo ?? 72);
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSecondsRemaining(plannedSeconds);
    setIsTimerRunning(false);
    setBpm(currentItem.tempo ?? 72);
    setIsMetronomeRunning(false);
  }, [currentItem.id, currentItem.tempo, plannedSeconds]);

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
                    {formatClock(secondsRemaining)}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    {currentItem.plannedMinutes} {t("minutes")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={isTimerRunning ? t("pause") : t("play")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-950 text-white transition hover:bg-emerald-900"
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
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-white transition ${
                      beatFlash ? "bg-emerald-700" : "bg-emerald-950"
                    } hover:bg-emerald-900`}
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
