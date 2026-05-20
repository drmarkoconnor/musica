import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings } from "@/db/schema";
import { deleteLessonAudio } from "@/lib/server/lesson-audio-storage";
import { isUuid } from "@/lib/server/session-payload";

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
      id: lessonRecordings.id,
      storageBucket: lessonRecordings.storageBucket,
      storagePath: lessonRecordings.storagePath,
    })
    .from(lessonRecordings)
    .where(eq(lessonRecordings.id, recordingId))
    .limit(1);

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  await db.delete(lessonRecordings).where(eq(lessonRecordings.id, recordingId));

  try {
    await deleteLessonAudio({
      storageBucket: recording.storageBucket,
      storagePath: recording.storagePath,
    });
  } catch (error) {
    console.error("Lesson recording audio delete failed", error);
  }

  return NextResponse.json({ ok: true });
}
