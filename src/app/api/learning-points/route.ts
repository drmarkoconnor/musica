import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { createDatabaseClient } from "@/db/client";
import { learningPoints, transcriptionJobChunks, transcriptionJobs } from "@/db/schema";
import { evidenceFromChunks } from "@/lib/server/transcript-passages";
import { isLearningPointId, LearningPointError, mapLearningPoint, parseLearningPointUpdate } from "@/lib/server/learning-points";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LearningPointError("Supply a saved source passage.", 400);
    const input = raw as Record<string, unknown>;
    if (typeof input.jobId !== "string" || !isLearningPointId(input.jobId) || typeof input.evidenceId !== "string") throw new LearningPointError("Supply a valid saved source passage.", 400);
    const changes = parseLearningPointUpdate({ title: input.title, body: input.body, tags: input.tags ?? [] });
    const db = createDatabaseClient();
    const [job] = await db.select().from(transcriptionJobs).where(eq(transcriptionJobs.id, input.jobId));
    if (!job) throw new LearningPointError("The source lesson was not found.", 404);
    const chunks = await db.select().from(transcriptionJobChunks).where(eq(transcriptionJobChunks.jobId, job.id));
    const passage = evidenceFromChunks(chunks, job.mode).find((item) => item.id === input.evidenceId);
    if (!passage) throw new LearningPointError("The source passage was not found.", 404);
    const sourceKey = `manual:${passage.id}`;
    const [inserted] = await db.insert(learningPoints).values({ lessonId: job.lessonId, recordingId: job.recordingId, analysisRunId: job.id, sourceKey, title: changes.title!, body: changes.body!, tags: changes.tags, startsAtSeconds: passage.startsAtSeconds, endsAtSeconds: passage.endsAtSeconds, evidenceText: passage.text, evidencePrecision: passage.precision, status: "kept" }).onConflictDoNothing().returning();
    const [existing] = inserted ? [inserted] : await db.select().from(learningPoints).where(and(eq(learningPoints.analysisRunId, job.id), eq(learningPoints.sourceKey, sourceKey)));
    return NextResponse.json({ point: mapLearningPoint(existing) }, { status: inserted ? 201 : 200 });
  } catch (error) {
    if (error instanceof LearningPointError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    return NextResponse.json({ error: "Could not save this memory. Your source passage is unchanged." }, { status: 503 });
  }
}
