import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  deleteLessonAudio,
  saveLessonAudio,
} from "@/lib/server/lesson-audio-storage";
import { createLessonRecordingMetadata } from "@/lib/server/lesson-recording-metadata";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 250 * 1024 * 1024;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value
  );
}

function extensionForUpload(file: File) {
  const extensionFromName = path
    .extname(file.name)
    .toLowerCase()
    .replace(/^\./, "");
  const extensionFromType = new Map([
    ["audio/aac", "aac"],
    ["audio/m4a", "m4a"],
    ["audio/mp4", "m4a"],
    ["audio/mpeg", "mp3"],
    ["audio/ogg", "ogg"],
    ["audio/wave", "wav"],
    ["audio/wav", "wav"],
    ["audio/webm", "webm"],
    ["audio/x-m4a", "m4a"],
    ["audio/x-wav", "wav"],
    ["video/mp4", "m4a"],
    ["video/quicktime", "m4a"],
  ]).get(file.type.toLowerCase());
  const extension = extensionFromType ?? extensionFromName;

  if (
    ["aac", "m4a", "mp3", "mp4", "ogg", "wav", "webm"].includes(extension)
  ) {
    return extension;
  }

  return "webm";
}

function parseDurationSeconds(value: string) {
  const durationSeconds = Number(value);

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Math.min(Math.round(durationSeconds), 8 * 60 * 60);
}

function parseRecordedAt(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!isUploadedFile(audio)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (audio.size <= 0) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio file is too large for local upload." },
      { status: 413 },
    );
  }

  if (
    audio.type &&
    !audio.type.startsWith("audio/") &&
    audio.type !== "video/mp4" &&
    audio.type !== "video/quicktime"
  ) {
    return NextResponse.json(
      { error: "Uploaded file must be an audio recording." },
      { status: 400 },
    );
  }

  const now = new Date();
  const recordedAt = parseRecordedAt(formString(formData, "recordedAt")) ?? now.toISOString();
  const rawLessonId = formString(formData, "lessonId");
  const requestedLessonId = rawLessonId && isUuid(rawLessonId) ? rawLessonId : "";
  const lessonDate = formString(formData, "lessonDate") || todayDate();
  const teacher = formString(formData, "teacher") || "Leo";
  const title =
    formString(formData, "title") || `${teacher} lesson - ${lessonDate}`;
  const summary =
    formString(formData, "summary") ||
    "Recorded live in Practice Loop. Ready for authorised transcription.";
  const durationSeconds = parseDurationSeconds(
    formString(formData, "durationSeconds"),
  );
  const extension = extensionForUpload(audio);
  const fileName = `${recordedAt.replace(/[:.]/g, "-")}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await audio.arrayBuffer());
  let storedAudio: Awaited<ReturnType<typeof saveLessonAudio>>;

  try {
    storedAudio = await saveLessonAudio({
      buffer,
      contentType: audio.type || "application/octet-stream",
      fileName,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.name : "UnknownError";
    return NextResponse.json(
      {
        error: `Audio storage is not available for this deployment (${detail}).`,
      },
      { status: 502 },
    );
  }

  let lessonId = "";
  let recordingId = "";

  try {
    const metadataResult = await createLessonRecordingMetadata({
      metadata: {
        durationSeconds,
        lessonDate,
        lessonId: requestedLessonId || undefined,
        recordedAt,
        summary,
        teacher,
        title,
      },
      storedAudio,
    });

    lessonId = metadataResult.lessonId;
    recordingId = metadataResult.recordingId;
  } catch {
    await deleteLessonAudio({
      storageBucket: storedAudio.storageBucket,
      storagePath: storedAudio.storagePath,
    }).catch((error) => {
      console.error("Orphaned lesson audio cleanup failed", error);
    });

    return NextResponse.json(
      { error: "Recording metadata could not be saved." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      lessonId,
      recordingId,
      storagePath: storedAudio.storagePath,
    },
    { status: 201 },
  );
}
