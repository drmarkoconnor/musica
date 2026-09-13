import { NextResponse } from "next/server";
import { getLessonRecordingUploadStatus } from "@/lib/server/lesson-recording-upload-sessions";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(_request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) return NextResponse.json({ error: "Invalid upload session." }, { status: 400 });
  try {
    const status = await getLessonRecordingUploadStatus(uploadId);
    return status ? NextResponse.json(status, { headers: { "Cache-Control": "private, no-store" } }) : NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Upload progress could not be checked. Please retry." }, { status: 502 }); }
}
