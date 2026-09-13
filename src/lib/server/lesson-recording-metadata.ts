import { eq } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons } from "@/db/schema";

export type LessonRecordingMetadataInput = {
  durationSeconds: number | null; lessonDate: string; lessonId?: string;
  recordedAt: string; summary: string; teacher: string; title: string;
};
export type StoredLessonAudioReference = { storageBucket: string; storagePath: string };

export async function createLessonRecordingMetadata({ metadata, storedAudio, ids }: {
  metadata: LessonRecordingMetadataInput; storedAudio: StoredLessonAudioReference;
  ids?: { lessonId: string; recordingId: string };
}) {
  const db = createDatabaseClient();
  if (ids) {
    const [existing] = await db.select().from(lessonRecordings).where(eq(lessonRecordings.id, ids.recordingId));
    if (existing) {
      if (existing.storageBucket !== storedAudio.storageBucket || existing.storagePath !== storedAudio.storagePath) throw new Error("Recording ID belongs to different audio.");
      return { lessonId: existing.lessonId, recordingId: existing.id };
    }
  }
  let lessonId = "";
  if (metadata.lessonId) {
    const [existingLesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, metadata.lessonId));
    if (existingLesson) {
      lessonId = existingLesson.id;
      await db.update(lessons).set({ status: "recorded", updatedAt: metadata.recordedAt }).where(eq(lessons.id, lessonId));
    }
  }
  if (!lessonId) {
    const [lesson] = await db.insert(lessons).values({
      ...(ids ? { id: ids.lessonId } : {}), lessonDate: metadata.lessonDate,
      status: "recorded", summary: metadata.summary, teacher: metadata.teacher,
      title: metadata.title, updatedAt: metadata.recordedAt,
    }).onConflictDoNothing().returning({ id: lessons.id });
    lessonId = lesson?.id ?? ids?.lessonId ?? "";
    if (!lessonId) throw new Error("Lesson could not be saved.");
  }
  const [recording] = await db.insert(lessonRecordings).values({
    ...(ids ? { id: ids.recordingId } : {}), durationSeconds: metadata.durationSeconds,
    lessonId, notes: metadata.summary, recordedAt: metadata.recordedAt,
    storageBucket: storedAudio.storageBucket, storagePath: storedAudio.storagePath,
    title: metadata.title || "Lesson recording",
  }).onConflictDoNothing().returning({ id: lessonRecordings.id, lessonId: lessonRecordings.lessonId });
  if (recording) return { lessonId: recording.lessonId, recordingId: recording.id };
  if (!ids) throw new Error("Recording could not be saved.");
  const [existing] = await db.select().from(lessonRecordings).where(eq(lessonRecordings.id, ids.recordingId));
  if (!existing || existing.storageBucket !== storedAudio.storageBucket || existing.storagePath !== storedAudio.storagePath) throw new Error("Recording could not be confirmed.");
  return { lessonId: existing.lessonId, recordingId: existing.id };
}
