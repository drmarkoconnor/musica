"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Pause, Play, Plus, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { formatDuration, cn } from "@/lib/utils";
import { parseLessonTime, searchLessonPassages, type SearchablePassage } from "@/lib/lesson-search";

type Passage = SearchablePassage;
type SavedPassages = { jobId: string | null; complete: boolean; passages: Passage[] };
const buttonClass = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-800 disabled:opacity-50";
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20";

export function LessonExplorer({ lessonId, recordingId, audioSrc, durationSeconds, transcriptVersion }: {
  lessonId: string; recordingId: string; audioSrc: string; durationSeconds: number; transcriptVersion?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const stopAt = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState<SavedPassages>({ jobId: null, complete: false, passages: [] });
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [speed, setSpeed] = useState("1");
  const [jumpTime, setJumpTime] = useState("");
  const [error, setError] = useState("");
  const [passagesError, setPassagesError] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Passage | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [activeId, setActiveId] = useState("");
  const matches = searchLessonPassages(saved.passages, query);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPassagesError("");
    void (async () => {
      try {
        const params = new URLSearchParams({ lessonId, recordingId });
        const response = await fetch(`/api/transcriptions/passages?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(t("passagesUnavailable"));
        const body = await response.json() as SavedPassages;
        if (!controller.signal.aborted) setSaved(body);
      } catch { if (!controller.signal.aborted) setPassagesError(t("passagesUnavailable")); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [lessonId, recordingId, transcriptVersion, reload, t]);

  useEffect(() => {
    if (selected && !dialogRef.current?.open) { dialogRef.current?.showModal(); dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(); }
    else if (!selected) dialogRef.current?.close();
  }, [selected]);

  async function playFrom(seconds: number, end: number | null = null) {
    const audio = audioRef.current;
    if (!audio) return;
    setError("");
    const target = Math.max(0, Math.min(seconds, duration || seconds));
    pendingSeek.current = target;
    stopAt.current = end;
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) { audio.currentTime = target; pendingSeek.current = null; }
    else audio.load();
    try { await audio.play(); } catch { setError(t("playbackFailed")); }
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    stopAt.current = null;
    pendingSeek.current = Math.max(0, Math.min(seconds, duration || seconds));
    setTime(pendingSeek.current);
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) { audio.currentTime = pendingSeek.current; pendingSeek.current = null; }
    else audio.load();
  }

  async function saveMemory() {
    if (!selected || !saved.jobId) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/learning-points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: saved.jobId, evidenceId: selected.id, title: draft.title, body: draft.body, tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }) });
      if (!response.ok) throw new Error(t("saveFailed"));
      setSavedId(selected.id); setSelected(null); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : t("saveFailed")); }
    finally { setSaving(false); }
  }

  return <section aria-label={t("exploreRecording")} className="min-w-0 space-y-4 border-y border-stone-200 py-4">
    <audio ref={audioRef} src={audioSrc} preload="none" playsInline onError={() => setError(t("playbackFailed"))} onLoadedMetadata={() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      audio.playbackRate = Number(speed);
      if (pendingSeek.current !== null) { audio.currentTime = pendingSeek.current; pendingSeek.current = null; }
    }} onPlay={() => { document.querySelectorAll("audio").forEach((audio) => { if (audio !== audioRef.current) audio.pause(); }); setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => {
      const audio = audioRef.current;
      if (!audio) return;
      setTime(audio.currentTime);
      if (stopAt.current !== null && audio.currentTime >= stopAt.current) audio.pause();
    }} />
    <div className="space-y-3" tabIndex={0} aria-label={t("playbackControls")} onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (["ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") seek(time - (event.shiftKey ? 1 : 10));
      if (event.key === "ArrowRight") seek(time + (event.shiftKey ? 1 : 10));
      if (event.key === " ") { if (playing) audioRef.current?.pause(); else void playFrom(time); }
    }}>
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} type="button" title={t("backTenSeconds")} aria-label={t("backTenSeconds")} onClick={() => seek(time - 10)}><ArrowLeft aria-hidden="true" className="h-4 w-4" /></button>
        <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-950 bg-emerald-950 text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-800 disabled:opacity-50" type="button" title={playing ? t("pause") : t("play")} aria-label={playing ? t("pause") : t("play")} onClick={() => { if (playing) audioRef.current?.pause(); else void playFrom(time); }}>{playing ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}</button>
        <button className={buttonClass} type="button" title={t("forwardTenSeconds")} aria-label={t("forwardTenSeconds")} onClick={() => seek(time + 10)}><ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
        <output className="min-w-28 text-sm tabular-nums text-stone-600">{formatDuration(time)} / {formatDuration(duration)}</output>
        <select aria-label={t("playbackSpeed")} className="ml-auto h-10 rounded-md border border-stone-300 bg-white px-2 text-sm" value={speed} onChange={(event) => { setSpeed(event.target.value); if (audioRef.current) audioRef.current.playbackRate = Number(event.target.value); }}>{[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}</select>
      </div>
      <input aria-label={t("recordingPosition")} type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(time, Math.max(1, duration))} onChange={(event) => seek(Number(event.target.value))} className="block h-6 w-full accent-emerald-900" />
      <form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const seconds = parseLessonTime(jumpTime); if (seconds !== null && seconds <= duration) { seek(seconds); setError(""); } else setError(t("invalidTimecode")); }}>
        <label className="text-xs font-medium text-stone-500" htmlFor={`jump-${recordingId}`}>{t("jumpToTime")}</label><input id={`jump-${recordingId}`} className="h-9 w-24 rounded-md border border-stone-300 px-2 text-sm tabular-nums" value={jumpTime} onChange={(event) => setJumpTime(event.target.value)} placeholder="12:30" inputMode="text" /><button type="submit" className={cn(buttonClass, "h-9 w-9")} title={t("jumpToTime")} aria-label={t("jumpToTime")}><ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
      </form>
    </div>
    {loading ? <p role="status" className="flex items-center gap-2 text-xs text-stone-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t("loadingPassages")}</p> : null}
    {passagesError ? <div role="alert" className="text-sm text-rose-800">{passagesError}<button type="button" className="ml-2 underline" onClick={() => setReload((version) => version + 1)}>{t("retry")}</button></div> : null}
    {saved.passages.length > 0 ? <>
      <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-300 px-3 focus-within:ring-2 focus-within:ring-emerald-800/20"><Search aria-hidden="true" className="h-4 w-4 text-stone-500" /><span className="sr-only">{t("searchRecording")}</span><input type="search" placeholder={t("searchRecording")} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 py-2 text-sm outline-none" /></label>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-stone-500"><span aria-live="polite">{matches.length} {t("sourcePassages")}</span>{!saved.complete ? <span>{t("partialTranscript")}</span> : null}</div>
      <ol className="max-h-80 overflow-y-auto overscroll-contain divide-y divide-stone-100 border-y border-stone-200">
        {matches.map((passage) => <li key={passage.id} className={cn("flex items-start gap-2 py-3 pr-1", activeId === passage.id && "bg-emerald-50")}>
          <button type="button" className="min-w-0 flex-1 rounded-sm px-2 py-1 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={() => { setActiveId(passage.id); void playFrom(passage.startsAtSeconds, passage.endsAtSeconds); }}><span className="flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums text-emerald-800"><Play className="h-3 w-3" aria-hidden="true" />{formatDuration(passage.startsAtSeconds)} - {formatDuration(passage.endsAtSeconds)}<span className="font-normal text-stone-500">{passage.precision === "approximate" ? t("approximateSource") : t("timedSource")}</span></span><span className="mt-1.5 block break-words whitespace-pre-line text-sm leading-6 text-stone-700">{passage.text}</span></button>
          <button type="button" title={t("keepMemory")} aria-label={`${t("keepMemory")} ${formatDuration(passage.startsAtSeconds)}`} className={buttonClass} onClick={() => { setDraft({ title: "", body: passage.text, tags: "" }); setError(""); setSelected(passage); }}>{savedId === passage.id ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-800" /> : <Plus aria-hidden="true" className="h-4 w-4" />}</button>
        </li>)}
      </ol>
      {matches.length === 0 ? <p className="text-sm text-stone-500">{t("noPassageMatches")}</p> : null}
    </> : null}
    {error && !selected ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
    {savedId ? <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-800"><Check aria-hidden="true" className="h-4 w-4" />{t("memorySaved")}</p> : null}
    <dialog ref={dialogRef} onCancel={() => setSelected(null)} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-stone-200 bg-white p-5 shadow-xl backdrop:bg-stone-950/40">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{t("keepMemory")}</h3><button disabled={saving} type="button" className={buttonClass} onClick={() => setSelected(null)} aria-label={t("close")} title={t("close")}><X aria-hidden="true" className="h-4 w-4" /></button></div>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveMemory(); }}>
        <p className="text-xs tabular-nums text-stone-500">{selected ? `${formatDuration(selected.startsAtSeconds)} - ${formatDuration(selected.endsAtSeconds)}` : ""}</p>
        <label className="block text-sm font-medium">{t("title")}<input required maxLength={240} className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="block text-sm font-medium">{t("pointBody")}<textarea required rows={4} maxLength={12000} className={inputClass} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
        <label className="block text-sm font-medium">{t("memoryTags")}<input className={inputClass} value={draft.tags} placeholder={t("memoryTagsPlaceholder")} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} /></label>
        {error ? <p role="alert" className="text-sm text-rose-800">{error}</p> : null}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-medium" onClick={() => setSelected(null)}>{t("cancel")}</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}{t("keepMemory")}</button></div>
      </form>
    </dialog>
  </section>;
}
