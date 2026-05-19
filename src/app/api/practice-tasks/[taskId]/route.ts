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
  status?: unknown;
};

const practiceStatuses = new Set<PracticeStatus>([
  "new",
  "active",
  "parked",
  "mastered",
]);

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
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

  const status = typeof body.status === "string" ? body.status : "";

  if (!practiceStatuses.has(status as PracticeStatus)) {
    return NextResponse.json({ error: "Status is invalid." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [task] = await db
    .update(practiceTasks)
    .set({
      status: status as PracticeStatus,
      updatedAt: new Date().toISOString(),
    })
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
    const task = await db.transaction(async (tx) => {
      await tx
        .delete(practiceTaskTags)
        .where(eq(practiceTaskTags.practiceTaskId, taskId));
      await tx
        .update(recordings)
        .set({ practiceTaskId: null })
        .where(eq(recordings.practiceTaskId, taskId));
      await tx
        .update(sessionItems)
        .set({ practiceTaskId: null })
        .where(eq(sessionItems.practiceTaskId, taskId));

      const [deletedTask] = await tx
        .delete(practiceTasks)
        .where(eq(practiceTasks.id, taskId))
        .returning({ id: practiceTasks.id });

      return deletedTask;
    });

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
