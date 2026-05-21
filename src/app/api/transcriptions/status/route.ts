import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { transcriptionJobs, transcripts } from "@/db/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const lessonId = searchParams.get("lessonId");
  const recordingId = searchParams.get("recordingId");

  if (!jobId && (!lessonId || !recordingId)) {
    return NextResponse.json(
      { error: "jobId or lessonId and recordingId are required." },
      { status: 400 },
    );
  }

  const db = createDatabaseClient();
  const [job] = jobId
    ? await db
        .select()
        .from(transcriptionJobs)
        .where(eq(transcriptionJobs.id, jobId))
        .limit(1)
    : await db
        .select()
        .from(transcriptionJobs)
        .where(
          and(
            eq(transcriptionJobs.lessonId, lessonId ?? ""),
            eq(transcriptionJobs.recordingId, recordingId ?? ""),
          ),
        )
        .orderBy(desc(transcriptionJobs.requestedAt))
        .limit(1);

  const transcriptId = job?.transcriptId;
  const [transcript] = transcriptId
    ? await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.id, transcriptId))
        .limit(1)
    : lessonId && recordingId
      ? await db
          .select()
          .from(transcripts)
          .where(
            and(
              eq(transcripts.lessonId, lessonId),
              eq(transcripts.recordingId, recordingId),
            ),
          )
          .limit(1)
      : [];

  return NextResponse.json({
    ok: true,
    job: job
      ? {
          id: job.id,
          completedAt: job.completedAt,
          completedChunks: job.completedChunks,
          currentLabel: job.currentLabel,
          errorMessage: job.errorMessage,
          mode: job.mode,
          requestedAt: job.requestedAt,
          status: job.status,
          totalChunks: job.totalChunks,
        }
      : null,
    progressPercent: job
      ? Math.round((job.completedChunks / Math.max(job.totalChunks, 1)) * 100)
      : 0,
    transcript: transcript
      ? {
          completedAt: transcript.completedAt,
          errorMessage: transcript.errorMessage,
          id: transcript.id,
          status: transcript.status,
          textLength: transcript.text?.length ?? 0,
        }
      : null,
  });
}
