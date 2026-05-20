import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  exerciseLogs,
  exercises,
  pieces,
  practiceTasks,
  sessionItems,
} from "@/db/schema";
import {
  intInRange,
  isUuid,
  optionalText,
  sessionItemStatuses,
  type SessionItemUpdateBody,
} from "@/lib/server/session-payload";
import type { SessionItemStatus } from "@/lib/types";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params;

  if (!isUuid(itemId)) {
    return NextResponse.json({ error: "Session item ID is invalid." }, { status: 400 });
  }

  let body: SessionItemUpdateBody;

  try {
    body = (await request.json()) as SessionItemUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status : null;
  const actualSeconds = intInRange(body.actualSeconds, null, 0, 24 * 60 * 60);
  const confidenceAfter = intInRange(body.confidenceAfter, null, 1, 5);

  if (status !== null && !sessionItemStatuses.has(status as SessionItemStatus)) {
    return NextResponse.json({ error: "Status is invalid." }, { status: 400 });
  }

  if (typeof actualSeconds === "undefined") {
    return NextResponse.json(
      { error: "Actual seconds must be a positive whole number." },
      { status: 400 },
    );
  }

  if (typeof confidenceAfter === "undefined") {
    return NextResponse.json(
      { error: "Confidence must be between 1 and 5." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [existingItem] = await db
    .select()
    .from(sessionItems)
    .where(eq(sessionItems.id, itemId))
    .limit(1);

  if (!existingItem) {
    return NextResponse.json({ error: "Session item not found." }, { status: 404 });
  }

  try {
    await db
      .update(sessionItems)
      .set({
        actualSeconds: actualSeconds ?? existingItem.actualSeconds,
        confidenceAfter: confidenceAfter ?? existingItem.confidenceAfter,
        notes: optionalText(body.notes),
        status: (status ?? existingItem.status) as SessionItemStatus,
      })
      .where(eq(sessionItems.id, itemId));

    if (status !== "done") {
      return NextResponse.json({ ok: true });
    }

    const practisedOn = todayIsoDate();
    const updatedAt = new Date().toISOString();

    if (existingItem.practiceTaskId) {
      await db
        .update(practiceTasks)
        .set({
          ...(confidenceAfter !== null ? { confidence: confidenceAfter } : {}),
          lastPractisedOn: practisedOn,
          status: "active",
          updatedAt,
        })
        .where(eq(practiceTasks.id, existingItem.practiceTaskId));
    }

    if (existingItem.pieceId) {
      await db
        .update(pieces)
        .set({
          ...(confidenceAfter !== null ? { confidence: confidenceAfter } : {}),
          lastPractisedOn: practisedOn,
          updatedAt,
        })
        .where(eq(pieces.id, existingItem.pieceId));
    }

    if (existingItem.exerciseId) {
      await db
        .update(exercises)
        .set({
          ...(confidenceAfter !== null ? { confidence: confidenceAfter } : {}),
          lastPractisedOn: practisedOn,
          updatedAt,
        })
        .where(eq(exercises.id, existingItem.exerciseId));

      await db.insert(exerciseLogs).values({
        confidence: confidenceAfter ?? existingItem.confidenceBefore ?? 3,
        exerciseId: existingItem.exerciseId,
        notes: optionalText(body.notes),
        practiceSessionId: existingItem.practiceSessionId,
        tempo: existingItem.tempo,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Session item update failed", error);
    return NextResponse.json(
      { error: "Session item could not be saved." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params;

  if (!isUuid(itemId)) {
    return NextResponse.json({ error: "Session item ID is invalid." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [item] = await db
    .delete(sessionItems)
    .where(eq(sessionItems.id, itemId))
    .returning({ id: sessionItems.id });

  if (!item) {
    return NextResponse.json({ error: "Session item not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
