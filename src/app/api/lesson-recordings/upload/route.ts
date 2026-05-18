import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";
import {
  LOCAL_LESSON_AUDIO_BUCKET,
  LOCAL_LESSON_AUDIO_DIRECTORY,
  localLessonRecordingStoragePath,
} from "@/lib/server/test-audio-fixtures";

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
  const storagePath = localLessonRecordingStoragePath(fileName);
  const filePath = path.join(LOCAL_LESSON_AUDIO_DIRECTORY, fileName);
  const buffer = Buffer.from(await audio.arrayBuffer());

  await mkdir(LOCAL_LESSON_AUDIO_DIRECTORY, { recursive: true });
  await writeFile(filePath, buffer);

  const db = createDatabaseClient();
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
      storageBucket: LOCAL_LESSON_AUDIO_BUCKET,
      storagePath,
      durationSeconds,
      recordedAt,
      notes: "Recorded from the browser microphone.",
    })
    .returning({ id: lessonRecordings.id });

  return NextResponse.json(
    {
      lessonId: lesson.id,
      recordingId: recording.id,
      storagePath,
    },
    { status: 201 },
  );
}
