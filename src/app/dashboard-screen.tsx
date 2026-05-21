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
import { LanguageToggle } from "@/components/language-toggle";
import { Section } from "@/components/section";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import { pieceTempoLabel } from "@/lib/piece-labels";
import { formatDateLabel, formatDuration } from "@/lib/utils";

type PracticeTotalRow = {
  id: string;
  label: string;
  seconds: number;
};

type PracticeDayRow = PracticeTotalRow & {
  shortLabel: string;
};

function buildPracticeTotals<T>(
  items: T[],
  getKey: (item: T) => string,
  getLabel: (item: T) => string,
  getSeconds: (item: T) => number,
) {
  const totals = new Map<string, PracticeTotalRow>();

  for (const item of items) {
    const id = getKey(item);
    const label = getLabel(item);

    if (!id || !label) continue;

    const existing = totals.get(id) ?? { id, label, seconds: 0 };
    existing.seconds += getSeconds(item);
    totals.set(id, existing);
  }

  return Array.from(totals.values()).sort(
    (left, right) => right.seconds - left.seconds || left.label.localeCompare(right.label),
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isWithinLastSevenDays(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) return false;

  return timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}

function lastSevenDayRows(
  items: Array<{ actualSeconds: number; recordedAt: string }>,
): PracticeDayRow[] {
  const formatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: PracticeDayRow[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const id = dateKey(date);
    const seconds = items
      .filter((item) => item.recordedAt.slice(0, 10) === id)
      .reduce((total, item) => total + item.actualSeconds, 0);

    rows.push({
      id,
      label: formatDateLabel(id),
      seconds,
      shortLabel: formatter.format(date),
    });
  }

  return rows;
}

function PracticeBarGraphic({
  emptyLabel,
  rows,
  title,
}: {
  emptyLabel: string;
  rows: PracticeDayRow[];
  title: string;
}) {
  const maxSeconds = Math.max(...rows.map((row) => row.seconds), 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
      <div className="mt-4 grid h-36 grid-cols-7 items-end gap-2">
        {rows.map((row) => {
          const heightPercent =
            maxSeconds > 0 ? Math.max(8, (row.seconds / maxSeconds) * 100) : 8;

          return (
            <div className="flex h-full min-w-0 flex-col justify-end gap-2" key={row.id}>
              <div className="flex h-full items-end">
                <div
                  aria-label={`${row.label}: ${formatDuration(row.seconds)}`}
                  className="w-full rounded-t-md bg-emerald-700/85"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="truncate text-center text-xs font-medium text-stone-500">
                {row.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
      {maxSeconds === 0 ? (
        <p className="mt-3 text-sm text-stone-600">{emptyLabel}</p>
      ) : null}
    </div>
  );
}

function PracticeMixGraphic({
  emptyLabel,
  rows,
  title,
}: {
  emptyLabel: string;
  rows: PracticeTotalRow[];
  title: string;
}) {
  const maxSeconds = Math.max(...rows.map((row) => row.seconds), 0);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-600">{emptyLabel}</p>
        ) : null}
        {rows.slice(0, 5).map((row, index) => (
          <div className="space-y-1.5" key={row.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-stone-800">
                {row.label}
              </span>
              <span className="font-semibold tabular-nums text-stone-950">
                {formatDuration(row.seconds)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className={
                  index % 3 === 0
                    ? "h-full rounded-full bg-sky-700"
                    : index % 3 === 1
                      ? "h-full rounded-full bg-emerald-700"
                      : "h-full rounded-full bg-amber-600"
                }
                style={{
                  width: `${maxSeconds > 0 ? (row.seconds / maxSeconds) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeTotalsPanel({
  emptyLabel,
  rows,
  title,
}: {
  emptyLabel: string;
  rows: PracticeTotalRow[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-stone-950">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-600">{emptyLabel}</p>
        ) : null}
        {rows.slice(0, 6).map((row) => (
          <div
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-stone-50 px-3 py-2"
            key={row.id}
          >
            <span className="truncate text-sm font-medium text-stone-800">
              {row.label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-stone-950">
              {formatDuration(row.seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const {
    exercises,
    pieces,
    practiceSessions,
    practiceTasks,
    recordings,
    sessionItems,
  } = data;
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
  const completedSessionItems = sessionItems
    .filter((item) => item.status === "done" && item.actualSeconds > 0)
    .map((item) => {
      const session = practiceSessions.find(
        (practiceSession) => practiceSession.id === item.sessionId,
      );
      const piece = item.pieceId
        ? pieces.find((pieceItem) => pieceItem.id === item.pieceId)
        : null;
      const task = item.practiceTaskId
        ? practiceTasks.find((practiceTask) => practiceTask.id === item.practiceTaskId)
        : null;
      const exercise = item.exerciseId
        ? exercises.find((exerciseItem) => exerciseItem.id === item.exerciseId)
        : null;

      return {
        ...item,
        label: piece?.title ?? task?.title ?? exercise?.title ?? item.title,
        exerciseLabel: exercise?.title ?? "",
        pieceLabel: piece?.title ?? "",
        recordedAt: session?.startedAt ?? "",
        taskLabel: task?.title ?? "",
      };
    })
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  const totalPracticeSeconds = completedSessionItems.reduce(
    (total, item) => total + item.actualSeconds,
    0,
  );
  const completedSessionIds = new Set(
    completedSessionItems.map((item) => item.sessionId),
  );
  const linkedPracticeRecordings = recordings.filter(
    (recording) => recording.kind !== "lesson" && recording.sessionItemId,
  );
  const pieceTotals = buildPracticeTotals(
    completedSessionItems.filter((item) => item.pieceId),
    (item) => item.pieceId ?? "",
    (item) => item.pieceLabel,
    (item) => item.actualSeconds,
  );
  const exerciseTotals = buildPracticeTotals(
    completedSessionItems.filter((item) => item.exerciseId),
    (item) => item.exerciseId ?? "",
    (item) => item.exerciseLabel,
    (item) => item.actualSeconds,
  );
  const practiceItemTotals = buildPracticeTotals(
    completedSessionItems.filter((item) => item.practiceTaskId || item.title),
    (item) => item.practiceTaskId ?? `session-item-${item.title}`,
    (item) => item.taskLabel || item.title,
    (item) => item.actualSeconds,
  );
  const sevenDayTotals = buildPracticeTotals(
    completedSessionItems.filter((item) => isWithinLastSevenDays(item.recordedAt)),
    (item) => item.recordedAt.slice(0, 10),
    (item) => formatDateLabel(item.recordedAt),
    (item) => item.actualSeconds,
  ).sort((left, right) => right.id.localeCompare(left.id));
  const sevenDayRows = lastSevenDayRows(completedSessionItems);
  const practiceMixRows = [
    {
      id: "pieces",
      label: t("byPiece"),
      seconds: pieceTotals.reduce((total, row) => total + row.seconds, 0),
    },
    {
      id: "exercises",
      label: t("byExercise"),
      seconds: exerciseTotals.reduce((total, row) => total + row.seconds, 0),
    },
    {
      id: "practice-items",
      label: t("byPracticeItem"),
      seconds: practiceItemTotals.reduce((total, row) => total + row.seconds, 0),
    },
  ].filter((row) => row.seconds > 0);

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

      <Section title={t("activityLog")}>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("totalPracticeTime")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-950">
              {formatDuration(totalPracticeSeconds)}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("loggedItems")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-950">
              {completedSessionItems.length}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("practiceSessions")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-950">
              {completedSessionIds.size}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              {t("practiceRecordings")}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-950">
              {linkedPracticeRecordings.length}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <PracticeBarGraphic
            emptyLabel={t("noLoggedTimeYet")}
            rows={sevenDayRows}
            title={t("weeklyPractice")}
          />
          <PracticeMixGraphic
            emptyLabel={t("noLoggedTimeYet")}
            rows={practiceMixRows}
            title={t("practiceMix")}
          />
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          <PracticeTotalsPanel
            emptyLabel={t("noLoggedTimeYet")}
            rows={pieceTotals}
            title={t("byPiece")}
          />
          <PracticeTotalsPanel
            emptyLabel={t("noLoggedTimeYet")}
            rows={exerciseTotals}
            title={t("byExercise")}
          />
          <PracticeTotalsPanel
            emptyLabel={t("noLoggedTimeYet")}
            rows={practiceItemTotals}
            title={t("byPracticeItem")}
          />
          <PracticeTotalsPanel
            emptyLabel={t("noLoggedTimeYet")}
            rows={sevenDayTotals}
            title={t("lastSevenDays")}
          />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          {completedSessionItems.slice(0, 8).map((item) => (
            <div
              className="grid gap-2 border-b border-stone-200 px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-950">
                  {item.label}
                </p>
                <p className="text-xs text-stone-500">
                  {item.recordedAt
                    ? formatDateLabel(item.recordedAt)
                    : t("notYet")}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-stone-800">
                {formatDuration(item.actualSeconds)}
              </span>
              <span className="text-stone-600">
                {item.confidenceAfter
                  ? `${t("confidence")} ${item.confidenceAfter}`
                  : t("notYet")}
              </span>
            </div>
          ))}
          {completedSessionItems.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-600">{t("notYet")}</p>
          ) : null}
        </div>
      </Section>

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
