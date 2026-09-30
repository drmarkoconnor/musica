import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings } from "@/db/schema";
import { describeLessonAudio, MAX_AUDIO_RESPONSE_BYTES, readLessonAudioRange } from "@/lib/server/lesson-audio-storage";

export const runtime = "nodejs";
export const maxDuration = 60;
export function parseRangeHeader(header: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || fileSize <= 0) return null;
  const [, first, last] = match;
  let start = first ? Number(first) : Math.max(0, fileSize - Number(last));
  let end = first && last ? Number(last) : fileSize - 1;
  if (!first && Number(last) <= 0) return null;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= fileSize || end < start) return null;
  end = Math.min(end, fileSize - 1);
  // A server may return a smaller contiguous subrange. Media elements request
  // the next range, keeping each buffered response safely below Netlify limits.
  end = Math.min(end, start + MAX_AUDIO_RESPONSE_BYTES - 1);
  return { start, end };
}
async function respond(request: Request, context: { params: Promise<{ recordingId: string }> }, head: boolean) {
  const { recordingId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) return NextResponse.json({ error: "Invalid recording." }, { status: 400 });
  const db = createDatabaseClient();
  const [recording] = await db.select().from(lessonRecordings).where(eq(lessonRecordings.id, recordingId));
  if (!recording) return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  const headers: Record<string, string> = { "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const audio = await describeLessonAudio(recording);
    if (!audio) return NextResponse.json({ error: "Recording audio is not available." }, { status: 404, headers });
    const { fileSize, contentType } = audio;
    headers["Content-Type"] = contentType;
    if (head) return new Response(null, { headers: { ...headers, "Content-Length": String(fileSize) } });
    const rawRange = request.headers.get("range");
    if (!rawRange && fileSize > MAX_AUDIO_RESPONSE_BYTES) {
      // A complete large 200 response cannot fit Netlify's response envelope.
      // Browsers use Range for media; non-media callers must explicitly do so.
      return NextResponse.json({ error: "Request this recording with a Range header, for example bytes=0-." }, { status: 400, headers: { "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" } });
    }
    const range = rawRange ? parseRangeHeader(rawRange, fileSize) : { start: 0, end: fileSize - 1 };
    if (!range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${fileSize}` } });
    const chunk = await readLessonAudioRange(recording, range.start, range.end, audio.manifest);
    if (!chunk || chunk.length !== range.end - range.start + 1) throw new Error("Recording range is incomplete.");
    headers["Content-Length"] = String(chunk.length);
    if (rawRange) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${fileSize}`;
    return new Response(Uint8Array.from(chunk), { status: rawRange ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Recording audio could not be read. Please retry." }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
export async function GET(request: Request, context: { params: Promise<{ recordingId: string }> }) { return respond(request, context, false); }
export async function HEAD(request: Request, context: { params: Promise<{ recordingId: string }> }) { return respond(request, context, true); }
