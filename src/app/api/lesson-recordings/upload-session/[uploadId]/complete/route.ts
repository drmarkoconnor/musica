import { NextResponse } from "next/server";
import { deleteLessonAudio } from "@/lib/server/lesson-audio-storage";
import { createLessonRecordingMetadata } from "@/lib/server/lesson-recording-metadata";
import { completeLessonRecordingUploadSession } from "@/lib/server/lesson-recording-upload-sessions";

export const runtime = "nodejs";
export const maxDuration = 300;

type CompleteRequestBody = {
  chunkCount?: unknown;
  durationSeconds?: unknown;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseChunkCount(value: unknown) {
  const chunkCount = Number(value);

  if (!Number.isInteger(chunkCount) || chunkCount <= 0 || chunkCount > 2000) {
    return null;
  }

  return chunkCount;
}

function parseDurationSeconds(value: unknown) {
  const durationSeconds = Number(value);

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Math.min(Math.round(durationSeconds), 8 * 60 * 60);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await context.params;

  if (!isUuid(uploadId)) {
    return NextResponse.json({ error: "Invalid upload session." }, { status: 400 });
  }

  let body: CompleteRequestBody;

  try {
    body = (await request.json()) as CompleteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const chunkCount = parseChunkCount(body.chunkCount);

  if (!chunkCount) {
    return NextResponse.json({ error: "Chunk count is required." }, { status: 400 });
  }

  let completedUpload: Awaited<
    ReturnType<typeof completeLessonRecordingUploadSession>
  >;

  try {
    completedUpload = await completeLessonRecordingUploadSession({
      chunkCount,
      durationSeconds: parseDurationSeconds(body.durationSeconds),
      uploadId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Recording chunks could not be assembled. ${detail}` },
      { status: 502 },
    );
  }

  try {
    const metadataResult = await createLessonRecordingMetadata({
      metadata: completedUpload.metadata,
      storedAudio: completedUpload.storedAudio,
    });

    return NextResponse.json(
      {
        lessonId: metadataResult.lessonId,
        recordingId: metadataResult.recordingId,
        storagePath: completedUpload.storedAudio.storagePath,
      },
      { status: 201 },
    );
  } catch {
    await deleteLessonAudio({
      storageBucket: completedUpload.storedAudio.storageBucket,
      storagePath: completedUpload.storedAudio.storagePath,
    }).catch((error) => {
      console.error("Orphaned chunked lesson audio cleanup failed", error);
    });

    return NextResponse.json(
      { error: "Recording metadata could not be saved." },
      { status: 502 },
    );
  }
}
