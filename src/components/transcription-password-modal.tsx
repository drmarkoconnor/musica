"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  WandSparkles,
  X,
} from "lucide-react";
import { useLanguage } from "@/lib/language";
import { cn, formatDuration } from "@/lib/utils";

type RequestState = "idle" | "loading" | "queued" | "running" | "success" | "error";

type TranscriptionJobStatus = "queued" | "running" | "complete" | "failed";

type TranscriptionJobProgress = {
  id: string;
  completedChunks: number;
  currentLabel: string | null;
  errorMessage: string | null;
  mode: "selected_segments" | "full_recording";
  status: TranscriptionJobStatus;
  totalChunks: number;
};

type TranscriptionSegmentSummary = {
  endsAtSeconds: number;
  id: string;
  startsAtSeconds: number;
  title: string;
};

type SubmittedTranscriptionSummary = {
  mode: "selected_segments" | "full_recording";
  recordingSeconds: number;
  segmentCount: number;
  segmentSeconds: number;
  segments: TranscriptionSegmentSummary[];
};

type TranscriptionStatusResponse = {
  job?: TranscriptionJobProgress | null;
  progressPercent?: number;
  transcript?: {
    errorMessage: string | null;
    status: "pending" | "complete" | "failed";
  } | null;
};

const MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS = 60 * 60;

