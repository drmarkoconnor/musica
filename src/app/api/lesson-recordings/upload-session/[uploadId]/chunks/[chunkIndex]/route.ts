import { NextResponse } from "next/server";
import {
  readLessonRecordingUploadManifest,
  saveLessonRecordingUploadChunk,
} from "@/lib/server/lesson-recording-upload-sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHUNK_BYTES = 2 * 1024 * 1024;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseChunkIndex(value: string) {
  const chunkIndex = Number(value);

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 1999) {
    return null;
  }

  return chunkIndex;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ chunkIndex: string; uploadId: string }> },
) {
  const { chunkIndex: rawChunkIndex, uploadId } = await context.params;
  const chunkIndex = parseChunkIndex(rawChunkIndex);

  if (!isUuid(uploadId) || chunkIndex === null) {
    return NextResponse.json({ error: "Invalid upload chunk." }, { status: 400 });
  }

  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength ? Number(rawContentLength) : null;

  if (
    contentLength !== null &&
    (!Number.isFinite(contentLength) ||
      contentLength <= 0 ||
      contentLength > MAX_CHUNK_BYTES)
  ) {
    return NextResponse.json({ error: "Invalid chunk size." }, { status: 413 });
  }

  const manifest = await readLessonRecordingUploadManifest(uploadId);

  if (!manifest) {
    return NextResponse.json(
      { error: "Upload session not found." },
      { status: 404 },
    );
  }

  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Empty recording chunk." }, { status: 400 });
  const parts: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_CHUNK_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Recording chunks must not exceed 2 MiB." }, { status: 413 });
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (receivedBytes <= 0) return NextResponse.json({ error: "Empty recording chunk." }, { status: 400 });
  const buffer = Buffer.concat(parts);

  try {
    const receipt = await saveLessonRecordingUploadChunk({
      buffer,
      sha256: request.headers.get("x-chunk-sha256") ?? undefined,
      chunkIndex,
      contentType:
        request.headers.get("content-type") ||
        manifest.contentType ||
        "application/octet-stream",
      uploadId,
    });
    return NextResponse.json({ ...receipt, ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `Recording chunk could not be saved. ${detail}` },
      { status: 502 },
    );
  }

}
