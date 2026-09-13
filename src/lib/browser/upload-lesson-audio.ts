export const LESSON_AUDIO_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_LESSON_AUDIO_BYTES = 512 * 1024 * 1024;
export type LessonAudioUploadMetadata = {
  lessonDate: string; lessonId?: string; recordedAt: string;
  summary: string; teacher: string; title: string;
};
export type LessonAudioUploadProgress = { uploadedBytes: number; totalBytes: number; phase: "uploading" | "finalising" };
export type LessonAudioUploadResult = { lessonId: string; recordingId: string; storagePath?: string };
type Receipt = { chunkIndex: number; byteLength: number; sha256: string };
type ResumeState = { uploadId: string; acknowledgedChunks: Receipt[]; completed?: LessonAudioUploadResult };
const inMemorySessions = new Map<string, ResumeState>();
const activeUploads = new Map<string, Promise<LessonAudioUploadResult>>();
const KEY_PREFIX = "practice-loop-file-upload-v1:";

function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException("Upload cancelled. Choose the same file to resume.", "AbortError"); }
async function sha256(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function textDigest(text: string) { return sha256(new TextEncoder().encode(text).buffer); }
function readResume(key: string): ResumeState | null {
  try {
    const value = globalThis.localStorage?.getItem(KEY_PREFIX + key);
    if (value) return JSON.parse(value) as ResumeState;
  } catch { /* Private browsing may disable persistent storage. */ }
  return inMemorySessions.get(key) ?? null;
}
function saveResume(key: string, state: ResumeState) {
  inMemorySessions.set(key, state);
  try { globalThis.localStorage?.setItem(KEY_PREFIX + key, JSON.stringify(state)); } catch { /* In-memory retries remain available. */ }
}
async function requestJson<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    checkAbort(signal);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = Object.assign(new Error(body?.error ?? `Upload request failed (${response.status}).`), { status: response.status });
        if (response.status < 500 && response.status !== 408 && response.status !== 429) throw error;
        lastError = error;
      } else if (body) return body as T;
      else lastError = new Error("The server did not confirm the upload. Please retry.");
    } catch (error) {
      checkAbort(signal);
      if (typeof (error as { status?: number }).status === "number" && (error as { status: number }).status < 500) throw error;
      lastError = error;
    } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Upload interrupted. Choose the same file to resume.");
}
function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["aac", "m4a", "mp3", "mp4", "ogg", "wav", "webm"].includes(extension)) return extension;
  const byType: Record<string, string> = { "audio/aac": "aac", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "video/mp4": "mp4" };
  const fromType = byType[file.type.split(";")[0].toLowerCase()];
  if (!fromType) throw new Error("Choose an M4A, MP3, AAC, MP4, OGG, WAV or WebM recording.");
  return fromType;
}
export async function uploadLessonAudio(file: File, options: {
  metadata: LessonAudioUploadMetadata; durationSeconds: number | null;
  onProgress?: (progress: LessonAudioUploadProgress) => void; signal?: AbortSignal;
}): Promise<LessonAudioUploadResult> {
  const { metadata, onProgress, signal } = options;
  if (file.size <= 0) throw new Error("The selected recording is empty.");
  if (file.size > MAX_LESSON_AUDIO_BYTES) throw new Error("The recording limit is 512 MiB. Export a compressed M4A or MP3 version and try again.");
  const extension = fileExtension(file);
  checkAbort(signal);
  onProgress?.({ uploadedBytes: 0, totalBytes: file.size, phase: "uploading" });
  const receipts: Receipt[] = [];
  // Hash only one 2 MiB slice at a time. The ordered receipt digest identifies
  // every byte without requiring a 512 MiB ArrayBuffer in the browser.
  for (let start = 0, chunkIndex = 0; start < file.size; start += LESSON_AUDIO_CHUNK_BYTES, chunkIndex++) {
    checkAbort(signal);
    const slice = file.slice(start, start + LESSON_AUDIO_CHUNK_BYTES);
    receipts.push({ chunkIndex, byteLength: slice.size, sha256: await sha256(await slice.arrayBuffer()) });
  }
  const integrityDigest = await textDigest(receipts.map((chunk) => `${chunk.chunkIndex}:${chunk.byteLength}:${chunk.sha256}\n`).join(""));
  const fingerprint = await textDigest(JSON.stringify({ integrityDigest, name: file.name, size: file.size, lastModified: file.lastModified, lessonId: metadata.lessonId ?? "", lessonDate: metadata.lessonDate }));
  const active = activeUploads.get(fingerprint);
  if (active) return active;
  const upload = (async () => {
    let resume = readResume(fingerprint);
    if (resume) {
      try {
        const status = await requestJson<{ file?: { fingerprint: string }; acknowledgedChunks: Receipt[]; completed?: LessonAudioUploadResult }>(`/api/lesson-recordings/upload-session/${resume.uploadId}`, { method: "GET" }, signal);
        if (status.file?.fingerprint !== fingerprint) throw new Error("Saved upload does not match this recording.");
        resume = { uploadId: resume.uploadId, acknowledgedChunks: status.acknowledgedChunks, completed: status.completed };
        saveResume(fingerprint, resume);
      } catch (error) {
        if ((error as { status?: number }).status === 404) resume = null;
        else throw error;
      }
    }
    if (resume?.completed) {
      onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, phase: "finalising" });
      return resume.completed;
    }
    if (!resume) {
      const session = await requestJson<{ uploadId: string }>("/api/lesson-recordings/upload-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata, contentType: file.type || ({ m4a: "audio/mp4", mp3: "audio/mpeg" } as Record<string, string>)[extension] || "application/octet-stream", extension, fingerprint, totalBytes: file.size, chunkBytes: LESSON_AUDIO_CHUNK_BYTES }),
      }, signal);
      if (!session.uploadId) throw new Error("The upload session could not be confirmed.");
      resume = { uploadId: session.uploadId, acknowledgedChunks: [] };
      saveResume(fingerprint, resume);
    }
    const confirmed = new Map(resume.acknowledgedChunks.map((receipt) => [receipt.chunkIndex, receipt]));
    let uploadedBytes = 0;
    for (const receipt of receipts) {
      const existing = confirmed.get(receipt.chunkIndex);
      if (existing) {
        if (existing.sha256 !== receipt.sha256 || existing.byteLength !== receipt.byteLength) throw new Error("Uploaded bytes do not match this file. Choose the original recording to resume.");
        uploadedBytes += receipt.byteLength;
      }
    }
    onProgress?.({ uploadedBytes, totalBytes: file.size, phase: "uploading" });
    for (const receipt of receipts) {
      checkAbort(signal);
      if (confirmed.has(receipt.chunkIndex)) continue;
      const start = receipt.chunkIndex * LESSON_AUDIO_CHUNK_BYTES;
      const acknowledged = await requestJson<Receipt>(`/api/lesson-recordings/upload-session/${resume.uploadId}/chunks/${receipt.chunkIndex}`, {
        method: "PUT", body: file.slice(start, start + receipt.byteLength),
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Chunk-SHA256": receipt.sha256 },
      }, signal);
      if (acknowledged.sha256 !== receipt.sha256 || acknowledged.byteLength !== receipt.byteLength || acknowledged.chunkIndex !== receipt.chunkIndex) throw new Error("The server could not verify a recording chunk. Please retry.");
      resume.acknowledgedChunks.push(receipt);
      saveResume(fingerprint, resume);
      uploadedBytes += receipt.byteLength;
      onProgress?.({ uploadedBytes, totalBytes: file.size, phase: "uploading" });
    }
    onProgress?.({ uploadedBytes: file.size, totalBytes: file.size, phase: "finalising" });
    const result = await requestJson<LessonAudioUploadResult>(`/api/lesson-recordings/upload-session/${resume.uploadId}/complete`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkCount: receipts.length, totalBytes: file.size, integrityDigest, durationSeconds: options.durationSeconds }),
    }, signal);
    if (!result.lessonId || !result.recordingId) throw new Error("Recording save was not confirmed. Retry to check the existing upload.");
    resume.completed = result;
    saveResume(fingerprint, resume);
    return result;
  })();
  activeUploads.set(fingerprint, upload);
  try { return await upload; } finally { activeUploads.delete(fingerprint); }
}
