import { NextResponse } from "next/server";
import { createLessonRecordingMetadata } from "@/lib/server/lesson-recording-metadata";
import {
  completeLessonRecordingUploadSession, markLessonRecordingUploadCompleted,
  readCompletedLessonRecordingUpload, recordingIdsForUpload,
} from "@/lib/server/lesson-recording-upload-sessions";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) return NextResponse.json({ error: "Invalid upload session." }, { status: 400 });
  let body: { chunkCount?: unknown; durationSeconds?: unknown; totalBytes?: unknown; integrityDigest?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const chunkCount = Number(body.chunkCount);
  if (!Number.isInteger(chunkCount) || chunkCount <= 0 || chunkCount > 2000) return NextResponse.json({ error: "Invalid chunk count." }, { status: 400 });
  const rawDuration = Number(body.durationSeconds);
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(Math.round(rawDuration), 8 * 60 * 60) : null;
  try {
    const prior = await readCompletedLessonRecordingUpload(uploadId);
    if (prior) return NextResponse.json(prior);
    const completed = await completeLessonRecordingUploadSession({
      chunkCount, durationSeconds, uploadId,
      totalBytes: typeof body.totalBytes === "number" ? body.totalBytes : undefined,
      integrityDigest: typeof body.integrityDigest === "string" ? body.integrityDigest : undefined,
    });
    const metadata = await createLessonRecordingMetadata({
      metadata: completed.metadata, storedAudio: completed.storedAudio,
      ids: recordingIdsForUpload(uploadId),
    });
    const result = { ...metadata, storagePath: completed.storedAudio.storagePath };
    await markLessonRecordingUploadCompleted(uploadId, result);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Do not delete chunks or final audio: the metadata write may have succeeded
    // even when its response was lost. Retrying uses the same database IDs.
    const detail = error instanceof Error ? error.message : "Please retry.";
    return NextResponse.json({ error: `Recording could not be finalised. Your uploaded audio is retained; retry to resume. ${detail}` }, { status: 502 });
  }
}
