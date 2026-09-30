import type { LessonRecordingDraft } from "./lesson-recording-drafts";

/** Reassemble transport bytes, not separately decoded audio: MediaRecorder events
 * are fragments of one container and must retain their original order. */
export function recordingFileForDraft(
  chunks: Array<{ blob: Blob; index: number }>,
  draft: Pick<LessonRecordingDraft, "id" | "mimeType" | "startedAt"> &
    Partial<Pick<LessonRecordingDraft, "chunkCount" | "finalChunkCount">>,
) {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  if (
    ordered.length === 0 ||
    ordered.some((chunk, index) => chunk.index !== index || chunk.blob.size === 0) ||
    // Legacy progress counts can lag behind saved chunks. Only a final count
    // requires exact equality; a known higher progress count still means loss.
    (draft.chunkCount !== undefined && ordered.length < draft.chunkCount) ||
    (draft.finalChunkCount !== undefined && ordered.length !== draft.finalChunkCount)
  ) {
    throw new Error("This recording has missing or duplicate parts. Keep the recovery copy.");
  }
  const mimeType = draft.mimeType || ordered[0].blob.type || "audio/webm";
  const extension = mimeType.includes("mp4") ? "m4a"
    : mimeType.includes("aac") ? "aac"
    : mimeType.includes("ogg") ? "ogg" : "webm";
  const startedAt = Date.parse(draft.startedAt);
  return new File(ordered.map(({ blob }) => blob), `lesson-${draft.id}.${extension}`, {
    type: mimeType,
    // A stable identity lets an IndexedDB recovery reuse its upload session.
    lastModified: Number.isFinite(startedAt) ? startedAt : 0,
  });
}
