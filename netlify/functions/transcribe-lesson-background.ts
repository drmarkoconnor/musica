import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "../../src/lib/server/env";
import {
  markTranscriptionJobFailed,
  runLessonTranscriptionJob,
} from "../../src/lib/server/transcription-job";

type BackgroundEvent = {
  body?: string | null;
  httpMethod?: string;
};

type BackgroundPayload = {
  jobId?: unknown;
  token?: unknown;
};

function safeCompare(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export const handler = async (event: BackgroundEvent) => {
  if (event.httpMethod && event.httpMethod !== "POST") {
    return {
      body: JSON.stringify({ error: "Method not allowed." }),
      statusCode: 405,
    };
  }

  const expectedToken = serverEnv("TRANSCRIPTION_PASSWORD");

  if (!expectedToken) {
    return {
      body: JSON.stringify({ error: "Transcription password is not configured." }),
      statusCode: 503,
    };
  }

  let payload: BackgroundPayload;

  try {
    payload = JSON.parse(event.body ?? "{}") as BackgroundPayload;
  } catch {
    return {
      body: JSON.stringify({ error: "Invalid request body." }),
      statusCode: 400,
    };
  }

  if (
    typeof payload.jobId !== "string" ||
    typeof payload.token !== "string" ||
    !safeCompare(payload.token, expectedToken)
  ) {
    return {
      body: JSON.stringify({ error: "Authorisation failed." }),
      statusCode: 401,
    };
  }

  try {
    await runLessonTranscriptionJob({ jobId: payload.jobId });
    return {
      body: JSON.stringify({ ok: true }),
      statusCode: 200,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Transcription failed.";
    console.error("Background transcription failed", error);
    await markTranscriptionJobFailed({
      errorMessage,
      jobId: payload.jobId,
    }).catch((markError) => {
      console.error("Could not mark transcription job failed", markError);
    });
    return {
      body: JSON.stringify({ error: errorMessage }),
      statusCode: 500,
    };
  }
};
