import { NextResponse } from "next/server";
import { loadLessonPassages } from "@/lib/server/lesson-passages";
import { isLearningPointId } from "@/lib/server/learning-points";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lessonId = params.get("lessonId") ?? "";
  const recordingId = params.get("recordingId") ?? "";
  if (!isLearningPointId(lessonId) || !isLearningPointId(recordingId)) return NextResponse.json({ error: "Valid lesson and recording identifiers are required." }, { status: 400 });
  try { return NextResponse.json(await loadLessonPassages(lessonId, recordingId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Saved passages are temporarily unavailable. Try again." }, { status: 503 }); }
}
