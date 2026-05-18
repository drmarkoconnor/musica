import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  lessonExtracts,
  lessonRecordings,
  lessons,
  transcripts,
} from "@/db/schema";

type LessonExtractRequestBody = {
  body?: unknown;
  endsAtSeconds?: unknown;
  lessonId?: unknown;
  recordingId?: unknown;
  startsAtSeconds?: unknown;
  title?: unknown;
  transcriptId?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function nonNegativeInteger(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

export async function POST(request: Request) {
  let body: LessonExtractRequestBody;

  try {
    body = (await request.json()) as LessonExtractRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const lessonId = text(body.lessonId);
  const recordingId = text(body.recordingId);
  const transcriptId = text(body.transcriptId);
  const title = text(body.title);
  const extractBody = text(body.body);
  const startsAtSeconds = nonNegativeInteger(body.startsAtSeconds);
  const endsAtSeconds = nonNegativeInteger(body.endsAtSeconds);

  if (!lessonId || !recordingId || !isUuid(lessonId) || !isUuid(recordingId)) {
    return NextResponse.json(
      { error: "Lesson and recording IDs are required." },
      { status: 400 },
    );
  }

  if (transcriptId && !isUuid(transcriptId)) {
    return NextResponse.json(
      { error: "Transcript ID is invalid." },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (startsAtSeconds === null || endsAtSeconds === null) {
    return NextResponse.json(
      { error: "Clip timestamps must be whole seconds." },
      { status: 400 },
    );
  }

  if (endsAtSeconds <= startsAtSeconds) {
    return NextResponse.json(
      { error: "Clip end must be after clip start." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.id, lessonId));

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const [recording] = await db
    .select({ id: lessonRecordings.id })
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

  if (transcriptId) {
    const [transcript] = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(
        and(
          eq(transcripts.id, transcriptId),
          eq(transcripts.lessonId, lessonId),
          eq(transcripts.recordingId, recordingId),
        ),
      );

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found." },
        { status: 404 },
      );
    }
  }

  const now = new Date().toISOString();
  const [extract] = await db
    .insert(lessonExtracts)
    .values({
      body: extractBody || null,
      endsAtSeconds,
      lessonId,
      startsAtSeconds,
      status: "candidate",
      title,
      transcriptId: transcriptId || null,
      updatedAt: now,
    })
    .returning({ id: lessonExtracts.id });

  return NextResponse.json({ id: extract.id }, { status: 201 });
}
