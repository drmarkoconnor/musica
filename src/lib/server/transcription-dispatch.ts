import { serverEnv } from "@/lib/server/env";
import { runLessonTranscriptionJob } from "@/lib/server/transcription-job";

export async function dispatchLessonTranscription({ jobId, token, requestUrl }: { jobId: string; token: string; requestUrl?: string }) {
  const configuredSite = serverEnv("DEPLOY_URL") || serverEnv("DEPLOY_PRIME_URL") || serverEnv("URL");
  const local = requestUrl && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(requestUrl).hostname);
  if (local && !configuredSite && serverEnv("NETLIFY") !== "true") {
    // Development only. Hosted processing always uses durable background invocations.
    void (async () => {
      let result;
      do { result = await runLessonTranscriptionJob({ jobId }); } while (result.status === "queued");
    })().catch((error) => console.error("Local lesson worker failed", error));
    return;
  }
  const siteUrl = configuredSite;
  if (!siteUrl) throw new Error("The background processing site URL is not configured.");
  const response = await fetch(new URL("/.netlify/functions/transcribe-lesson-background", siteUrl), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, token }), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Background processing did not start. Saved progress is ready to retry.");
  }
}
