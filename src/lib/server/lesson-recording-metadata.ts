import { eq } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";

export type LessonRecordingMetadataInput = {
  durationSeconds: number | null;
  lessonDate: string;
  lessonId?: string;
  recordedAt: string;
  summary: string;
  teacher: string;
  title: string;
};

export type StoredLessonAudioReference = {
  storageBucket: string;
  storagePath: string;
};

export async function createLessonRecordingMetadata({
  metadata,
  storedAudio,
}: {
  metadata: LessonRecordingMetadataInput;
  storedAudio: StoredLessonAudioReference;
}) {
  const db = createDatabaseClient();
  let lessonId = "";

  if (metadata.lessonId) {
    const [existingLesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.id, metadata.lessonId));

    if (existingLesson) {
      lessonId = existingLesson.id;
      await db
        .update(lessons)
        .set({ status: "recorded", updatedAt: metadata.recordedAt })
        .where(eq(lessons.id, lessonId));
    }
  }

  if (!lessonId) {
    const [lesson] = await db
      .insert(lessons)
      .values({
        lessonDate: metadata.lessonDate,
        status: "recorded",
        summary: metadata.summary,
        teacher: metadata.teacher,
        title: metadata.title,
        updatedAt: metadata.recordedAt,
      })
      .returning({ id: lessons.id });
    lessonId = lesson.id;
  }

  const [recording] = await db
    .insert(lessonRecordings)
    .values({
      durationSeconds: metadata.durationSeconds,
      lessonId,
      notes: "Recorded from the browser microphone.",
      recordedAt: metadata.recordedAt,
      storageBucket: storedAudio.storageBucket,
      storagePath: storedAudio.storagePath,
      title: "Live lesson recording",
    })
    .returning({ id: lessonRecordings.id });

  return {
    lessonId,
    recordingId: recording.id,
  };
}
