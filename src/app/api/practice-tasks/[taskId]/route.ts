import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  practiceTaskTags,
  practiceTasks,
  recordings,
  sessionItems,
} from "@/db/schema";
import type { PracticeStatus } from "@/lib/types";

type PracticeTaskUpdateBody = {
  body?: unknown;
  confidence?: unknown;
  importance?: unknown;
  lastPractised?: unknown;
  linkedExerciseId?: unknown;
  linkedPieceId?: unknown;
  status?: unknown;
  targetFrequencyDays?: unknown;
  title?: unknown;
};

const practiceStatuses = new Set<PracticeStatus>([
  "new",
  "active",
  "parked",
  "mastered",
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function optionalIntInRange(value: unknown, min: number, max: number) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    return undefined;
  }

  return numberValue;
}

function optionalDate(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return value;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function optionalUuid(value: unknown) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  return typeof value === "string" && isUuid(value) ? value : undefined;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  if (!isUuid(taskId)) {
    return NextResponse.json({ error: "Task ID is invalid." }, { status: 400 });
  }

  let body: PracticeTaskUpdateBody;

  try {
    body = (await request.json()) as PracticeTaskUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Partial<typeof practiceTasks.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  const status = typeof body.status === "string" ? body.status : null;
  const confidence = optionalIntInRange(body.confidence, 1, 5);
  const importance = optionalIntInRange(body.importance, 1, 5);
  const targetFrequencyDays = optionalIntInRange(body.targetFrequencyDays, 1, 365);
  const lastPractised = optionalDate(body.lastPractised);

  if (status !== null && !practiceStatuses.has(status as PracticeStatus)) {
    return NextResponse.json({ error: "Status is invalid." }, { status: 400 });
  }

  if (typeof confidence === "undefined") {
    return NextResponse.json(
      { error: "Confidence must be between 1 and 5." },
      { status: 400 },
    );
  }

  if (typeof targetFrequencyDays === "undefined") {
    return NextResponse.json(
      { error: "Frequency must be between 1 and 365 days." },
      { status: 400 },
    );
  }

  if (typeof importance === "undefined") {
    return NextResponse.json(
      { error: "Importance must be between 1 and 5." },
      { status: 400 },
    );
  }

  if (typeof lastPractised === "undefined") {
    return NextResponse.json(
      { error: "Last practised date is invalid." },
      { status: 400 },
    );
  }

  if (status !== null) {
    updates.status = status as PracticeStatus;
  }

  if ("title" in body) {
    const title = optionalText(body.title);

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    updates.title = title;
  }

  if ("body" in body) {
    updates.body = optionalText(body.body);
  }

  if ("linkedPieceId" in body) {
    const linkedPieceId = optionalUuid(body.linkedPieceId);

    if (typeof linkedPieceId === "undefined") {
      return NextResponse.json(
        { error: "Linked piece ID must be a UUID." },
        { status: 400 },
      );
    }

    updates.linkedPieceId = linkedPieceId;
  }

  if ("linkedExerciseId" in body) {
    const linkedExerciseId = optionalUuid(body.linkedExerciseId);

    if (typeof linkedExerciseId === "undefined") {
      return NextResponse.json(
        { error: "Linked exercise ID must be a UUID." },
        { status: 400 },
      );
    }

    updates.linkedExerciseId = linkedExerciseId;
  }

  if (confidence !== null) {
    updates.confidence = confidence;
  }

  if (importance !== null) {
    updates.importance = importance;
  }

  if (targetFrequencyDays !== null) {
    updates.targetFrequencyDays = targetFrequencyDays;
  }

  if (lastPractised !== null || "lastPractised" in body) {
    updates.lastPractisedOn = lastPractised;
  }

  const db = createDatabaseClient();
  const [task] = await db
    .update(practiceTasks)
    .set(updates)
    .where(eq(practiceTasks.id, taskId))
    .returning({ id: practiceTasks.id });

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;

  if (!isUuid(taskId)) {
    return NextResponse.json({ error: "Task ID is invalid." }, { status: 400 });
  }

  const db = createDatabaseClient();
  try {
    await db
      .delete(practiceTaskTags)
      .where(eq(practiceTaskTags.practiceTaskId, taskId));
    await db
      .update(recordings)
      .set({ practiceTaskId: null })
      .where(eq(recordings.practiceTaskId, taskId));
    await db
      .update(sessionItems)
      .set({ practiceTaskId: null })
      .where(eq(sessionItems.practiceTaskId, taskId));

    const [task] = await db
      .delete(practiceTasks)
      .where(eq(practiceTasks.id, taskId))
      .returning({ id: practiceTasks.id });

    if (!task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Practice task delete failed", error);
    return NextResponse.json(
      { error: "Task could not be deleted." },
      { status: 500 },
    );
  }
}
