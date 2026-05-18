"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic2, Square } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { cn, formatDuration } from "@/lib/utils";

type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "saving"
  | "saved"
  | "error";

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  return (
    MIME_TYPE_CANDIDATES.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    ) ?? ""
  );
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function localDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function lessonTitle(date: Date) {
  const label = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return `Leo lesson - ${label}`;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function LessonRecorder({ className }: { className?: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (recordingState !== "recording") return;

    const intervalId = window.setInterval(() => {
      const startedAt = startedAtRef.current?.getTime();
      if (!startedAt) return;

      setElapsedSeconds(
        Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
      );
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [recordingState]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      stopStream(streamRef.current);
    };
  }, []);

  async function uploadRecording(
    blob: Blob,
    startedAt: Date,
    durationSeconds: number,
  ) {
    const formData = new FormData();
    const mimeType = blob.type || "audio/webm";

    formData.append(
      "audio",
      blob,
      `lesson-recording.${extensionForMimeType(mimeType)}`,
    );
    formData.append("title", lessonTitle(startedAt));
    formData.append("teacher", "Leo");
    formData.append("lessonDate", localDateInputValue(startedAt));
    formData.append(
      "summary",
      "Recorded live in Practice Loop. Ready for authorised transcription.",
    );
    formData.append("durationSeconds", String(durationSeconds));

    const response = await fetch("/api/lesson-recordings/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Recording upload failed.");
    }
  }

  async function finishRecording(mimeType: string) {
    const startedAt = startedAtRef.current ?? new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAt.getTime()) / 1000),
    );
    const blob = new Blob(chunksRef.current, {
      type: mimeType || "audio/webm",
    });

    chunksRef.current = [];
    stopStream(streamRef.current);
    streamRef.current = null;
    mediaRecorderRef.current = null;

    if (blob.size === 0) {
      setRecordingState("error");
      setMessage(t("recordingUploadFailed"));
      return;
    }

    try {
      await uploadRecording(blob, startedAt, durationSeconds);
      setElapsedSeconds(durationSeconds);
      setRecordingState("saved");
      setMessage(t("liveRecordingSaved"));
      router.refresh();
    } catch {
      setRecordingState("error");
      setMessage(t("recordingUploadFailed"));
    }
  }

  async function startRecording() {
    setMessage("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingState("error");
      setMessage(t("microphoneUnavailable"));
      return;
    }

    setRecordingState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedMimeType();
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      startedAtRef.current = new Date();
      setElapsedSeconds(0);

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", () => {
        void finishRecording(mediaRecorder.mimeType || mimeType);
      });
      mediaRecorder.start(1000);
      setRecordingState("recording");
    } catch {
      stopStream(streamRef.current);
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setRecordingState("error");
      setMessage(t("microphoneUnavailable"));
    }
  }

  function stopRecording() {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    setRecordingState("saving");
    mediaRecorder.stop();
  }

  const isBusy =
    recordingState === "requesting" || recordingState === "saving";
  const isRecording = recordingState === "recording";
  const buttonLabel = isRecording
    ? t("stopAndSaveLesson")
    : recordingState === "requesting"
      ? t("waitingForMicrophone")
      : recordingState === "saving"
        ? t("savingRecording")
        : t("startLiveLessonRecording");

  return (
    <div className={cn("space-y-2", className)}>
      <button
        className={cn(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-3 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
          isRecording
            ? "bg-rose-700 text-white hover:bg-rose-800"
            : "bg-emerald-950 text-white hover:bg-emerald-900",
        )}
        disabled={isBusy}
        onClick={() => {
          if (isRecording) {
            stopRecording();
            return;
          }

          void startRecording();
        }}
        type="button"
      >
        {recordingState === "requesting" || recordingState === "saving" ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square aria-hidden="true" className="h-4 w-4 fill-current" />
        ) : (
          <Mic2 aria-hidden="true" className="h-4 w-4" />
        )}
        {buttonLabel}
      </button>

      {isRecording ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
          {t("recordingNow")} {formatDuration(elapsedSeconds)}
        </p>
      ) : null}

      {message ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            recordingState === "saved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
