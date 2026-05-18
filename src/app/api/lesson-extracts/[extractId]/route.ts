import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  lessonExtracts,
  lessonRecordings,
  practiceTasks,
  transcripts,
} from "@/db/schema";

type ExtractActionRequestBody = {
  action?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function recordingIdForExtract({
  lessonId,
  transcriptId,
}: {
  lessonId: string;
  transcriptId: string | null;
}) {
  const db = createDatabaseClient();

  if (transcriptId) {
    const [transcript] = await db
      .select({ recordingId: transcripts.recordingId })
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId));

    if (transcript) {
      return transcript.recordingId;
    }
  }

  const [recording] = await db
    .select({ id: lessonRecordings.id })
    .from(lessonRecordings)
    .where(eq(lessonRecordings.lessonId, lessonId))
    .orderBy(desc(lessonRecordings.recordedAt))
    .limit(1);

  return recording?.id ?? null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ extractId: string }> },
) {
  const { extractId } = await context.params;

  if (!isUuid(extractId)) {
    return NextResponse.json({ error: "Extract ID is invalid." }, { status: 400 });
  }

  let body: ExtractActionRequestBody;

  try {
    body = (await request.json()) as ExtractActionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = body.action === "keep" || body.action === "discard"
    ? body.action
    : null;

  if (!action) {
    return NextResponse.json({ error: "Unknown extract action." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [extract] = await db
    .select()
    .from(lessonExtracts)
    .where(eq(lessonExtracts.id, extractId));

  if (!extract) {
    return NextResponse.json({ error: "Extract not found." }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();

  if (action === "discard") {
    await db
      .update(lessonExtracts)
      .set({ status: "discarded", updatedAt })
      .where(eq(lessonExtracts.id, extractId));

    return NextResponse.json({ ok: true, status: "discarded" });
  }

  const [existingTask] = await db
    .select({ id: practiceTasks.id })
    .from(practiceTasks)
    .where(eq(practiceTasks.sourceExtractId, extractId));

  const recordingId = await recordingIdForExtract({
    lessonId: extract.lessonId,
    transcriptId: extract.transcriptId,
  });

  const taskId =
    existingTask?.id ??
    (
      await db
        .insert(practiceTasks)
        .values({
          body: extract.body,
          endsAtSeconds: extract.endsAtSeconds,
          importance: 3,
          linkedExerciseId: extract.linkedExerciseId,
          linkedPieceId: extract.linkedPieceId,
          linkedRecordingId: recordingId,
          source: "lesson",
          sourceExtractId: extract.id,
          sourceLessonId: extract.lessonId,
          startsAtSeconds: extract.startsAtSeconds,
          status: "new",
          title: extract.title,
          resurfacingScore: "50",
          updatedAt,
        })
        .returning({ id: practiceTasks.id })
    )[0].id;

  await db
    .update(lessonExtracts)
    .set({ status: "kept", updatedAt })
    .where(eq(lessonExtracts.id, extractId));

  return NextResponse.json({ ok: true, status: "kept", taskId });
}
