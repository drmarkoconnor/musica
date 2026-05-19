"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Edit3,
  ListPlus,
  RotateCcw,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";
import type { PracticeStatus, PracticeTask } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

type PracticeItemFormValues = {
  title: string;
  body: string;
  linkedPieceId: string;
  importance: string;
};

function emptyPracticeItemForm(): PracticeItemFormValues {
  return {
    title: "",
    body: "",
    linkedPieceId: "",
    importance: "3",
  };
}

function sortPracticeTasks(left: PracticeTask, right: PracticeTask) {
  const leftIsParked = left.status === "parked" || left.status === "mastered";
  const rightIsParked = right.status === "parked" || right.status === "mastered";

  if (leftIsParked !== rightIsParked) {
    return leftIsParked ? 1 : -1;
  }

  const statusRank: Record<PracticeStatus, number> = {
    new: 0,
    active: 1,
    mastered: 2,
    parked: 3,
  };

  if (statusRank[left.status] !== statusRank[right.status]) {
    return statusRank[left.status] - statusRank[right.status];
  }

  return right.createdAt.localeCompare(left.createdAt);
}

export function FromLessonsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { exercises, lessonRecordings, lessons, pieces, practiceTasks, tags } =
    data;
  const practiceListTasks = [...practiceTasks].sort(sortPracticeTasks);
  const activeCount = practiceListTasks.filter(
    (task) => task.status !== "parked" && task.status !== "mastered",
  ).length;
  const parkedCount = practiceListTasks.length - activeCount;
  const [actionState, setActionState] = useState<
    Record<string, "idle" | "saving" | "error">
  >({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formValues, setFormValues] = useState<PracticeItemFormValues>(
    emptyPracticeItemForm,
  );
  const [createState, setCreateState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

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

  function openCreateModal() {
    setFormValues(emptyPracticeItemForm());
    setCreateState("idle");
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
    setFormValues(emptyPracticeItemForm());
    setCreateState("idle");
  }

  async function createManualTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateState("saving");

    const response = await fetch("/api/practice-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        title: formValues.title,
        body: formValues.body,
        linkedPieceId: formValues.linkedPieceId || undefined,
        importance: Number(formValues.importance),
      }),
    });

    if (!response.ok) {
      setCreateState("error");
      return;
    }

    setCreateState("saved");
    router.refresh();
    setTimeout(() => closeCreateModal(), 250);
  }

  return (
    <div className="space-y-8">
      <Section
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              onClick={openCreateModal}
              type="button"
            >
              <ListPlus aria-hidden="true" className="h-4 w-4" />
              {t("addItem")}
            </button>
            <StatusPill tone="green">
              {activeCount} {t("active")}
            </StatusPill>
            <StatusPill tone="slate">
              {parkedCount} {t("parked")}
            </StatusPill>
          </div>
        }
        eyebrow={t("practiceElement")}
        title={t("fromLessons")}
      >
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          {practiceListTasks.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-stone-600">
              {t("notYet")}
            </div>
          ) : null}
          <ul className="divide-y divide-stone-200">
            {practiceListTasks.map((task) => {
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
              const sourceLabel =
                task.source === "lesson"
                  ? t("sourceLesson")
                  : t("manualPracticeItem");
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
                  className={`p-2.5 ${isParked ? "bg-stone-50 text-stone-500" : ""}`}
                  key={task.id}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_9rem_8rem_8rem_auto] lg:items-center">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-stone-950">
                        {task.title}
                      </h2>
                      <p className="mt-0.5 line-clamp-1 max-w-3xl text-sm leading-5 text-stone-600">
                        {task.body}
                      </p>
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-stone-900">
                        {lesson?.title ?? sourceLabel}
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
                    <p className="text-sm font-medium text-stone-600">
                      {sourceLabel}
                    </p>
                    <div className="flex flex-wrap justify-start gap-1 lg:justify-end">
                      {audioSrc ? (
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
                      ) : null}
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

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-950">
                  {t("addItem")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("manualPracticeItem")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={closeCreateModal}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-4" onSubmit={createManualTask}>
              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("title")}
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  value={formValues.title}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("piece")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        linkedPieceId: event.target.value,
                      }))
                    }
                    value={formValues.linkedPieceId}
                  >
                    <option value="">{t("notYet")}</option>
                    {pieces.map((piece) => (
                      <option key={piece.id} value={piece.id}>
                        {piece.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-stone-800">
                    {t("importance")}
                  </span>
                  <select
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        importance: event.target.value,
                      }))
                    }
                    value={formValues.importance}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("notes")}
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  value={formValues.body}
                />
              </label>

              {createState === "error" ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {t("saveFailed")}
                </p>
              ) : null}

              {createState === "saved" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {t("saved")}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={closeCreateModal}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={createState === "saving"}
                  type="submit"
                >
                  {createState === "saving" ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
