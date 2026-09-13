import "server-only";

import { eq, sql } from "drizzle-orm";
import { createDatabaseClient, type PracticeLoopDatabase } from "@/db/client";
import { learningPoints, type LearningPointRow } from "@/db/schema";
import type { ExtractStatus, LearningPoint } from "@/lib/types";

export function mapLearningPoint(row: LearningPointRow): LearningPoint {
  return {
    id: row.id,
    lessonId: row.lessonId,
    recordingId: row.recordingId,
    analysisRunId: row.analysisRunId ?? undefined,
    sourceKey: row.sourceKey,
    title: row.title,
    body: row.body,
    kind: row.kind as LearningPoint["kind"],
    practiceAction: row.practiceAction ?? undefined,
    startsAtSeconds: row.startsAtSeconds,
    endsAtSeconds: row.endsAtSeconds,
    evidencePrecision: row.evidencePrecision as LearningPoint["evidencePrecision"],
    evidenceText: row.evidenceText ?? undefined,
    status: row.status,
    practiceTaskId: row.practiceTaskId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function isLearningPointId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export class LearningPointError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "LearningPointError";
  }
}

function requestObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LearningPointError("The request must be a JSON object.", 400);
  }

  return value as Record<string, unknown>;
}

function boundedText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new LearningPointError(`${name} is required.`, 400);
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw new LearningPointError(`${name} must be ${maxLength} characters or fewer.`, 400);
  }

  return text;
}

export type LearningPointUpdate = {
  title?: string;
  body?: string;
  practiceAction?: string | null;
  status?: ExtractStatus;
};

export function parseLearningPointUpdate(value: unknown): LearningPointUpdate {
  const body = requestObject(value);
  const permittedKeys = new Set(["title", "body", "practiceAction", "status"]);
  const keys = Object.keys(body);

  if (keys.length === 0 || keys.some((key) => !permittedKeys.has(key))) {
    throw new LearningPointError("Supply a title, explanation, practice action or status to update.", 400);
  }

  const updates: LearningPointUpdate = {};
  if ("title" in body) updates.title = boundedText(body.title, "Title", 240);
  if ("body" in body) updates.body = boundedText(body.body, "Explanation", 12000);
  if ("practiceAction" in body) {
    updates.practiceAction = body.practiceAction === null || body.practiceAction === ""
      ? null
      : boundedText(body.practiceAction, "Practice action", 6000);
  }
  if ("status" in body) {
    if (body.status !== "candidate" && body.status !== "kept" && body.status !== "discarded") {
      throw new LearningPointError("Status must be candidate, kept or discarded.", 400);
    }
    updates.status = body.status;
  }

  return updates;
}

export function parseLearningPointPractice(value: unknown): { practiceAction?: string } {
  const body = requestObject(value);
  if (Object.keys(body).some((key) => key !== "practiceAction")) {
    throw new LearningPointError("Only a practice action can be supplied.", 400);
  }

  return "practiceAction" in body
    ? { practiceAction: boundedText(body.practiceAction, "Practice action", 6000) }
    : {};
}

export async function updateLearningPoint(
  id: string,
  updates: LearningPointUpdate,
  db: PracticeLoopDatabase = createDatabaseClient(),
): Promise<LearningPoint> {
  const [point] = await db
    .update(learningPoints)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(learningPoints.id, id))
    .returning();

  if (!point) throw new LearningPointError("Learning point not found.", 404);
  return mapLearningPoint(point);
}

export async function createPracticeFromLearningPoint(
  id: string,
  input: { practiceAction?: string },
  db: PracticeLoopDatabase = createDatabaseClient(),
): Promise<{ practiceTaskId: string }> {
  // Neon HTTP cannot hold an interactive transaction. A single statement locks
  // this point, creates its task and links it atomically. Concurrent clicks and
  // retries reuse the linked task; a task is never created by simply keeping a
  // teaching point. Its original teaching text and evidence are left intact.
  const result = await db.execute<{ practiceTaskId: string | null }>(sql`
    with source_point as materialized (
      select id, lesson_id, recording_id, title, practice_task_id,
             starts_at_seconds, ends_at_seconds,
             coalesce(${input.practiceAction ?? null}::text, practice_action) as chosen_action
      from learning_points
      where id = ${id}::uuid
      for update
    ), inserted_task as (
      insert into practice_tasks (
        title, body, source, source_lesson_id, linked_recording_id,
        starts_at_seconds, ends_at_seconds, status, importance, resurfacing_score
      )
      select title, chosen_action, 'lesson', lesson_id, recording_id,
             starts_at_seconds, ends_at_seconds, 'new', 3, 50
      from source_point
      where practice_task_id is null and nullif(btrim(chosen_action), '') is not null
      returning id
    ), linked_point as (
      update learning_points as point
      set practice_task_id = inserted_task.id,
          practice_action = source_point.chosen_action,
          status = 'kept', updated_at = now()
      from inserted_task, source_point
      where point.id = source_point.id
      returning point.practice_task_id
    )
    select coalesce(
      (select practice_task_id from linked_point),
      source_point.practice_task_id
    ) as "practiceTaskId"
    from source_point
  `);

  const point = result.rows[0];
  if (!point) throw new LearningPointError("Learning point not found.", 404);
  if (!point.practiceTaskId) {
    throw new LearningPointError("Add a practice action before creating a practice item.", 422);
  }
  return { practiceTaskId: point.practiceTaskId };
}
