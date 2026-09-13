"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { LearningPointCard, learningPointTopic, LEARNING_POINT_TOPIC_LABELS } from "@/components/learning-point-card";
import type { PracticeLoopReadModel } from "@/lib/data";
import { useLanguage } from "@/lib/language";

export function LearningPointsScreen({ data, initialLessonId = "" }: { data: PracticeLoopReadModel; initialLessonId?: string }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [lessonId, setLessonId] = useState(initialLessonId);
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const lessons = new Map(data.lessons.map((lesson) => [lesson.id, lesson]));
  const recordings = new Map(data.lessonRecordings.map((recording) => [recording.id, recording]));
  const points = useMemo(() => data.learningPoints.filter((point) => {
    if (lessonId && point.lessonId !== lessonId) return false;
    if (status ? point.status !== status : point.status === "discarded") return false;
    if (topic && learningPointTopic(point) !== topic) return false;
    const lesson = data.lessons.find((item) => item.id === point.lessonId);
    return !search.trim() || [point.title, point.body, point.practiceAction, lesson?.title, lesson?.lessonDate].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a, b) => {
    const dateA = data.lessons.find((lesson) => lesson.id === a.lessonId)?.lessonDate ?? "";
    const dateB = data.lessons.find((lesson) => lesson.id === b.lessonId)?.lessonDate ?? "";
    return dateB.localeCompare(dateA) || a.startsAtSeconds - b.startsAtSeconds;
  }), [data.learningPoints, data.lessons, lessonId, topic, status, search]);
  const selectClass = "min-h-11 min-w-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20";

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="text-2xl font-semibold text-stone-950">{t("learningPoints")}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{t("learningPointsIntro")}</p></header>
    <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-3 focus-within:border-emerald-800 focus-within:ring-2 focus-within:ring-emerald-800/20"><Search aria-hidden="true" className="h-4 w-4 text-stone-500" /><span className="sr-only">{t("searchLearningPoints")}</span><input className="min-w-0 flex-1 py-2 text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchLearningPoints")} type="search" /></label>
      <div className="grid gap-2 sm:grid-cols-3"><select aria-label={t("sourceLesson")} className={selectClass} value={lessonId} onChange={(event) => setLessonId(event.target.value)}><option value="">{t("allLessons")}</option>{[...data.lessons].sort((a,b) => b.lessonDate.localeCompare(a.lessonDate)).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title} · {lesson.lessonDate}</option>)}</select><select aria-label={t("allTopics")} className={selectClass} value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">{t("allTopics")}</option>{Object.entries(LEARNING_POINT_TOPIC_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select><select aria-label={t("status")} className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("allLearningPoints")}</option><option value="candidate">{t("pointsToReview")}</option><option value="kept">{t("keptPoints")}</option><option value="discarded">{t("dismissedPoints")}</option></select></div>
    </div>
    {data.learningPoints.length === 0 ? <div className="rounded-lg border border-dashed border-stone-300 bg-white px-5 py-10 text-center"><h2 className="text-lg font-semibold text-stone-900">{t("noLearningPoints")}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">{t("noLearningPointsHelp")}</p><Link href="/lessons" className="mt-5 inline-flex min-h-11 items-center rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white">{t("lessons")}</Link></div> : <><p aria-live="polite" className="text-xs font-medium text-stone-500">{points.length} {t("learningPoints").toLowerCase()}</p><div className="space-y-4">{points.length === 0 ? <p className="rounded-lg border border-stone-200 bg-white p-5 text-sm text-stone-600">{t("noLearningPointMatches")}</p> : points.map((point) => {
      const lesson = lessons.get(point.lessonId); const recording = recordings.get(point.recordingId);
      const audioSrc = recording && ["local-test-audio", "local-lesson-audio", "netlify-blobs"].includes(recording.storageBucket) ? `/api/lesson-recordings/${recording.id}/file` : undefined;
      return <LearningPointCard key={point.id} point={point} lessonTitle={lesson?.title ?? t("sourceLesson")} lessonDate={lesson?.lessonDate ?? ""} audioSrc={audioSrc} />;
    })}</div></>}
  </div>;
}
