"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, WandSparkles, X } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { cn, formatDuration } from "@/lib/utils";

type TranscriptionJobProgress = {
  id: string;
  completedChunks: number;
  currentLabel: string | null;
  errorMessage: string | null;
  mode: "selected_segments" | "full_recording";
  status: "queued" | "running" | "complete" | "failed";
  totalChunks: number;
  analysisStatus?: "pending" | "running" | "complete" | "failed";
  stage?: "transcribing" | "extracting" | "complete";
  canRetryAnalysis?: boolean;
};

type TranscriptionStatusResponse = {
  job?: TranscriptionJobProgress | null;
  transcript?: { errorMessage: string | null; status: "pending" | "complete" | "failed" } | null;
};

export function TranscriptionGate({
  lessonId, recordingDurationSeconds, recordingId, selectedSegments,
  selectedSegmentCount, selectedSegmentSeconds, transcriptErrorMessage, transcriptStatus,
}: {
  lessonId: string;
  recordingDurationSeconds: number;
  recordingId: string;
  selectedSegments: Array<{ id: string; endsAtSeconds: number; startsAtSeconds: number; title: string }>;
  selectedSegmentCount: number;
  selectedSegmentSeconds: number;
  transcriptErrorMessage?: string;
  transcriptStatus?: "pending" | "complete" | "failed";
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [includeFullRecording, setIncludeFullRecording] = useState(true);
  const [retryAnalysis, setRetryAnalysis] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [job, setJob] = useState<TranscriptionJobProgress | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const isWorking = submitting || job?.status === "queued" || job?.status === "running";
  const isComplete = job?.status === "complete";
  const canRetryAnalysis = Boolean(job?.canRetryAnalysis);
  const hasTranscript = transcriptStatus === "complete" || job?.stage === "extracting" || isComplete || canRetryAnalysis;
  const progressPercent = Math.min(100, Math.round(((job?.completedChunks ?? 0) / Math.max(job?.totalChunks ?? 1, 1)) * 100));

  // Status belongs to the recording, not the authorisation dialog. Returning to a
  // lesson restores the server's latest job and polling continues with it closed.
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    let lastStatus: string | undefined;
    setStatusLoaded(false);
    if (refreshVersion === 0) setJob(null);
    async function pollStatus() {
      try {
        const params = new URLSearchParams({ lessonId, recordingId });
        const response = await fetch(`/api/transcriptions/status?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Status unavailable");
        const body = await response.json() as TranscriptionStatusResponse;
        if (cancelled) return;
        setStatusUnavailable(false);
        setStatusLoaded(true);
        setJob(body.job ?? null);
        if (body.job && ["complete", "failed"].includes(body.job.status) && lastStatus !== body.job.status) {
          router.refresh();
        }
        lastStatus = body.job?.status;
        if (body.job?.status === "queued" || body.job?.status === "running") {
          timeoutId = window.setTimeout(() => void pollStatus(), 3000);
        }
      } catch {
        if (cancelled) return;
        setStatusUnavailable(true);
        timeoutId = window.setTimeout(() => void pollStatus(), 6000);
      }
    }
    void pollStatus();
    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [lessonId, recordingId, refreshVersion, router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
    } else if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);

  function openGate(extractionOnly = false) {
    setRetryAnalysis(extractionOnly);
    setIncludeFullRecording(true);
    setPassword("");
    setRequestError("");
    setIsOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setRequestError("");
    try {
      const response = await fetch("/api/transcriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeFullRecording, lessonId, recordingId, password,
          ...(retryAnalysis && job ? { jobId: job.id, retryAnalysis: true } : {}),
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string; jobId?: string; mode?: TranscriptionJobProgress["mode"]; totalChunks?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? t("analysisRequestFailed"));
      setPassword("");
      setJob({ id: body?.jobId ?? job?.id ?? "", completedChunks: retryAnalysis ? (job?.completedChunks ?? 0) : 0,
        totalChunks: body?.totalChunks ?? job?.totalChunks ?? 1, currentLabel: null, errorMessage: null,
        mode: body?.mode ?? (includeFullRecording ? "full_recording" : "selected_segments"),
        status: "queued", stage: retryAnalysis ? "extracting" : "transcribing", analysisStatus: "pending" });
      setIsOpen(false);
      setRefreshVersion((version) => version + 1);
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t("analysisRequestFailed"));
    } finally { setSubmitting(false); }
  }

  const statusLabel = isComplete ? t("analysisReady") : job?.status === "failed" ? t("analysisFailed") : job?.stage === "extracting" ? t("analysisExtracting") : job?.status === "running" ? t("analysisTranscribing") : job?.status === "queued" ? t("analysisQueued") : t("analyseLesson");
  const stages = [
    { label: t("audioSavedStage"), done: true, running: false },
    { label: t("transcriptStage"), done: hasTranscript, running: isWorking && !hasTranscript },
    { label: t("learningPointsStage"), done: Boolean(isComplete), running: isWorking && hasTranscript },
  ];

  return (
    <>
      <section aria-label={t("analyseLesson")} className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-stone-600">
          {stages.map((stage) => <li key={stage.label} className="flex items-center gap-1.5">{stage.done ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-800" /> : stage.running ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-emerald-800" /> : <Circle aria-hidden="true" className="h-4 w-4 text-stone-400" />}{stage.label}</li>)}
        </ol>
        <div aria-live="polite">
          <h3 className="text-base font-semibold text-emerald-950">{statusLabel}</h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">{canRetryAnalysis ? t("analysisRetryHelp") : isWorking ? t("analysisBackground") : isComplete ? t("learningPointsIntro") : t("analysisIntro")}</p>
        </div>
        {job && isWorking ? <div>
          <div className="mb-2 flex justify-between gap-3 text-xs text-stone-600"><span>{job.stage === "extracting" ? t("analysisExtracting") : t("analysisTranscribing")}</span><span>{job.completedChunks} / {job.totalChunks}</span></div>
          <progress className="h-2 w-full accent-emerald-800" max={100} value={progressPercent} aria-label={t("transcriptionProgress")} />
        </div> : null}
        {job?.status === "failed" || (!job && transcriptStatus === "failed") ? <p role="alert" className="rounded-md border border-rose-200 bg-white p-3 text-sm leading-6 text-rose-800">{job?.errorMessage || transcriptErrorMessage || t("analysisFailed")}</p> : null}
        {statusUnavailable ? <p role="status" className="text-sm text-stone-600">{t("analysisStatusUnavailable")}</p> : null}
        {!isWorking && statusLoaded ? <div className="flex flex-wrap gap-2">
          {isComplete ? <Link href={`/learning-points?lesson=${encodeURIComponent(lessonId)}`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900">{t("reviewLearningPoints")}</Link> : null}
          <button type="button" onClick={() => openGate(canRetryAnalysis)} className={cn("inline-flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold", isComplete ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100" : "bg-emerald-950 text-white hover:bg-emerald-900")}><WandSparkles aria-hidden="true" className="h-4 w-4" />{canRetryAnalysis ? t("analysisRetry") : isComplete ? t("analyseAgain") : t("analyseLesson")}</button>
        </div> : null}
      </section>
      <dialog ref={dialogRef} onCancel={() => setIsOpen(false)} onClose={() => setIsOpen(false)} aria-labelledby={`analysis-title-${recordingId}`} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border-0 bg-white p-5 text-stone-900 shadow-xl backdrop:bg-stone-950/50">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id={`analysis-title-${recordingId}`} className="text-xl font-semibold">{retryAnalysis ? t("analysisRetry") : t("analyseLesson")}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{t("analysisAuthorisation")}</p></div><button type="button" aria-label={t("close")} onClick={() => setIsOpen(false)} className="rounded-md p-2 hover:bg-stone-100"><X aria-hidden="true" className="h-5 w-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {retryAnalysis ? <p className="rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">{t("analysisRetryHelp")}</p> : <fieldset disabled={submitting} className="space-y-2"><legend className="mb-2 text-sm font-semibold">{t("analysisScope")}</legend><label className="flex items-center gap-3 rounded-md border border-stone-200 p-3 text-sm"><input type="radio" name="scope" checked={includeFullRecording} onChange={() => setIncludeFullRecording(true)} className="accent-emerald-900" /><span>{t("wholeLesson")} <span className="text-stone-500">{recordingDurationSeconds > 0 ? `· ${formatDuration(recordingDurationSeconds)}` : ''}</span></span></label>{selectedSegmentCount > 0 ? <label className="flex items-center gap-3 rounded-md border border-stone-200 p-3 text-sm"><input type="radio" name="scope" checked={!includeFullRecording} onChange={() => setIncludeFullRecording(false)} className="accent-emerald-900" /><span>{t("selectedClipsOnly")} <span className="text-stone-500">· {selectedSegmentCount} · {formatDuration(selectedSegmentSeconds)}</span></span></label> : null}
            {!includeFullRecording ? <ul className="space-y-1 px-3 text-xs text-stone-500">{selectedSegments.map((segment) => <li key={segment.id}>{segment.title} · {formatDuration(segment.startsAtSeconds)}–{formatDuration(segment.endsAtSeconds)}</li>)}</ul> : null}
            {recordingDurationSeconds <= 0 ? <p className="text-xs text-stone-500">{t("recordingDurationUnknown")}</p> : null}
          </fieldset>}
          <label className="block"><span className="text-sm font-medium">{t("password")}</span><input required autoComplete="current-password" disabled={submitting} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20" /></label>
          <p className="text-sm leading-6 text-stone-600">{t("analysisBackground")}</p>
          {requestError ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{requestError}</p> : null}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsOpen(false)} className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold">{t("cancel")}</button><button type="submit" disabled={submitting || !password} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}{t("authorise")}</button></div>
        </form>
      </dialog>
    </>
  );
}
