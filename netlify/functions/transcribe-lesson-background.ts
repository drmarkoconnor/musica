import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "../../src/lib/server/env";
import { dispatchLessonTranscription } from "../../src/lib/server/transcription-dispatch";
import { markTranscriptionJobFailed, runLessonTranscriptionJob } from "../../src/lib/server/transcription-job";

function safeCompare(input: string, expected: string) {
  const actual = Buffer.from(input);
  const configured = Buffer.from(expected);
  return actual.length === configured.length && timingSafeEqual(actual, configured);
}

// The -background suffix selects Netlify's background execution. Modern Functions
// supply Blobs context automatically; no legacy Lambda adapter is required.
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  const token = serverEnv("TRANSCRIPTION_PASSWORD");
  if (!token) return Response.json({ error: "Transcription password is not configured." }, { status: 503 });
  let payload: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid body.");
    payload = value as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof payload.token !== "string" || !safeCompare(payload.token, token)) return Response.json({ error: "Authorisation failed." }, { status: 401 });
  if (typeof payload.jobId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.jobId)) return Response.json({ error: "A valid job identifier is required." }, { status: 400 });
  try {
    const result = await runLessonTranscriptionJob({ jobId: payload.jobId });
    // Continue before the 15-minute runtime limit. A fresh invocation resumes
    // saved chunks; the job lease prevents simultaneous invocations doing work.
    if (result.status === "queued") await dispatchLessonTranscription({ jobId: payload.jobId, token });
    return Response.json({ ok: true, status: result.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Lesson processing failed.";
    console.error("Background lesson processing failed", error);
    await markTranscriptionJobFailed({ jobId: payload.jobId, errorMessage }).catch((markError) => console.error("Could not save worker failure", markError));
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
