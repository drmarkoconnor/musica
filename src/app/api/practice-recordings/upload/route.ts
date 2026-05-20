import { randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { recordings, sessionItems } from "@/db/schema";
import { isUuid, optionalText } from "@/lib/server/session-payload";
import { savePracticeAudio } from "@/lib/server/practice-audio-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

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

  return Math.min(Math.round(durationSeconds), 4 * 60 * 60);
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
      { error: "Audio file is too large for upload." },
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

  const practiceSessionId = formString(formData, "practiceSessionId");
  const sessionItemId = formString(formData, "sessionItemId");

  if (!isUuid(practiceSessionId) || !isUuid(sessionItemId)) {
    return NextResponse.json(
      { error: "Session and item IDs are required." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [item] = await db
    .select()
    .from(sessionItems)
    .where(
      and(
        eq(sessionItems.id, sessionItemId),
        eq(sessionItems.practiceSessionId, practiceSessionId),
      ),
    )
    .limit(1);

  if (!item) {
    return NextResponse.json(
      { error: "Session item was not found." },
      { status: 404 },
    );
  }

  const now = new Date();
  const recordedAt = now.toISOString();
  const durationSeconds = parseDurationSeconds(
    formString(formData, "durationSeconds"),
  );
  const title =
    optionalText(formString(formData, "title")) ??
    `${item.title} practice recording`;
  const extension = extensionForUpload(audio);
  const fileName = `${recordedAt.replace(/[:.]/g, "-")}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await audio.arrayBuffer());
  let storedAudio: Awaited<ReturnType<typeof savePracticeAudio>>;

  try {
    storedAudio = await savePracticeAudio({
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

  try {
    const [recording] = await db
      .insert(recordings)
      .values({
        kind: "practice",
        title,
        storageBucket: storedAudio.storageBucket,
        storagePath: storedAudio.storagePath,
        durationSeconds,
        recordedAt,
        practiceSessionId,
        sessionItemId,
        practiceTaskId: item.practiceTaskId,
        pieceId: item.pieceId,
        exerciseId: item.exerciseId,
        spokenNote: optionalText(formString(formData, "spokenNote")),
      })
      .returning({
        id: recordings.id,
        storageBucket: recordings.storageBucket,
        storagePath: recordings.storagePath,
      });

    return NextResponse.json(
      {
        id: recording.id,
        storageBucket: recording.storageBucket,
        storagePath: recording.storagePath,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Practice recording metadata save failed", error);
    return NextResponse.json(
      { error: "Recording metadata could not be saved." },
      { status: 502 },
    );
  }
}
