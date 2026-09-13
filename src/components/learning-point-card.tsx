"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pause, Play, Plus } from "lucide-react";
import type { LearningPoint } from "@/lib/types";
import { useLanguage } from "@/lib/language";
import { formatDuration } from "@/lib/utils";

export type LearningPointTopic = "general" | "harmony" | "rhythm" | "technique" | "vocal" | "repertoire";
export const LEARNING_POINT_TOPIC_LABELS = {
  general: "topicGeneralAdvice", harmony: "topicHarmony", rhythm: "topicRhythm",
  technique: "topicTechnique", vocal: "topicVocal", repertoire: "topicRepertoire",
} as const;

// This is a browsing aid, not an assertion made by the teacher or the analysis.
export function learningPointTopic(point: Pick<LearningPoint, "title" | "body" | "kind">): LearningPointTopic {
  const text = `${point.title} ${point.body}`.toLowerCase();
  if (/\b(sing|singer|voice|vocal|breath|lyric)\b/.test(text)) return "vocal";
  if (/\b(chord|voicing|harmony|scale|minor|major|diminished|dominant|rootless)\b/.test(text)) return "harmony";
  if (/\b(rhythm|time|swing|comp|groove|pulse|beat)\b/.test(text)) return "rhythm";
  if (/\b(finger|fingering|hand|touch|relax|technique|tempo)\b/.test(text)) return "technique";
  if (point.kind === "repertoire" || /\b(tune|song|standard|bridge|chorus|melody|passage)\b/.test(text)) return "repertoire";
  return "general";
}

const secondaryButton = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60";
const inputClass = "mt-1 min-h-11 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20";

export function LearningPointCard({ point, lessonTitle, lessonDate, audioSrc, showLesson = true }: {
  point: LearningPoint; lessonTitle: string; lessonDate: string; audioSrc?: string; showLesson?: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const playerRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ title: point.title, body: point.body, practiceAction: point.practiceAction ?? "" });

  async function changePoint(changes: Partial<Pick<LearningPoint, "title" | "body" | "practiceAction" | "status">>) {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/learning-points/${point.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? t("saveFailed"));
      setEditing(false);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : t("saveFailed")); }
    finally { setPending(false); }
  }

  async function addToPractice() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/learning-points/${point.id}/practice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ practiceAction: point.practiceAction || point.body }) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? t("saveFailed"));
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : t("saveFailed")); }
    finally { setPending(false); }
  }

  async function playSource() {
    const audio = playerRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); return; }
    setError("");
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) audio.currentTime = point.startsAtSeconds;
    try { await audio.play(); } catch { setError(t("playbackFailed")); }
  }

  return <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
    {showLesson ? <Link className="text-xs font-medium text-stone-500 hover:text-emerald-900 hover:underline" href={`/lessons?lesson=${encodeURIComponent(point.lessonId)}`}>{lessonTitle} · {lessonDate}</Link> : null}
    {editing ? <form className="mt-2 space-y-3" onSubmit={(event) => { event.preventDefault(); void changePoint(draft); }}>
      <label className="block text-sm font-medium">{t("title")}<input required className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block text-sm font-medium">{t("pointBody")}<textarea required rows={4} className={inputClass} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
      <label className="block text-sm font-medium">{t("optionalPracticeAction")}<textarea rows={2} className={inputClass} value={draft.practiceAction} onChange={(event) => setDraft({ ...draft, practiceAction: event.target.value })} /></label>
      <div className="flex gap-2"><button disabled={pending} type="submit" className="min-h-10 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? t("saving") : t("save")}</button><button type="button" disabled={pending} className={secondaryButton} onClick={() => setEditing(false)}>{t("cancel")}</button></div>
    </form> : <>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2"><h3 className="text-lg font-semibold leading-snug text-stone-950">{point.title}</h3>{point.status === "kept" ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800"><Check aria-hidden="true" className="h-3.5 w-3.5" />{t("keptPoints")}</span> : null}</div>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-stone-700">{point.body}</p>
      {point.practiceAction ? <p className="mt-3 border-l-2 border-emerald-700 pl-3 text-sm leading-6 text-stone-700"><span className="font-semibold">{t("suggestedPractice")}: </span>{point.practiceAction}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
        {audioSrc ? <><audio ref={playerRef} preload="none" src={audioSrc} onLoadedMetadata={() => { if (playerRef.current) playerRef.current.currentTime = point.startsAtSeconds; }} onPlay={() => {
          document.querySelectorAll("audio").forEach((audio) => { if (audio !== playerRef.current) audio.pause(); });
          setIsPlaying(true);
        }} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onError={() => setError(t("sourceUnavailable"))} onTimeUpdate={() => { const audio = playerRef.current; if (audio && audio.currentTime >= point.endsAtSeconds) audio.pause(); }} /><button type="button" className={secondaryButton} onClick={() => void playSource()}>{isPlaying ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}{isPlaying ? t("pause") : t("listenToSource")}</button></> : <span className="text-xs text-stone-500">{t("sourceUnavailable")}</span>}
        <span className="text-xs leading-5 text-stone-500"><span className="block tabular-nums">{formatDuration(point.startsAtSeconds)}–{formatDuration(point.endsAtSeconds)}</span>{point.evidencePrecision === "approximate" ? t("approximateSource") : t("sourcePassage")}</span>
      </div>
      {point.evidenceText ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-stone-500">{t("sourceText")}</summary><p className="mt-2 whitespace-pre-line rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-600">{point.evidenceText}</p></details> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {point.status !== "kept" && point.status !== "discarded" ? <button type="button" disabled={pending} onClick={() => void changePoint({ status: "kept" })} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-emerald-950 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"><Check aria-hidden="true" className="h-4 w-4" />{t("keep")}</button> : null}
        <button type="button" disabled={pending} onClick={() => { setDraft({ title: point.title, body: point.body, practiceAction: point.practiceAction ?? "" }); setEditing(true); }} className={secondaryButton}>{t("edit")}</button>
        {point.status === "discarded" ? <button type="button" disabled={pending} className={secondaryButton} onClick={() => void changePoint({ status: "candidate" })}>{t("restorePoint")}</button> : <button type="button" disabled={pending} className={secondaryButton} onClick={() => void changePoint({ status: "discarded" })}>{t("dismissPoint")}</button>}
        {point.practiceTaskId ? <Link href="/from-lessons" className="inline-flex min-h-10 items-center px-2 text-xs font-medium text-emerald-800 hover:underline">{t("addedToPractice")}</Link> : point.status !== "discarded" ? <button type="button" disabled={pending} className={secondaryButton} onClick={() => void addToPractice()}><Plus aria-hidden="true" className="h-3.5 w-3.5" />{t("addToPractice")}</button> : null}
      </div>
    </>}
    {error ? <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
  </article>;
}
