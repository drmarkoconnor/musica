import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessons } from "@/db/schema";
import {
  parseLessonPayload,
  type LessonRequestBody,
} from "@/lib/server/lesson-payload";

export async function POST(request: Request) {
  let body: LessonRequestBody;

  try {
    body = (await request.json()) as LessonRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = parseLessonPayload(body);
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [lesson] = await db
    .insert(lessons)
    .values(payload.value)
    .returning({ id: lessons.id });

  return NextResponse.json({ id: lesson.id }, { status: 201 });
}
