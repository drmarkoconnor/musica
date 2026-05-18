import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessonSegments } from "@/db/schema";

type LessonSegmentUpdateBody = {
  action?: unknown;
  endsAtSeconds?: unknown;
  notes?: unknown;
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await context.params;

  if (!isUuid(segmentId)) {
    return NextResponse.json({ error: "Segment ID is invalid." }, { status: 400 });
  }

  let body: LessonSegmentUpdateBody;

  try {
    body = (await request.json()) as LessonSegmentUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [segment] = await db
    .select()
    .from(lessonSegments)
    .where(eq(lessonSegments.id, segmentId));

  if (!segment) {
    return NextResponse.json({ error: "Segment not found." }, { status: 404 });
  }

  const [recording] = await db
    .select({ durationSeconds: lessonRecordings.durationSeconds })
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.id, segment.recordingId),
        eq(lessonRecordings.lessonId, segment.lessonId),
      ),
    );

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const action =
    body.action === "discard" || body.action === "select" ? body.action : null;
  const startsAtSeconds =
    typeof body.startsAtSeconds === "undefined"
      ? segment.startsAtSeconds
      : nonNegativeInteger(body.startsAtSeconds);
  const endsAtSeconds =
    typeof body.endsAtSeconds === "undefined"
      ? segment.endsAtSeconds
      : nonNegativeInteger(body.endsAtSeconds);

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

  if (recording.durationSeconds && endsAtSeconds > recording.durationSeconds) {
    return NextResponse.json(
      { error: "Segment end is outside the recording." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  await db
    .update(lessonSegments)
    .set({
      endsAtSeconds,
      notes:
        typeof body.notes === "undefined" ? segment.notes : optionalText(body.notes),
      startsAtSeconds,
      status: action === "discard" ? "discarded" : "selected",
      title: optionalText(body.title) ?? segment.title,
      updatedAt: now,
    })
    .where(eq(lessonSegments.id, segmentId));

  return NextResponse.json({ ok: true });
}
