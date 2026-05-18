import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessonSegments } from "@/db/schema";

type LessonSegmentRequestBody = {
  endsAtSeconds?: unknown;
  lessonId?: unknown;
  notes?: unknown;
  recordingId?: unknown;
  startsAtSeconds?: unknown;
  title?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function nonNegativeInteger(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

export async function POST(request: Request) {
  let body: LessonSegmentRequestBody;

  try {
    body = (await request.json()) as LessonSegmentRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const lessonId = optionalText(body.lessonId);
  const recordingId = optionalText(body.recordingId);
  const startsAtSeconds = nonNegativeInteger(body.startsAtSeconds);
  const endsAtSeconds = nonNegativeInteger(body.endsAtSeconds);

  if (!lessonId || !recordingId || !isUuid(lessonId) || !isUuid(recordingId)) {
    return NextResponse.json(
      { error: "Lesson and recording IDs are required." },
      { status: 400 },
    );
  }

  if (startsAtSeconds === null || endsAtSeconds === null) {
    return NextResponse.json(
      { error: "Segment times must be whole seconds." },
      { status: 400 },
    );
  }

  if (endsAtSeconds <= startsAtSeconds) {
    return NextResponse.json(
      { error: "Segment end must be after segment start." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [recording] = await db
    .select({
      durationSeconds: lessonRecordings.durationSeconds,
      id: lessonRecordings.id,
    })
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.id, recordingId),
        eq(lessonRecordings.lessonId, lessonId),
      ),
    );

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  if (recording.durationSeconds && endsAtSeconds > recording.durationSeconds) {
    return NextResponse.json(
      { error: "Segment end is outside the recording." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const [segment] = await db
    .insert(lessonSegments)
    .values({
      endsAtSeconds,
      lessonId,
      notes: optionalText(body.notes),
      recordingId,
      source: "post_lesson_review",
      startsAtSeconds,
      status: "selected",
      title: optionalText(body.title) ?? "Teaching segment",
      updatedAt: now,
    })
    .returning({ id: lessonSegments.id });

  return NextResponse.json({ id: segment.id }, { status: 201 });
}
