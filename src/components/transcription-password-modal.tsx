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
import { cn } from "@/lib/utils";

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
  selectedSegmentCount,
  selectedSegmentSeconds,
  transcriptErrorMessage,
  transcriptStatus,
}: {
  lessonId: string;
  recordingDurationSeconds: number;
  recordingId: string;
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
  }

  const visibleTranscriptFailure =
    transcriptStatus === "failed" && transcriptErrorMessage;

  return (
    <>
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-amber-800" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-950">
              {t("transcriptionNote")}
            </p>
            <p className="max-w-3xl text-sm leading-6 text-amber-900">
              {t("transcriptionClipFirstBody")}
            </p>
            {visibleTranscriptFailure ? (
              <p className="rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">
                {transcriptErrorMessage}
              </p>
            ) : null}
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              onClick={openGate}
              type="button"
            >
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
              {t("transcribeLesson")}
            </button>
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
                    requestState === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : requestState === "error"
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
                  {requestState === "success" ? (
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      {t("cancel")}
                    </span>
                  ) : (
                    t("cancel")
                  )}
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
          </div>
        </div>
      ) : null}
    </>
  );
}
