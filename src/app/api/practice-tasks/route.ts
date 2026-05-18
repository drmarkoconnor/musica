import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { practiceTasks } from "@/db/schema";
import {
  parsePracticeTaskPayload,
  type PracticeTaskRequestBody,
} from "@/lib/server/practice-task-payload";

export async function POST(request: Request) {
  let body: PracticeTaskRequestBody;

  try {
    body = (await request.json()) as PracticeTaskRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = parsePracticeTaskPayload(body);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [task] = await db
    .insert(practiceTasks)
    .values(payload.value)
    .returning({ id: practiceTasks.id });

  return NextResponse.json({ id: task.id }, { status: 201 });
}
