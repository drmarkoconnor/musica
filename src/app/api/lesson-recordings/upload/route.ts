import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";
import { saveLessonAudio } from "@/lib/server/lesson-audio-storage";

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
    ["audio/mp4", "m4a"],
    ["audio/mpeg", "mp3"],
    ["audio/ogg", "ogg"],
    ["audio/wav", "wav"],
    ["audio/webm", "webm"],
    ["video/mp4", "m4a"],
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
    audio.type !== "video/mp4"
  ) {
    return NextResponse.json(
      { error: "Uploaded file must be an audio recording." },
      { status: 400 },
    );
  }

  const now = new Date();
  const recordedAt = now.toISOString();
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

  const db = createDatabaseClient();
  let lessonId: string;
  let recordingId: string;

  try {
    const [lesson] = await db
      .insert(lessons)
      .values({
        title,
        teacher,
        lessonDate,
        status: "recorded",
        summary,
        updatedAt: recordedAt,
      })
      .returning({ id: lessons.id });

    const [recording] = await db
      .insert(lessonRecordings)
      .values({
        lessonId: lesson.id,
        title: "Live lesson recording",
        storageBucket: storedAudio.storageBucket,
        storagePath: storedAudio.storagePath,
        durationSeconds,
        recordedAt,
        notes: "Recorded from the browser microphone.",
      })
      .returning({ id: lessonRecordings.id });

    lessonId = lesson.id;
    recordingId = recording.id;
  } catch {
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
