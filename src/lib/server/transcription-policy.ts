import { createHash } from "node:crypto";

export const MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS = 2 * 60 * 60;
export const MAX_TRANSCRIPTION_CHUNK_SECONDS = 3 * 60;
export type TranscriptionMode = "selected_segments" | "full_recording";
export type PlannedTranscriptionChunk = {
  endsAtSeconds: number; label: string; segmentId?: string; startsAtSeconds: number;
};

export class TranscriptionRequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message); this.name = "TranscriptionRequestError";
  }
}

export function resolveTranscriptionMode(includeFullRecording?: boolean): TranscriptionMode {
  return includeFullRecording !== false ? "full_recording" : "selected_segments";
}

export function validateDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new TranscriptionRequestError("The recording duration could not be read. Try exporting it as M4A or MP3.");
  }
  if (seconds > MAX_FULL_RECORDING_TRANSCRIPTION_SECONDS) {
    throw new TranscriptionRequestError("Recordings up to two hours are supported. Split longer recordings before uploading.");
  }
  return Math.ceil(seconds);
}

export function splitRangeIntoChunks({ endsAtSeconds, startsAtSeconds, label, segmentId }: PlannedTranscriptionChunk) {
  if (!Number.isInteger(startsAtSeconds) || !Number.isInteger(endsAtSeconds) || startsAtSeconds < 0 || endsAtSeconds <= startsAtSeconds) {
    throw new TranscriptionRequestError("A selected clip has invalid audio boundaries.");
  }
  const chunks: PlannedTranscriptionChunk[] = [];
  for (let start = startsAtSeconds; start < endsAtSeconds; start += MAX_TRANSCRIPTION_CHUNK_SECONDS) {
    chunks.push({ startsAtSeconds: start, endsAtSeconds: Math.min(start + MAX_TRANSCRIPTION_CHUNK_SECONDS, endsAtSeconds), label: `${label}, part ${chunks.length + 1}`, segmentId });
  }
  return chunks;
}

export function transcriptionRequestKey(input: {
  lessonId: string; recordingId: string; storageBucket: string; storagePath: string;
  mode: TranscriptionMode; model: string; chunks: PlannedTranscriptionChunk[];
}) {
  // A duration/count match alone cannot identify moved or renamed teaching clips.
  return createHash("sha256").update(JSON.stringify({
    version: "lesson-first-v1", ...input,
    chunks: input.mode === "full_recording" ? "entire-immutable-source" : input.chunks.map(({ segmentId, startsAtSeconds, endsAtSeconds, label }) => ({ segmentId: segmentId ?? null, startsAtSeconds, endsAtSeconds, label })),
  })).digest("hex");
}
