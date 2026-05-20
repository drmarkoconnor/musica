import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { recordings } from "@/db/schema";
import {
  deletePracticeAudio,
} from "@/lib/server/practice-audio-storage";
import { isUuid, optionalText, optionalUuid } from "@/lib/server/session-payload";

type PracticeRecordingUpdateBody = {
  pieceId?: unknown;
  title?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await context.params;

  if (!isUuid(recordingId)) {
    return NextResponse.json(
      { error: "Recording ID is invalid." },
      { status: 400 },
    );
  }

  let body: PracticeRecordingUpdateBody;

  try {
    body = (await request.json()) as PracticeRecordingUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Partial<typeof recordings.$inferInsert> = {};

  if ("title" in body) {
    const title = optionalText(body.title);

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    updates.title = title;
  }

  if ("pieceId" in body) {
    const pieceId = optionalUuid(body.pieceId);

    if (typeof pieceId === "undefined") {
      return NextResponse.json(
        { error: "Piece ID is invalid." },
        { status: 400 },
      );
    }

    updates.pieceId = pieceId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = createDatabaseClient();
    const [recording] = await db
      .update(recordings)
      .set(updates)
      .where(eq(recordings.id, recordingId))
      .returning({ id: recordings.id });

    if (!recording) {
      return NextResponse.json(
        { error: "Recording not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Practice recording update failed", error);
    return NextResponse.json(
      { error: "Recording could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await context.params;

  if (!isUuid(recordingId)) {
    return NextResponse.json(
      { error: "Recording ID is invalid." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [recording] = await db
    .select({
      id: recordings.id,
      storageBucket: recordings.storageBucket,
      storagePath: recordings.storagePath,
    })
    .from(recordings)
    .where(eq(recordings.id, recordingId))
    .limit(1);

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  await db.delete(recordings).where(eq(recordings.id, recordingId));

  try {
    await deletePracticeAudio({
      storageBucket: recording.storageBucket,
      storagePath: recording.storagePath,
    });
  } catch (error) {
    console.error("Practice recording audio delete failed", error);
  }

  return NextResponse.json({ ok: true });
}