export function TranscriptionGate({
  lessonId,
  recordingDurationSeconds,
  recordingId,
  selectedSegments,
  selectedSegmentCount,
  selectedSegmentSeconds,
  transcriptErrorMessage,
  transcriptStatus,
}: {
  lessonId: string;
  recordingDurationSeconds: number;
  recordingId: string;
  selectedSegments: TranscriptionSegmentSummary[];
  selectedSegmentCount: number;
  selectedSegmentSeconds: number;
  transcriptErrorMessage?: string;
  transcriptStatus?: "pending" | "complete" | "failed";
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [includeFullRecording, setIncludeFullRecording] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<TranscriptionJobProgress | null>(null);
  const [submittedSummary, setSubmittedSummary] =
    useState<SubmittedTranscriptionSummary | null>(null);
  const hasSelectedSegments = selectedSegmentCount > 0;
  const isFullRecordingTooLong =
    !hasSelectedSegments &&
    recordingDurationSeconds > MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS;
  const selectedMinutes = Math.ceil(selectedSegmentSeconds / 60);
  const fullRecordingMinutes = Math.ceil((recordingDurationSeconds || 0) / 60);
  const isWorking =
    requestState === "loading" ||
    requestState === "queued" ||
    requestState === "running";
  const progressPercent = job
    ? Math.round((job.completedChunks / Math.max(job.totalChunks, 1)) * 100)
    : 0;

  useEffect(() => {
    if (!isOpen || !job?.id || job.status === "complete" || job.status === "failed") {
      return;
    }

    let cancelled = false;

    async function pollStatus() {
      if (!job?.id) return;

      const params = new URLSearchParams({
        jobId: job.id,
        lessonId,
        recordingId,
      });
      const response = await fetch(`/api/transcriptions/status?${params}`);

      if (!response.ok || cancelled) return;

      const body = (await response.json()) as TranscriptionStatusResponse;

      if (!body.job || cancelled) return;

      setJob(body.job);

      if (body.job.status === "queued") {
        setRequestState("queued");
        setMessage(t("transcriptionQueued"));
      } else if (body.job.status === "running") {
        setRequestState("running");
        setMessage(t("transcriptionRunning"));
      } else if (body.job.status === "complete") {
        setRequestState("success");
        setMessage(t("transcriptionComplete"));
        router.refresh();
      } else if (body.job.status === "failed") {
        setRequestState("error");
        setMessage(
          body.job.errorMessage ??
            body.transcript?.errorMessage ??
            t("transcriptionFailed"),
        );
        router.refresh();
      }
    }

    void pollStatus();
    const interval = window.setInterval(() => void pollStatus(), 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, job?.id, job?.status, lessonId, recordingId, router, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("loading");
    setMessage("");
    setJob(null);
    setSubmittedSummary({
      mode: hasSelectedSegments ? "selected_segments" : "full_recording",
      recordingSeconds: recordingDurationSeconds,
      segmentCount: selectedSegmentCount,
      segmentSeconds: selectedSegmentSeconds,
      segments: selectedSegments,
    });

    const response = await fetch("/api/transcriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeFullRecording,
        lessonId,
        recordingId,
        password,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      jobId?: string;
      mode?: "selected_segments" | "full_recording";
      totalChunks?: number;
    } | null;

    if (!response.ok) {
      setRequestState("error");
      setMessage(body?.error ?? t("passwordFailed"));
      return;
    }

    setPassword("");
    setRequestState("queued");
    setMessage(t("transcriptionQueued"));
    setJob({
      id: body?.jobId ?? "",
      completedChunks: 0,
      currentLabel: "Waiting to start",
      errorMessage: null,
      mode: body?.mode ?? (hasSelectedSegments ? "selected_segments" : "full_recording"),
      status: "queued",
      totalChunks: body?.totalChunks ?? 1,
    });
    router.refresh();
  }

  function openGate() {
    setIsOpen(true);
    setIncludeFullRecording(false);
    setRequestState("idle");
    setMessage("");
    setJob(null);
    setSubmittedSummary(null);
  }

  const visibleTranscriptFailure =
    transcriptStatus === "failed" && transcriptErrorMessage;
  const hasCompletedTranscript = transcriptStatus === "complete";
  const completedSummary =
    submittedSummary ??
    ({
      mode: job?.mode ?? (hasSelectedSegments ? "selected_segments" : "full_recording"),
      recordingSeconds: recordingDurationSeconds,
      segmentCount: selectedSegmentCount,
      segmentSeconds: selectedSegmentSeconds,
      segments: selectedSegments,
    } satisfies SubmittedTranscriptionSummary);
  const completedMinutes =
    completedSummary.mode === "selected_segments"
      ? Math.max(1, Math.ceil(completedSummary.segmentSeconds / 60))
      : Math.max(1, Math.ceil(completedSummary.recordingSeconds / 60));

  return (
    <>
      <div
        className={cn(
          "space-y-3 rounded-lg border p-4",
          hasCompletedTranscript
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50",
        )}
      >
        <div className="flex items-start gap-3">
          {hasCompletedTranscript ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-800" />
          ) : (
            <LockKeyhole className="mt-0.5 h-5 w-5 text-amber-800" />
          )}
          <div className="space-y-2">
            <p
              className={cn(
                "text-sm font-semibold",
                hasCompletedTranscript ? "text-emerald-950" : "text-amber-950",
              )}
            >
              {hasCompletedTranscript
                ? t("transcriptionComplete")
                : t("transcriptionNote")}
            </p>
            <p
              className={cn(
                "max-w-3xl text-sm leading-6",
                hasCompletedTranscript ? "text-emerald-900" : "text-amber-900",
              )}
            >
              {hasCompletedTranscript
                ? t("transcriptionCompleteNextStep")
                : t("transcriptionClipFirstBody")}
            </p>
            {visibleTranscriptFailure ? (
              <p className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">
                {transcriptErrorMessage}
              </p>
            ) : null}
            {!hasCompletedTranscript || hasSelectedSegments ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                onClick={openGate}
                type="button"
              >
                <WandSparkles aria-hidden="true" className="h-4 w-4" />
                {hasCompletedTranscript
                  ? t("transcribeMoreClips")
                  : t("transcribeLesson")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  {t("transcribeLesson")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {t("transcriptionNote")}
                </p>
              </div>
              <button
                aria-label={t("cancel")}
                className="rounded-md p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            {requestState === "success" ? (
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-950">
                  <div className="flex gap-2">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 flex-none text-emerald-800"
                    />
                    <div>
                      <p className="font-semibold">
                        {t("transcriptionSuccessTitle")}
                      </p>
                      <p>
                        {completedSummary.mode === "selected_segments"
                          ? t("transcriptionSuccessSelectedBody")
                          : t("transcriptionSuccessFullBody")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                    {t("transcriptionDetails")}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md bg-white px-3 py-2 ring-1 ring-stone-200">
                      <span className="block text-xs font-semibold text-stone-500">
                        {t("transcriptionMode")}
                      </span>
                      <strong className="mt-1 block text-stone-950">
                        {completedSummary.mode === "selected_segments"
                          ? t("transcriptionModeClips")
                          : t("transcriptionModeFull")}
                      </strong>
                    </div>
                    <div className="rounded-md bg-white px-3 py-2 ring-1 ring-stone-200">
                      <span className="block text-xs font-semibold text-stone-500">
                        {t("clips")}
                      </span>
                      <strong className="mt-1 block tabular-nums text-stone-950">
                        {completedSummary.mode === "selected_segments"
                          ? completedSummary.segmentCount
                          : 1}
                      </strong>
                    </div>
                    <div className="rounded-md bg-white px-3 py-2 ring-1 ring-stone-200">
                      <span className="block text-xs font-semibold text-stone-500">
                        {t("minutes")}
                      </span>
                      <strong className="mt-1 block tabular-nums text-stone-950">
                        {completedMinutes}
                      </strong>
                    </div>
                  </div>

                  {completedSummary.segments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {completedSummary.segments.map((segment) => (
                        <div
                          className="rounded-md bg-white px-3 py-2 ring-1 ring-stone-200"
                          key={segment.id}
                        >
                          <p className="font-semibold text-stone-950">
                            {segment.title}
                          </p>
                          <p className="mt-1 text-xs font-semibold tabular-nums text-stone-500">
                            {formatDuration(segment.startsAtSeconds)} -{" "}
                            {formatDuration(segment.endsAtSeconds)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {job ? (
                  <div className="rounded-md border border-stone-200 bg-white px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-stone-950">
                        {t("transcriptionComplete")}
                      </span>
                      <span className="tabular-nums text-stone-600">
                        {job.completedChunks} / {job.totalChunks}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-emerald-700 transition-all"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    {t("chooseMoreClips")}
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    {t("reviewClipMemories")}
                  </button>
                </div>
              </div>
            ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                <div className="flex gap-2">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 flex-none text-amber-800"
                  />
                  <div>
                    <p className="font-semibold">
                      {t("transcriptionClipFirstTitle")}
                    </p>
                    <p>{t("transcriptionClipFirstBody")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-700">
                {hasSelectedSegments ? (
                  <p>
                    {t("selectedSegmentsWillTranscribe")}{" "}
                    <strong>
                      {selectedSegmentCount} / {selectedMinutes} {t("minutes")}
                    </strong>
                  </p>
                ) : isFullRecordingTooLong ? (
                  <p>
                    {t("fullRecordingTooLong")}{" "}
                    <strong>
                      {fullRecordingMinutes} {t("minutes")}
                    </strong>
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      {t("noSegmentsWillTranscribeFull")}{" "}
                      <strong>
                        {fullRecordingMinutes} {t("minutes")}
                      </strong>
                    </p>
                    <p className="text-amber-800">{t("wholeLessonRareWarning")}</p>
                    <label className="flex items-start gap-2">
                      <input
                        checked={includeFullRecording}
                        className="mt-1 h-4 w-4 accent-emerald-900"
                        onChange={(event) =>
                          setIncludeFullRecording(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{t("confirmFullTranscription")}</span>
                    </label>
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-stone-800">
                  {t("password")}
                </span>
                <input
                  autoComplete="current-password"
                  className="mt-2 min-h-11 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/20"
                  disabled={isWorking}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>

              {job ? (
                <div className="rounded-md border border-stone-200 bg-white px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-stone-950">
                      {job.status === "complete"
                        ? t("transcriptionComplete")
                        : job.status === "failed"
                          ? t("transcriptionFailed")
                          : t("transcriptionProgress")}
                    </span>
                    <span className="tabular-nums text-stone-600">
                      {job.completedChunks} / {job.totalChunks}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        job.status === "failed" ? "bg-rose-600" : "bg-emerald-700",
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {job.currentLabel
                      ? `${t("processingChunk")}: ${job.currentLabel}`
                      : message}
                  </p>
                </div>
              ) : null}

              {message ? (
                <p
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    requestState === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-sky-200 bg-sky-50 text-sky-900",
                  )}
                >
                  {message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isWorking ||
                    password.length === 0 ||
                    (!hasSelectedSegments &&
                      (isFullRecordingTooLong || !includeFullRecording))
                  }
                  type="submit"
                >
                  {isWorking ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                  )}
                  {t("authorise")}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
