import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";
import {
  getTestAudioFixture,
  testAudioFixturesEnabled,
} from "@/lib/server/test-audio-fixtures";

type LessonRecordingRequestBody = {
  lessonId?: unknown;
  fixtureId?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: Request) {
  if (!testAudioFixturesEnabled()) {
    return NextResponse.json(
      { error: "Test audio fixtures are disabled." },
      { status: 404 },
    );
  }

  let body: LessonRecordingRequestBody;

  try {
    body = (await request.json()) as LessonRecordingRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.lessonId !== "string" || typeof body.fixtureId !== "string") {
    return NextResponse.json(
      { error: "Lesson ID and fixture ID are required." },
      { status: 400 },
    );
  }

  if (!isUuid(body.lessonId)) {
    return NextResponse.json({ error: "Lesson ID is invalid." }, { status: 400 });
  }

  const fixture = getTestAudioFixture(body.fixtureId);
  if (!fixture) {
    return NextResponse.json({ error: "Unknown audio fixture." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [lesson] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.id, body.lessonId));

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const [existingRecording] = await db
    .select({ id: lessonRecordings.id })
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.lessonId, body.lessonId),
        eq(lessonRecordings.storageBucket, fixture.storageBucket),
        eq(lessonRecordings.storagePath, fixture.storagePath),
      ),
    );

  if (existingRecording) {
    return NextResponse.json({ id: existingRecording.id, reused: true });
  }

  const [recording] = await db
    .insert(lessonRecordings)
    .values({
      lessonId: body.lessonId,
      title: fixture.title,
      storageBucket: fixture.storageBucket,
      storagePath: fixture.storagePath,
      durationSeconds: fixture.durationSeconds,
      recordedAt: fixture.recordedAt,
      notes: "Local test fixture for transcription and teaching review.",
    })
    .returning({ id: lessonRecordings.id });

  await db
    .update(lessons)
    .set({ status: "recorded", updatedAt: new Date().toISOString() })
    .where(eq(lessons.id, body.lessonId));

  return NextResponse.json({ id: recording.id }, { status: 201 });
}
