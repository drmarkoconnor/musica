"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Edit3,
  RotateCcw,
  Tags,
  Trash2,
} from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { PracticeStatus } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

export function FromLessonsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { exercises, lessonRecordings, lessons, pieces, practiceTasks, tags } =
    data;
  const lessonTasks = practiceTasks
    .filter((task) => task.source === "lesson")
    .sort((a, b) => {
      if (a.status === "parked" && b.status !== "parked") return 1;
      if (a.status !== "parked" && b.status === "parked") return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  const activeCount = lessonTasks.filter(
    (task) => task.status !== "parked",
  ).length;
  const parkedCount = lessonTasks.length - activeCount;
  const [actionState, setActionState] = useState<
    Record<string, "idle" | "saving" | "error">
  >({});

  async function updateTaskStatus(taskId: string, status: PracticeStatus) {
    setActionState((current) => ({ ...current, [taskId]: "saving" }));

    const response = await fetch(`/api/practice-tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setActionState((current) => ({ ...current, [taskId]: "error" }));
      return;
    }

    setActionState((current) => ({ ...current, [taskId]: "idle" }));
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm(t("confirmDeletePracticeTask"))) return;

    setActionState((current) => ({ ...current, [taskId]: "saving" }));

    const response = await fetch(`/api/practice-tasks/${taskId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setActionState((current) => ({ ...current, [taskId]: "error" }));
      return;
    }

    setActionState((current) => ({ ...current, [taskId]: "idle" }));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Section
        action={
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="green">
              {activeCount} {t("active")}
            </StatusPill>
            <StatusPill tone="slate">
              {parkedCount} {t("parked")}
            </StatusPill>
          </div>
        }
        eyebrow={t("sourceLesson")}
        title={t("fromLessons")}
      >
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          {lessonTasks.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-stone-600">
              {t("notYet")}
            </div>
          ) : null}
          <ul className="divide-y divide-stone-200">
            {lessonTasks.map((task) => {
              const piece = task.linkedPieceId
                ? pieces.find((item) => item.id === task.linkedPieceId)
                : null;
              const exercise = task.linkedExerciseId
                ? exercises.find((item) => item.id === task.linkedExerciseId)
                : null;
              const lesson = lessons.find(
                (item) => item.id === task.sourceLessonId,
              );
              const recording = task.linkedRecordingId
                ? lessonRecordings.find(
                    (item) => item.id === task.linkedRecordingId,
                  )
                : null;
              const audioSrc =
                recording?.storageBucket === "local-test-audio" ||
                recording?.storageBucket === "local-lesson-audio" ||
                recording?.storageBucket === "netlify-blobs"
                  ? `/api/lesson-recordings/${recording.id}/file`
                  : undefined;
              const isParked = task.status === "parked";
              const isSaving = actionState[task.id] === "saving";
              const hasError = actionState[task.id] === "error";
              const clipLabel =
                typeof task.startsAtSeconds === "number"
                  ? `${formatDuration(task.startsAtSeconds)}${
                      typeof task.endsAtSeconds === "number"
                        ? ` - ${formatDuration(task.endsAtSeconds)}`
                        : ""
                    }`
                  : t("notYet");

              return (
                <li
                  className={`p-3 ${isParked ? "bg-stone-50 text-stone-500" : ""}`}
                  key={task.id}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_10rem_9rem_auto] lg:items-center">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-stone-950">
                        {task.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-5 text-stone-600">
                        {task.body}
                      </p>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-stone-900">
                        {lesson?.title ?? t("notYet")}
                      </p>
                      <p className="mt-1 truncate text-xs text-stone-500">
                        {piece?.title ?? exercise?.title ?? t("notYet")}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold tabular-nums text-stone-900">
                        {clipLabel}
                      </p>
                      <StatusPill
                        className="mt-1"
                        tone={
                          task.status === "new"
                            ? "amber"
                            : task.status === "parked"
                              ? "slate"
                              : "green"
                        }
                      >
                        {task.status}
                      </StatusPill>
                    </div>
                    <div className="flex flex-wrap justify-start gap-1 lg:justify-end">
                      <AudioStrip
                        audioSrc={audioSrc}
                        controlsMode="buttons"
                        density="compact"
                        endsAtSeconds={task.endsAtSeconds}
                        showLabel={false}
                        showWaveform={false}
                        startsAtSeconds={task.startsAtSeconds}
                        title={task.title}
                      />
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 text-stone-500 opacity-70"
                        disabled
                        title={t("edit")}
                        type="button"
                      >
                        <Edit3 aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">{t("edit")}</span>
                      </button>
                      {isParked ? (
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => void updateTaskStatus(task.id, "active")}
                          title={t("restore")}
                          type="button"
                        >
                          <RotateCcw aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("restore")}</span>
                        </button>
                      ) : (
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => void updateTaskStatus(task.id, "parked")}
                          title={t("archive")}
                          type="button"
                        >
                          <Archive aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">{t("archive")}</span>
                        </button>
                      )}
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 text-rose-800 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSaving}
                        onClick={() => void deleteTask(task.id)}
                        title={t("delete")}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">{t("delete")}</span>
                      </button>
                    </div>
                  </div>

                  <details className="mt-3 rounded-md border border-stone-200 bg-white">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-stone-800">
                      {t("details")}
                    </summary>
                    <div className="space-y-3 border-t border-stone-200 p-3">
                      <p className="whitespace-pre-line text-sm leading-6 text-stone-600">
                        {task.body}
                      </p>
                      <div className="grid gap-2 text-sm md:grid-cols-3">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                            {t("sourceLesson")}
                          </span>
                          <p className="mt-1 font-medium text-stone-900">
                            {lesson?.title ?? t("notYet")}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                            {t("piece")}
                          </span>
                          <p className="mt-1 font-medium text-stone-900">
                            {piece?.title ?? t("notYet")}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                            {t("exercise")}
                          </span>
                          <p className="mt-1 font-medium text-stone-900">
                            {exercise?.title ?? t("notYet")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Tags
                          aria-hidden="true"
                          className="h-4 w-4 text-stone-500"
                        />
                        {task.tags.map((tagId) => {
                          const tag = tags.find((item) => item.id === tagId);
                          return tag ? (
                            <StatusPill key={tag.id} tone={tag.color}>
                              {tag.name}
                            </StatusPill>
                          ) : null;
                        })}
                        {piece ? (
                          <Link
                            className="ml-auto inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                            href={`/repertoire/${piece.id}`}
                          >
                            {t("repertoire")}
                            <ArrowUpRight
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                          </Link>
                        ) : null}
                      </div>
                      {hasError ? (
                        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                          {t("saveFailed")}
                        </p>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>
    </div>
  );
}
