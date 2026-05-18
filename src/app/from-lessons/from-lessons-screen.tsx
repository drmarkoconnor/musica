"use client";

import Link from "next/link";
import { ArrowUpRight, CircleDot, Tags } from "lucide-react";
import { AudioStrip } from "@/components/audio-strip";
import { Section } from "@/components/section";
import { StatusPill } from "@/components/status-pill";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

export function FromLessonsScreen({ data }: { data: PracticeLoopReadModel }) {
  const { t } = useLanguage();
  const { exercises, lessonRecordings, lessons, pieces, practiceTasks, tags } =
    data;
  const lessonTasks = practiceTasks.filter((task) => task.source === "lesson");

  return (
    <div className="space-y-8">
      <Section
        eyebrow={t("sourceLesson")}
        title={t("fromLessons")}
      >
        <div className="space-y-4">
          {lessonTasks.map((task) => {
            const piece = task.linkedPieceId
              ? pieces.find((item) => item.id === task.linkedPieceId)
              : null;
            const exercise = task.linkedExerciseId
              ? exercises.find((item) => item.id === task.linkedExerciseId)
              : null;
            const lesson = lessons.find((item) => item.id === task.sourceLessonId);
            const recording = task.linkedRecordingId
              ? lessonRecordings.find((item) => item.id === task.linkedRecordingId)
              : null;
            const audioSrc =
              recording?.storageBucket === "local-test-audio"
                ? `/api/lesson-recordings/${recording.id}/file`
                : undefined;

            return (
              <article
                className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
                key={task.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <CircleDot
                        aria-hidden="true"
                        className="h-4 w-4 text-emerald-800"
                      />
                      <h2 className="text-lg font-semibold text-stone-950">
                        {task.title}
                      </h2>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-stone-600">
                      {task.body}
                    </p>
                  </div>
                  <StatusPill tone={task.status === "new" ? "amber" : "green"}>
                    {task.status}
                  </StatusPill>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {t("sourceLesson")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {lesson?.title ?? t("notYet")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {t("piece")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {piece?.title ?? t("notYet")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {t("exercise")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {exercise?.title ?? t("notYet")}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <AudioStrip
                    audioSrc={audioSrc}
                    endsAtSeconds={task.endsAtSeconds}
                    startsAtSeconds={task.startsAtSeconds}
                    title={task.title}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Tags aria-hidden="true" className="h-4 w-4 text-stone-500" />
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
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
