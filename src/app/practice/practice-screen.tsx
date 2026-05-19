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
  Square,
  Timer,
  Trash2,
} from "lucide-react";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { Confidence, SessionItemStatus, SmartQueueItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionPlanItem = {
  id: string;
  persistedId?: string;
  title: string;
  reason: string;
  minutes: number;
  confidence?: Confidence;
  tempo?: number;
  sourceLabel: string;
  queueItemId?: string;
  taskId?: string;
  pieceId?: string;
  exerciseId?: string;
  status: "planned" | SessionItemStatus;
  actualSeconds: number;
};

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const confidenceSteps: Confidence[] = [1, 2, 3, 4, 5];

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(180, Math.max(1, Math.round(value)));
}

function apiItem(item: SessionPlanItem) {
  return {
    confidence: item.confidence,
    exerciseId: item.exerciseId,
    minutes: item.minutes,
    pieceId: item.pieceId,
    reason: item.reason,
    taskId: item.taskId,
    tempo: item.tempo,
    title: item.title,
  };
}

export function PracticeScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { smartQueue } = data;
  const [planItems, setPlanItems] = useState<SessionPlanItem[]>([]);
  const [activePlanItemId, setActivePlanItemId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customMinutes, setCustomMinutes] = useState("10");
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [confidenceByItem, setConfidenceByItem] = useState<
    Record<string, Confidence | undefined>
  >({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [saveError, setSaveError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pingMessage, setPingMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [bpm, setBpm] = useState(72);
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activePlanItem =
    planItems.find((item) => item.id === activePlanItemId) ?? planItems[0] ?? null;
  const activeElapsed = activePlanItem?.actualSeconds ?? 0;
  const totalMinutes = planItems.reduce((total, item) => total + item.minutes, 0);
  const isLive = Boolean(sessionId);

  function sourceLabelFor(item: SmartQueueItem) {
    if (item.kind === "lesson_task") return t("sourceLesson");
    if (item.kind === "exercise") return t("exercise");
    return t("piece");
  }

  function planItemFromSuggestion(item: SmartQueueItem): SessionPlanItem {
    return {
      id: `queue-${item.id}`,
      title: item.title,
      reason: item.reason,
      minutes: item.minutes,
      confidence: item.confidence,
      sourceLabel: sourceLabelFor(item),
      queueItemId: item.id,
      taskId: item.taskId,
      pieceId: item.pieceId,
      exerciseId: item.exerciseId,
      status: "planned",
      actualSeconds: 0,
    };
  }

  function playShortPing() {
    const AudioContextClass =
      window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;

    const context =
      audioContextRef.current ?? new AudioContextClass({ latencyHint: "interactive" });
    audioContextRef.current = context;
    if (context.state === "suspended") {
      void context.resume();
    }

    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + index * 0.12;
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.1);
    });
  }

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

  function nextActiveItem(afterItemId?: string) {
    return planItems.find(
      (item) =>
        item.id !== afterItemId &&
        item.status !== "done" &&
        item.status !== "skipped" &&
        item.persistedId,
    );
  }

  async function addItemToLiveSession(item: SessionPlanItem) {
    if (!sessionId) return;

    setIsSaving(true);
    setSaveError("");
    const response = await fetch(`/api/practice-sessions/${sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiItem(item)),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(body?.error ?? t("saveFailed"));
      setIsSaving(false);
      return;
    }

    const body = (await response.json()) as { id: string };
    const liveItem = { ...item, persistedId: body.id, status: "accepted" as const };
    setPlanItems((current) => [...current, liveItem]);
    setActivePlanItemId(liveItem.id);
    setIsSaving(false);
  }

  function addSuggestion(item: SmartQueueItem) {
    const existing = planItems.find((planItem) => planItem.queueItemId === item.id);
    if (existing) {
      setActivePlanItemId(existing.id);
      return;
    }

    const planItem = planItemFromSuggestion(item);
    if (sessionId) {
      void addItemToLiveSession(planItem);
      return;
    }

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
      status: "planned",
      actualSeconds: 0,
    };

    if (sessionId) {
      void addItemToLiveSession(planItem);
    } else {
      setPlanItems((current) => [...current, planItem]);
      setActivePlanItemId(planItem.id);
    }

    setCustomTitle("");
    setCustomMinutes("10");
  }

  async function removePlanItem(itemId: string) {
    const item = planItems.find((planItem) => planItem.id === itemId);
    if (!item) return;

    if (item.persistedId) {
      setIsSaving(true);
      setSaveError("");
      const response = await fetch(`/api/session-items/${item.persistedId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSaveError(body?.error ?? t("saveFailed"));
        setIsSaving(false);
        return;
      }
    }

    setPlanItems((current) => current.filter((planItem) => planItem.id !== itemId));
    if (activePlanItemId === itemId) {
      setActivePlanItemId(nextActiveItem(itemId)?.id ?? null);
      setIsRunning(false);
    }
    setIsSaving(false);
  }

  async function startLiveSession() {
    if (planItems.length === 0) {
      setSaveError(t("emptySessionPlan"));
      return;
    }

    setIsSaving(true);
    setSaveError("");
    const response = await fetch("/api/practice-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: planItems.map(apiItem) }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(body?.error ?? t("saveFailed"));
      setIsSaving(false);
      return;
    }

    const body = (await response.json()) as {
      id: string;
      items: { id: string; position: number }[];
    };
    const itemsByPosition = new Map(
      body.items.map((item) => [item.position, item.id]),
    );
    const liveItems = planItems.map((item, index) => ({
      ...item,
      persistedId: itemsByPosition.get(index + 1),
      status: "accepted" as const,
    }));

    setSessionId(body.id);
    setPlanItems(liveItems);
    setActivePlanItemId(liveItems[0]?.id ?? null);
    setIsRunning(Boolean(liveItems[0]));
    setIsSaving(false);
    setStatusMessage(t("sessionStarted"));
  }

  async function finishActiveItem(status: "done" | "skipped") {
    if (!activePlanItem?.persistedId) return;

    setIsSaving(true);
    setSaveError("");
    const response = await fetch(`/api/session-items/${activePlanItem.persistedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualSeconds: activePlanItem.actualSeconds,
        confidenceAfter: confidenceByItem[activePlanItem.id],
        notes: notesByItem[activePlanItem.id] ?? "",
        status,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(body?.error ?? t("saveFailed"));
      setIsSaving(false);
      return;
    }

    setPlanItems((current) =>
      current.map((item) =>
        item.id === activePlanItem.id ? { ...item, status } : item,
      ),
    );
    const nextItem = nextActiveItem(activePlanItem.id);
    setActivePlanItemId(nextItem?.id ?? null);
    setIsRunning(Boolean(nextItem));
    setStatusMessage(status === "done" ? t("itemLogged") : t("skipLogged"));
    setIsSaving(false);
  }

  async function finishSession() {
    if (!sessionId) return;

    setIsSaving(true);
    setSaveError("");
    const response = await fetch(`/api/practice-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ended: true, notes: sessionNotes }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setSaveError(body?.error ?? t("saveFailed"));
      setIsSaving(false);
      return;
    }

    setIsRunning(false);
    setSessionId(null);
    setActivePlanItemId(null);
    setPlanItems([]);
    setNotesByItem({});
    setConfidenceByItem({});
    setSessionNotes("");
    setStatusMessage(t("sessionSaved"));
    setIsSaving(false);
  }

  function adjustBpm(amount: number) {
    setBpm((current) => Math.min(240, Math.max(30, current + amount)));
  }

  useEffect(() => {
    if (!activePlanItem) return;
    setBpm(activePlanItem.tempo ?? 72);
    setPingMessage("");
  }, [activePlanItem?.id]);

  useEffect(() => {
    if (!isRunning || !activePlanItem) return;

    const timerId = window.setInterval(() => {
      setPlanItems((current) =>
        current.map((item) => {
          if (item.id !== activePlanItem.id) return item;

          const nextSeconds = item.actualSeconds + 1;
          if (nextSeconds > 0 && nextSeconds % 300 === 0) {
            setPingMessage(t("fiveMinuteMarker"));
            playShortPing();
          }

          return { ...item, actualSeconds: nextSeconds };
        }),
      );
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [activePlanItem?.id, isRunning, t]);

  useEffect(() => {
    if (!isMetronomeRunning) return;

    playMetronomeClick();
    const intervalId = window.setInterval(playMetronomeClick, 60000 / bpm);

    return () => window.clearInterval(intervalId);
  }, [bpm, isMetronomeRunning]);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {t("practiceSession")}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-stone-950">
              {isLive ? activePlanItem?.title ?? t("notYet") : t("sessionPlan")}
            </h1>
            <p className="mt-2 text-sm font-medium text-stone-600">
              {isLive
                ? activePlanItem?.reason ?? t("emptySessionPlan")
                : t("emptySessionPlan")}
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

      {saveError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {saveError}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <Section title={isLive ? t("liveSession") : t("timer")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-5xl font-semibold tabular-nums text-stone-950">
                    {formatClock(activeElapsed)}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    {isLive ? t("elapsed") : activePlanItem?.title ?? t("notYet")}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    aria-label={isRunning ? t("pause") : t("play")}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-950 text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!activePlanItem || !isLive}
                    onClick={() => setIsRunning((current) => !current)}
                    type="button"
                  >
                    {isRunning ? (
                      <Pause aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <Play aria-hidden="true" className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    aria-label={t("done")}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!activePlanItem || !isLive || isSaving}
                    onClick={() => void finishActiveItem("done")}
                    type="button"
                  >
                    <Check aria-hidden="true" className="h-4 w-4" />
                    {t("done")}
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!activePlanItem || !isLive || isSaving}
                    onClick={() => void finishActiveItem("skipped")}
                    type="button"
                  >
                    <Square aria-hidden="true" className="h-4 w-4" />
                    {t("skipToday")}
                  </button>
                </div>
              </div>

              {pingMessage ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span>{pingMessage}</span>
                  <button
                    className="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-semibold text-amber-900"
                    onClick={() => setPingMessage("")}
                    type="button"
                  >
                    {t("continue")}
                  </button>
                </div>
              ) : null}
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

          <Section title={t("notes")}>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-stone-600">
                <Clock3 aria-hidden="true" className="h-5 w-5 text-emerald-800" />
                {activePlanItem?.title ?? t("today")}
              </div>
              <textarea
                className="mt-4 min-h-28 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                disabled={!activePlanItem}
                onChange={(event) => {
                  if (!activePlanItem) return;
                  setNotesByItem((current) => ({
                    ...current,
                    [activePlanItem.id]: event.target.value,
                  }));
                }}
                placeholder={t("spokenNote")}
                value={activePlanItem ? notesByItem[activePlanItem.id] ?? "" : ""}
              />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-stone-800">
                  {t("optionalConfidence")}
                </span>
                {confidenceSteps.map((step) => (
                  <button
                    aria-label={`${t("confidence")} ${step}`}
                    aria-pressed={
                      activePlanItem
                        ? confidenceByItem[activePlanItem.id] === step
                        : false
                    }
                    className={cn(
                      "h-8 w-8 rounded-md border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                      activePlanItem &&
                        confidenceByItem[activePlanItem.id] === step
                        ? "border-emerald-800 bg-emerald-950 text-white"
                        : "border-stone-300 text-stone-700 hover:bg-stone-100",
                    )}
                    disabled={!activePlanItem}
                    key={step}
                    onClick={() => {
                      if (!activePlanItem) return;
                      setConfidenceByItem((current) => ({
                        ...current,
                        [activePlanItem.id]: step,
                      }));
                    }}
                    type="button"
                  >
                    {step}
                  </button>
                ))}
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
                className="min-h-20 w-full resize-none rounded-md border border-stone-300 p-3 text-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                onChange={(event) => setSessionNotes(event.target.value)}
                placeholder={t("notes")}
                value={sessionNotes}
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            action={
              isLive ? (
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
                  onClick={() => void finishSession()}
                  type="button"
                >
                  <Timer aria-hidden="true" className="h-4 w-4" />
                  {t("finishSession")}
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || planItems.length === 0}
                  onClick={() => void startLiveSession()}
                  type="button"
                >
                  <Play aria-hidden="true" className="h-4 w-4" />
                  {t("startLiveSession")}
                </button>
              )
            }
            title={t("sessionPlan")}
          >
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
                          {item.status === "done"
                            ? t("done")
                            : item.status === "skipped"
                              ? t("skipToday")
                              : item.reason}
                        </p>
                      </div>
                      <StatusPill tone={item.status === "done" ? "green" : "blue"}>
                        {formatClock(item.actualSeconds)}
                      </StatusPill>
                      <div className="flex gap-1.5 sm:justify-end">
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!isLive || item.status === "done"}
                          onClick={() => {
                            setActivePlanItemId(item.id);
                            setIsRunning(isLive);
                          }}
                          title={t("start")}
                          type="button"
                        >
                          <Play aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("start")}</span>
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSaving}
                          onClick={() => void removePlanItem(item.id)}
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
                  max="180"
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  type="number"
                  value={customMinutes}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving}
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
                        disabled={isInPlan || isSaving}
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
        </div>
      </div>
    </div>
  );
}
