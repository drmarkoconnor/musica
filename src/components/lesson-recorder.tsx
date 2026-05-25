"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Mic2, RotateCcw, Square, Trash2 } from "lucide-react";
import {
  deleteLessonRecordingDraft,
  lessonRecordingDraftStorageAvailable,
  listLessonRecordingDrafts,
  loadLessonRecordingDraft,
  type LessonRecordingDraft,
  requestPersistentRecordingStorage,
  saveLessonRecordingChunk,
  saveLessonRecordingDraft,
  updateLessonRecordingDraft,
} from "@/lib/browser/lesson-recording-drafts";
import {
  createDeviceRecordingBackup,
  type DeviceRecordingBackup,
  deviceRecordingBackupSupported,
} from "@/lib/browser/device-recording-backup";
import { useLanguage } from "@/lib/language";
import { cn, formatDuration } from "@/lib/utils";

type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "saving"
  | "saved"
  | "error";

type RecoveryState = "idle" | "saving" | "downloading" | "error";

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];
const RECORDER_TIMESLICE_MS = 10000;
const DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const LOCAL_SAVE_SETTLE_TIMEOUT_MS = 8000;
const STOP_EVENT_TIMEOUT_MS = 5000;
const UPLOAD_SESSION_TIMEOUT_MS = 15000;
const UPLOAD_CHUNK_TIMEOUT_MS = 45000;
const UPLOAD_COMPLETE_TIMEOUT_MS = 120000;
const DIRECT_UPLOAD_TIMEOUT_MS = 45000;
const DEVICE_BACKUP_TIMEOUT_MS = 10000;

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function newDraftId() {
  return (
    crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function safeFileStem(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "lesson-recording";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function LessonRecorder({
  className,
  lessonId,
  onRecordingFailed,
  onRecordingSaving,
  onRecordingStarted,
  onSaved,
}: {
  className?: string;
  lessonId?: string;
  onRecordingFailed?: () => void;
  onRecordingSaving?: () => void;
  onRecordingStarted?: (startedAt: Date) => void;
  onSaved?: (lessonId: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [message, setMessage] = useState("");
  const [recoverableDrafts, setRecoverableDrafts] = useState<
    LessonRecordingDraft[]
  >([]);
  const [isDeviceBackupSupported, setIsDeviceBackupSupported] = useState(false);
  const [saveDeviceCopy, setSaveDeviceCopy] = useState(false);
  const [recoveryState, setRecoveryState] = useState<
    Record<string, RecoveryState>
  >({});
  const activeDraftRef = useRef<LessonRecordingDraft | null>(null);
  const activeDraftIdRef = useRef("");
  const chunkIndexRef = useRef(0);
  const chunkSavePromisesRef = useRef<Promise<unknown>[]>([]);
  const chunksRef = useRef<Blob[]>([]);
  const deviceBackupRef = useRef<DeviceRecordingBackup | null>(null);
  const deviceBackupStatusRef = useRef<"idle" | "active" | "saved" | "failed">(
    "idle",
  );
  const deviceBackupWritePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const finishStartedRef = useRef(false);
  const localBackupAvailableRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const serverUploadSessionPromiseRef = useRef<Promise<string> | null>(null);
  const stopFallbackTimeoutRef = useRef<number | null>(null);
  const uploadedServerChunkIndexesRef = useRef<Set<number>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    const supported = deviceRecordingBackupSupported();

    setIsDeviceBackupSupported(supported);
    setSaveDeviceCopy(supported);
    void refreshRecoverableDrafts();
  }, []);

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
    if (recordingState !== "recording" && recordingState !== "saving") return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [recordingState]);

  useEffect(() => {
    return () => {
      if (stopFallbackTimeoutRef.current) {
        window.clearTimeout(stopFallbackTimeoutRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      stopStream(streamRef.current);
    };
  }, []);

  async function refreshRecoverableDrafts() {
    if (!lessonRecordingDraftStorageAvailable()) return;

    try {
      setRecoverableDrafts(await listLessonRecordingDrafts());
    } catch {
      setRecoverableDrafts([]);
    }
  }

  async function startLocalRescueDraft(draft: LessonRecordingDraft) {
    if (!lessonRecordingDraftStorageAvailable()) {
      setMessage(t("recordingLocalBackupUnavailable"));
      return;
    }

    try {
      await requestPersistentRecordingStorage();
      await saveLessonRecordingDraft(draft);
      localBackupAvailableRef.current = true;

      const existingChunks = chunksRef.current.slice();

      existingChunks.forEach((blob, index) => {
        const savePromise = saveLessonRecordingChunk({
          blob,
          draftId: draft.id,
          index,
        }).catch((error) => {
          console.error("Lesson recording rescue catch-up save failed", error);
          localBackupAvailableRef.current = false;
          setMessage(t("recordingLocalBackupUnavailable"));
        });

        chunkSavePromisesRef.current.push(savePromise);
      });
    } catch (error) {
      console.error("Lesson recording rescue setup failed", error);
      setMessage(t("recordingLocalBackupUnavailable"));
    }
  }

  function draftForRecording(startedAt: Date, mimeType: string): LessonRecordingDraft {
    const now = new Date().toISOString();
    const validLessonId = lessonId && isUuid(lessonId) ? lessonId : undefined;

    return {
      chunkCount: 0,
      createdAt: now,
      id: newDraftId(),
      lessonDate: localDateInputValue(startedAt),
      lessonId: validLessonId,
      mimeType: mimeType || "audio/webm",
      startedAt: startedAt.toISOString(),
      summary: "Recorded live in Practice Loop. Ready for authorised transcription.",
      teacher: "Leo",
      title: lessonTitle(startedAt),
      updatedAt: now,
    };
  }

  async function recordingBlobFromDraft(draftId: string) {
    const { chunks, draft } = await loadLessonRecordingDraft(draftId);

    if (!draft || chunks.length === 0) {
      throw new Error(t("recordingRecoveryUnavailable"));
    }

    return {
      blob: new Blob(
        chunks.map((chunk) => chunk.blob),
        { type: draft.mimeType || "audio/webm" },
      ),
      draft,
    };
  }

  function durationForDraft(draft: LessonRecordingDraft) {
    if (draft.durationSeconds && draft.durationSeconds > 0) {
      return draft.durationSeconds;
    }

    const startedAt = new Date(draft.startedAt).getTime();
    const updatedAt = new Date(draft.updatedAt).getTime();

    if (Number.isFinite(startedAt) && Number.isFinite(updatedAt)) {
      return Math.max(1, Math.round((updatedAt - startedAt) / 1000));
    }

    return Math.max(1, draft.chunkCount);
  }

  function downloadBlob(blob: Blob, draft: LessonRecordingDraft) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const extension = extensionForMimeType(draft.mimeType || "audio/webm");

    link.href = url;
    link.download = `${safeFileStem(draft.title)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function startServerUploadSession(draft: LessonRecordingDraft) {
    if (draft.serverUploadId) return draft.serverUploadId;

    if (serverUploadSessionPromiseRef.current) {
      return serverUploadSessionPromiseRef.current;
    }

    serverUploadSessionPromiseRef.current = (async () => {
      const response = await fetchWithTimeout(
        "/api/lesson-recordings/upload-session",
        {
          body: JSON.stringify({
            contentType: draft.mimeType || "audio/webm",
            extension: extensionForMimeType(draft.mimeType || "audio/webm"),
            lessonDate: draft.lessonDate,
            lessonId: draft.lessonId,
            recordedAt: draft.startedAt,
            summary: draft.summary,
            teacher: draft.teacher,
            title: draft.title,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        UPLOAD_SESSION_TIMEOUT_MS,
        t("recordingUploadTimedOut"),
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(body?.error ?? t("recordingServerUploadPaused"));
      }

      const body = (await response.json().catch(() => null)) as {
        uploadId?: string;
      } | null;

      if (!body?.uploadId) {
        throw new Error(t("recordingServerUploadPaused"));
      }

      activeDraftRef.current = {
        ...(activeDraftRef.current ?? draft),
        serverUploadId: body.uploadId,
      };

      await updateLessonRecordingDraft(draft.id, {
        serverUploadId: body.uploadId,
      }).catch((error) => {
        console.error("Lesson recording upload session persist failed", error);
      });

      return body.uploadId;
    })();

    try {
      return await serverUploadSessionPromiseRef.current;
    } catch (error) {
      serverUploadSessionPromiseRef.current = null;
      throw error;
    }
  }

  async function uploadServerChunk({
    blob,
    chunkIndex,
    draft,
  }: {
    blob: Blob;
    chunkIndex: number;
    draft: LessonRecordingDraft;
  }) {
    const uploadId = await startServerUploadSession(draft);
    const response = await fetchWithTimeout(
      `/api/lesson-recordings/upload-session/${uploadId}/chunks/${chunkIndex}`,
      {
        body: blob,
        headers: {
          "Content-Type": blob.type || draft.mimeType || "audio/webm",
        },
        method: "PUT",
      },
      UPLOAD_CHUNK_TIMEOUT_MS,
      t("recordingUploadTimedOut"),
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(body?.error ?? t("recordingServerUploadPaused"));
    }

    uploadedServerChunkIndexesRef.current.add(chunkIndex);
  }

  async function uploadDraftByChunks({
    chunks,
    draft,
    durationSeconds,
  }: {
    chunks: Array<{ blob: Blob; index: number }>;
    draft: LessonRecordingDraft;
    durationSeconds: number;
  }) {
    if (chunks.length === 0) {
      throw new Error(t("recordingRecoveryUnavailable"));
    }

    const uploadId = await startServerUploadSession(draft);

    for (const chunk of chunks) {
      if (!uploadedServerChunkIndexesRef.current.has(chunk.index)) {
        await uploadServerChunk({
          blob: chunk.blob,
          chunkIndex: chunk.index,
          draft: {
            ...draft,
            serverUploadId: uploadId,
          },
        });
      }
    }

    const response = await fetchWithTimeout(
      `/api/lesson-recordings/upload-session/${uploadId}/complete`,
      {
        body: JSON.stringify({
          chunkCount: chunks.length,
          durationSeconds,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      UPLOAD_COMPLETE_TIMEOUT_MS,
      t("recordingUploadTimedOut"),
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(body?.error ?? t("recordingUploadFailedRecoverable"));
    }

    const body = (await response.json().catch(() => null)) as {
      lessonId?: string;
    } | null;

    if (body?.lessonId) {
      onSaved?.(body.lessonId);
    }
  }

  async function uploadDraftDirectly({
    chunks,
    draft,
    durationSeconds,
  }: {
    chunks: Array<{ blob: Blob; index: number }>;
    draft: LessonRecordingDraft;
    durationSeconds: number;
  }) {
    if (chunks.length === 0) {
      throw new Error(t("recordingRecoveryUnavailable"));
    }

    const mimeType = draft.mimeType || chunks[0]?.blob.type || "audio/webm";
    const extension = extensionForMimeType(mimeType);
    const recordingBlob = new Blob(
      chunks.map((chunk) => chunk.blob),
      { type: mimeType },
    );
    const formData = new FormData();

    formData.append(
      "audio",
      recordingBlob,
      `${safeFileStem(draft.title)}.${extension}`,
    );
    formData.append("durationSeconds", String(durationSeconds));
    formData.append("lessonDate", draft.lessonDate);
    if (draft.lessonId) {
      formData.append("lessonId", draft.lessonId);
    }
    formData.append("recordedAt", draft.startedAt);
    formData.append("summary", draft.summary);
    formData.append("teacher", draft.teacher);
    formData.append("title", draft.title);

    const response = await fetchWithTimeout(
      "/api/lesson-recordings/upload",
      {
        body: formData,
        method: "POST",
      },
      DIRECT_UPLOAD_TIMEOUT_MS,
      t("recordingUploadTimedOut"),
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(body?.error ?? t("recordingUploadFailedRecoverable"));
    }

    const body = (await response.json().catch(() => null)) as {
      lessonId?: string;
    } | null;

    if (body?.lessonId) {
      onSaved?.(body.lessonId);
    }
  }

  async function uploadDraftRecording({
    chunks,
    draft,
    durationSeconds,
    totalBytes,
  }: {
    chunks: Array<{ blob: Blob; index: number }>;
    draft: LessonRecordingDraft;
    durationSeconds: number;
    totalBytes: number;
  }) {
    if (totalBytes <= DIRECT_UPLOAD_MAX_BYTES) {
      try {
        await uploadDraftDirectly({
          chunks,
          draft,
          durationSeconds,
        });
        return;
      } catch (error) {
        console.error("Direct lesson recording upload failed", error);
        if (
          error instanceof Error &&
          error.message === t("recordingUploadTimedOut")
        ) {
          throw error;
        }
        setMessage(t("recordingServerUploadPaused"));
      }
    }

    await uploadDraftByChunks({
      chunks,
      draft,
      durationSeconds,
    });
  }

  async function closeDeviceBackup() {
    const deviceBackup = deviceBackupRef.current;

    if (!deviceBackup) return;

    try {
      await withTimeout(
        deviceBackupWritePromiseRef.current,
        DEVICE_BACKUP_TIMEOUT_MS,
        t("deviceCopyFailed"),
      );
      await withTimeout(
        deviceBackup.writable.close(),
        DEVICE_BACKUP_TIMEOUT_MS,
        t("deviceCopyFailed"),
      );
      if (deviceBackupStatusRef.current !== "failed") {
        deviceBackupStatusRef.current = "saved";
      }
    } catch (error) {
      console.error("Device recording backup close failed", error);
      deviceBackupStatusRef.current = "failed";
      setMessage(t("deviceCopyFailed"));
    } finally {
      deviceBackupRef.current = null;
      deviceBackupWritePromiseRef.current = Promise.resolve();
    }
  }

  function writeDeviceBackupChunk(blob: Blob) {
    const deviceBackup = deviceBackupRef.current;

    if (!deviceBackup) return;

    deviceBackupWritePromiseRef.current = deviceBackupWritePromiseRef.current
      .then(() => deviceBackup.writable.write(blob))
      .catch((error) => {
        console.error("Device recording backup write failed", error);
        deviceBackupRef.current = null;
        deviceBackupStatusRef.current = "failed";
        setMessage(t("deviceCopyFailed"));
      });
  }

  async function finishRecording(mimeType: string) {
    const startedAt = startedAtRef.current ?? new Date();
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startedAt.getTime()) / 1000),
    );
    const draftId = activeDraftIdRef.current;

    stopStream(streamRef.current);
    streamRef.current = null;
    mediaRecorderRef.current = null;

    await withTimeout(
      Promise.allSettled(chunkSavePromisesRef.current),
      LOCAL_SAVE_SETTLE_TIMEOUT_MS,
      t("recordingLocalBackupUnavailable"),
    ).catch((error) => {
      console.error("Lesson recording rescue save wait timed out", error);
    });
    await closeDeviceBackup();

    let draft: LessonRecordingDraft | undefined;
    let chunks = chunksRef.current.map((blob, index) => ({ blob, index }));

    if (draftId && localBackupAvailableRef.current) {
      try {
        const loaded = await loadLessonRecordingDraft(draftId);

        draft = loaded.draft;

        if (loaded.chunks.length >= chunks.length) {
          chunks = loaded.chunks.map((chunk) => ({
            blob: chunk.blob,
            index: chunk.index,
          }));
        }

        if (draft) {
          draft = {
            ...draft,
            chunkCount: Math.max(draft.chunkCount, loaded.chunks.length),
            durationSeconds,
            updatedAt: new Date().toISOString(),
          };
          await saveLessonRecordingDraft(draft);
        }
      } catch (error) {
        console.error("Lesson recording rescue load failed", error);
      }
    }

    const totalBytes = chunks.reduce((total, chunk) => total + chunk.blob.size, 0);

    if (totalBytes === 0) {
      setRecordingState("error");
      setMessage(t("recordingUploadFailed"));
      onRecordingFailed?.();
      return;
    }

    try {
      const uploadDraft =
        draft ??
        draftForRecording(startedAt, mimeType || chunks[0]?.blob.type || "audio/webm");
      const deviceCopyFileName = draft?.deviceCopyFileName;
      const deviceCopyStatus = deviceBackupStatusRef.current;

      await uploadDraftRecording({
        chunks,
        draft: uploadDraft,
        durationSeconds,
        totalBytes,
      });
      if (draftId) {
        await deleteLessonRecordingDraft(draftId).catch((error) => {
          console.error("Lesson recording rescue cleanup failed", error);
        });
      }
      activeDraftRef.current = null;
      activeDraftIdRef.current = "";
      chunkIndexRef.current = 0;
      chunkSavePromisesRef.current = [];
      chunksRef.current = [];
      serverUploadSessionPromiseRef.current = null;
      uploadedServerChunkIndexesRef.current = new Set();
      localBackupAvailableRef.current = false;
      await refreshRecoverableDrafts();
      setElapsedSeconds(durationSeconds);
      setRecordingState("saved");
      setMessage(
        deviceCopyFileName && deviceCopyStatus === "saved"
          ? `${t("liveRecordingSaved")} ${t("deviceCopySaved")}: ${
              deviceCopyFileName
            }`
          : deviceCopyStatus === "failed"
            ? `${t("liveRecordingSaved")} ${t("deviceCopyFailed")}`
          : t("liveRecordingSaved"),
      );
      deviceBackupStatusRef.current = "idle";
      router.refresh();
    } catch (error) {
      const errorMessage =
        draftId && localBackupAvailableRef.current
          ? t("recordingUploadFailedRecoverable")
          : error instanceof Error
            ? error.message
            : t("recordingUploadFailed");

      setRecordingState("error");
      setMessage(
        deviceBackupStatusRef.current === "saved" && draft?.deviceCopyFileName
          ? `${errorMessage} ${t("deviceCopySaved")}: ${draft.deviceCopyFileName}`
          : errorMessage,
      );
      await refreshRecoverableDrafts();
      onRecordingFailed?.();
    }
  }

  async function finishRecordingOnce(mimeType: string) {
    if (finishStartedRef.current) return;

    finishStartedRef.current = true;

    if (stopFallbackTimeoutRef.current) {
      window.clearTimeout(stopFallbackTimeoutRef.current);
      stopFallbackTimeoutRef.current = null;
    }

    await finishRecording(mimeType);
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

    let deviceBackup: DeviceRecordingBackup | null = null;
    const mimeType = supportedMimeType();
    const startedAt = new Date();
    const draft = draftForRecording(startedAt, mimeType);
    deviceBackupStatusRef.current = "idle";

    if (saveDeviceCopy && isDeviceBackupSupported) {
      try {
        deviceBackup = await createDeviceRecordingBackup({
          extension: extensionForMimeType(mimeType || "audio/webm"),
          mimeType: mimeType || "audio/webm",
          suggestedName: safeFileStem(draft.title),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setMessage(t("deviceCopySkipped"));
        } else {
          console.error("Device recording backup setup failed", error);
          deviceBackupStatusRef.current = "failed";
          setMessage(t("deviceCopyFailed"));
        }
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      activeDraftRef.current = draft;
      activeDraftIdRef.current = draft.id;
      chunkIndexRef.current = 0;
      chunkSavePromisesRef.current = [];
      chunksRef.current = [];
      deviceBackupRef.current = deviceBackup;
      deviceBackupStatusRef.current = deviceBackup
        ? "active"
        : deviceBackupStatusRef.current;
      deviceBackupWritePromiseRef.current = Promise.resolve();
      finishStartedRef.current = false;
      localBackupAvailableRef.current = false;
      serverUploadSessionPromiseRef.current = null;
      uploadedServerChunkIndexesRef.current = new Set();
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      startedAtRef.current = startedAt;
      setElapsedSeconds(0);

      if (deviceBackup) {
        draft.deviceCopyFileName = deviceBackup.fileName;
      }

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          writeDeviceBackupChunk(event.data);
          const draftId = activeDraftIdRef.current;
          const chunkIndex = chunkIndexRef.current;
          chunkIndexRef.current += 1;

          if (draftId && localBackupAvailableRef.current) {
            const savePromise = saveLessonRecordingChunk({
              blob: event.data,
              draftId,
              index: chunkIndex,
            }).catch((error) => {
              console.error("Lesson recording rescue chunk save failed", error);
              localBackupAvailableRef.current = false;
              setMessage(t("recordingLocalBackupUnavailable"));
            });

            chunkSavePromisesRef.current.push(savePromise);
          }
        }
      });
      mediaRecorder.addEventListener("stop", () => {
        void finishRecordingOnce(mediaRecorder.mimeType || mimeType);
      });
      mediaRecorder.start(RECORDER_TIMESLICE_MS);
      onRecordingStarted?.(startedAt);
      setRecordingState("recording");
      void startLocalRescueDraft(draft);
    } catch (error) {
      console.error("Lesson recording start failed", error);
      if (deviceBackup) {
        await deviceBackup.writable.close().catch(() => {});
      }
      stopStream(streamRef.current);
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setRecordingState("error");
      setMessage(t("microphoneUnavailable"));
      deviceBackupStatusRef.current = "idle";
      onRecordingFailed?.();
    }
  }

  async function retryDraftSave(draftId: string) {
    setRecoveryState((current) => ({ ...current, [draftId]: "saving" }));
    setMessage("");

    try {
      const { chunks, draft } = await loadLessonRecordingDraft(draftId);

      if (!draft || chunks.length === 0) {
        throw new Error(t("recordingRecoveryUnavailable"));
      }

      const retryDraft = { ...draft, serverUploadId: undefined };

      await updateLessonRecordingDraft(draft.id, {
        serverUploadId: undefined,
      }).catch((error) => {
        console.error("Lesson recording retry session reset failed", error);
      });

      activeDraftRef.current = retryDraft;
      serverUploadSessionPromiseRef.current = null;
      uploadedServerChunkIndexesRef.current = new Set();

      const retryChunks = chunks.map((chunk) => ({
        blob: chunk.blob,
        index: chunk.index,
      }));
      const totalBytes = retryChunks.reduce(
        (total, chunk) => total + chunk.blob.size,
        0,
      );

      await uploadDraftRecording({
        chunks: retryChunks,
        draft: retryDraft,
        durationSeconds: durationForDraft(draft),
        totalBytes,
      });
      await deleteLessonRecordingDraft(draftId);
      activeDraftRef.current = null;
      serverUploadSessionPromiseRef.current = null;
      uploadedServerChunkIndexesRef.current = new Set();
      setRecoveryState((current) => ({ ...current, [draftId]: "idle" }));
      setMessage(t("liveRecordingSaved"));
      await refreshRecoverableDrafts();
      router.refresh();
    } catch (error) {
      setRecoveryState((current) => ({ ...current, [draftId]: "error" }));
      setMessage(
        error instanceof Error
          ? error.message
          : t("recordingUploadFailedRecoverable"),
      );
    }
  }

  async function downloadDraft(draftId: string) {
    setRecoveryState((current) => ({ ...current, [draftId]: "downloading" }));
    setMessage("");

    try {
      const { blob, draft } = await recordingBlobFromDraft(draftId);

      downloadBlob(blob, draft);
      setRecoveryState((current) => ({ ...current, [draftId]: "idle" }));
    } catch (error) {
      setRecoveryState((current) => ({ ...current, [draftId]: "error" }));
      setMessage(
        error instanceof Error ? error.message : t("recordingRecoveryUnavailable"),
      );
    }
  }

  async function discardDraft(draftId: string) {
    setRecoveryState((current) => ({ ...current, [draftId]: "saving" }));

    try {
      await deleteLessonRecordingDraft(draftId);
      setRecoveryState((current) => ({ ...current, [draftId]: "idle" }));
      await refreshRecoverableDrafts();
    } catch {
      setRecoveryState((current) => ({ ...current, [draftId]: "error" }));
      setMessage(t("saveFailed"));
    }
  }

  function stopRecording() {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    setRecordingState("saving");
    onRecordingSaving?.();
    try {
      mediaRecorder.requestData();
    } catch (error) {
      console.error("Lesson recording final data request failed", error);
    }
    mediaRecorder.stop();
    stopFallbackTimeoutRef.current = window.setTimeout(() => {
      void finishRecordingOnce(mediaRecorder.mimeType || supportedMimeType());
    }, STOP_EVENT_TIMEOUT_MS);
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

      {isDeviceBackupSupported ? (
        <label className="flex items-start gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
          <input
            checked={saveDeviceCopy}
            className="mt-1 h-4 w-4 rounded border-stone-300 accent-emerald-900"
            disabled={isRecording || isBusy}
            onChange={(event) => setSaveDeviceCopy(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-stone-900">
              {t("saveDeviceCopy")}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-stone-500">
              {t("saveDeviceCopyHelp")}
            </span>
          </span>
        </label>
      ) : null}

      {isRecording ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900">
          {t("recordingNow")} {formatDuration(elapsedSeconds)}
        </p>
      ) : null}

      {isRecording || recordingState === "saving" ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm leading-6 text-sky-950">
          {t("recordingStoredLocally")}
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

      {recoverableDrafts.length > 0 ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">{t("recoverableRecordings")}</p>
            <p className="mt-1 leading-6">{t("recordingRescueReady")}</p>
          </div>
          <div className="space-y-2">
            {recoverableDrafts.map((draft) => {
              const state = recoveryState[draft.id] ?? "idle";
              const isWorking = state === "saving" || state === "downloading";
              const startedAt = new Date(draft.startedAt);
              const startedLabel = Number.isNaN(startedAt.getTime())
                ? draft.title
                : new Intl.DateTimeFormat(undefined, {
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                  }).format(startedAt);

              return (
                <div
                  className="rounded-md border border-amber-200 bg-white/80 p-2"
                  key={draft.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-950">
                        {draft.title}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-600">
                        {startedLabel}
                        {draft.durationSeconds
                          ? ` / ${formatDuration(draft.durationSeconds)}`
                          : draft.chunkCount
                            ? ` / ${draft.chunkCount} chunks`
                            : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-950 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isWorking}
                        onClick={() => void retryDraftSave(draft.id)}
                        type="button"
                      >
                        {state === "saving" ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin"
                          />
                        ) : (
                          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {t("retrySavingRecording")}
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isWorking}
                        onClick={() => void downloadDraft(draft.id)}
                        type="button"
                      >
                        {state === "downloading" ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-spin"
                          />
                        ) : (
                          <Download aria-hidden="true" className="h-3.5 w-3.5" />
                        )}
                        {t("downloadRecoveryCopy")}
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isWorking}
                        onClick={() => void discardDraft(draft.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        {t("discardRecoveryCopy")}
                      </button>
                    </div>
                  </div>
                  {state === "error" ? (
                    <p className="mt-2 text-xs font-medium text-rose-700">
                      {t("recordingRecoveryActionFailed")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
