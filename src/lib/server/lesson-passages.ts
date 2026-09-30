import { and, asc, desc, eq } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { transcriptionJobChunks, transcriptionJobs } from "@/db/schema";
import { evidenceFromChunks } from "@/lib/server/transcript-passages";

export async function loadLessonPassages(lessonId: string, recordingId: string) {
  const db = createDatabaseClient();
  const [job] = await db.select().from(transcriptionJobs).where(and(eq(transcriptionJobs.lessonId, lessonId), eq(transcriptionJobs.recordingId, recordingId))).orderBy(desc(transcriptionJobs.requestedAt)).limit(1);
  if (!job) return { jobId: null, complete: false, passages: [] };
  const chunks = await db.select().from(transcriptionJobChunks).where(eq(transcriptionJobChunks.jobId, job.id)).orderBy(asc(transcriptionJobChunks.position));
  return { jobId: job.id, complete: job.totalChunks > 0 && chunks.length === job.totalChunks && chunks.every((chunk) => chunk.status === "complete"), passages: evidenceFromChunks(chunks, job.mode) };
}
