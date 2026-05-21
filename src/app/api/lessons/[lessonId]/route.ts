import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";
import { isUuid } from "@/lib/server/session-payload";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId } = await context.params;

  if (!isUuid(lessonId)) {
    return NextResponse.json({ error: "Lesson ID is invalid." }, { status: 400 });
  }

  const db = createDatabaseClient();
  const [recording] = await db
    .select({ id: lessonRecordings.id })
    .from(lessonRecordings)
    .where(eq(lessonRecordings.lessonId, lessonId))
    .limit(1);

  if (recording) {
    return NextResponse.json(
      { error: "Delete the lesson recordings before deleting the lesson." },
      { status: 409 },
    );
  }

  const [lesson] = await db
    .delete(lessons)
    .where(eq(lessons.id, lessonId))
    .returning({ id: lessons.id });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
