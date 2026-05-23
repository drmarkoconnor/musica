import { NextResponse } from "next/server";
import { createLessonRecordingUploadSession } from "@/lib/server/lesson-recording-upload-sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

type UploadSessionRequestBody = {
  contentType?: unknown;
  extension?: unknown;
  lessonDate?: unknown;
  lessonId?: unknown;
  recordedAt?: unknown;
  summary?: unknown;
  teacher?: unknown;
  title?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);
}

function parseRecordedAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function POST(request: Request) {
  let body: UploadSessionRequestBody;

  try {
    body = (await request.json()) as UploadSessionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawLessonId = text(body.lessonId);
  const teacher = text(body.teacher) || "Leo";
  const lessonDate = parseDate(text(body.lessonDate));
  const recordedAt = parseRecordedAt(text(body.recordedAt));
  const title = text(body.title) || `${teacher} lesson - ${lessonDate}`;
  const summary =
    text(body.summary) ||
    "Recorded live in Practice Loop. Ready for authorised transcription.";
  const contentType = text(body.contentType) || "audio/webm";
  const extension = text(body.extension) || "webm";

  try {
    const manifest = await createLessonRecordingUploadSession({
      contentType,
      extension,
      metadata: {
        lessonDate,
        lessonId: rawLessonId && isUuid(rawLessonId) ? rawLessonId : undefined,
        recordedAt,
        summary,
        teacher,
        title,
      },
    });

    return NextResponse.json({ uploadId: manifest.id }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Recording upload session could not be started. ${detail}` },
      { status: 502 },
    );
  }
}
