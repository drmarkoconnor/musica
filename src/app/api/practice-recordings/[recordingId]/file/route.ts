import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { recordings } from "@/db/schema";
import {
  practiceAudioContentTypeForPath,
  readPracticeAudioBuffer,
} from "@/lib/server/practice-audio-storage";

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const [, startValue, endValue] = match;
  let start = startValue ? Number(startValue) : 0;
  let end = endValue ? Number(endValue) : fileSize - 1;

  if (!startValue && endValue) {
    const suffixLength = Number(endValue);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await context.params;
  const db = createDatabaseClient();
  const [recording] = await db
    .select()
    .from(recordings)
    .where(eq(recordings.id, recordingId))
    .limit(1);

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  try {
    const file = await readPracticeAudioBuffer({
      storageBucket: recording.storageBucket,
      storagePath: recording.storagePath,
    });

    if (!file) {
      return NextResponse.json(
        { error: "Recording audio is not available." },
        { status: 404 },
      );
    }

    const fileSize = file.length;
    const contentType = practiceAudioContentTypeForPath(recording.storagePath);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, fileSize);
      if (!range) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunk = file.subarray(range.start, range.end + 1);

      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=0, must-revalidate",
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
          "Content-Type": contentType,
        },
      });
    }

    return new Response(new Uint8Array(file), {
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "Recording file not found." }, { status: 404 });
  }
}
