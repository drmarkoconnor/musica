import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import { transcribeAudioFile } from "@/lib/server/openai-transcription";
import {
  getTestAudioFixture,
  testAudioFixturesEnabled,
} from "@/lib/server/test-audio-fixtures";
import {
  createLessonTranscriptionJob,
  markTranscriptionJobFailed,
  runLessonTranscriptionJob,
  TranscriptionRequestError,
} from "@/lib/server/transcription-job";

export const runtime = "nodejs";
export const maxDuration = 60;

type TranscriptionRequest = {
  lessonId?: unknown;
  recordingId?: unknown;
  password?: unknown;
  testAudioFixture?: unknown;
  includeFullRecording?: unknown;
};

function safeCompare(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

function shouldUseNetlifyBackgroundFunction() {
  return serverEnv("NETLIFY") === "true";
}

async function startTranscriptionJob({
  expectedPassword,
  jobId,
  request,
}: {
  expectedPassword: string;
  jobId: string;
  request: Request;
}) {
  if (shouldUseNetlifyBackgroundFunction()) {
    const url = new URL("/.netlify/functions/transcribe-lesson-background", request.url);
    const response = await fetch(url, {
      body: JSON.stringify({ jobId, token: expectedPassword }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Background transcription did not start.");
    }

    return;
  }

  void runLessonTranscriptionJob({ jobId }).catch((error) => {
    const errorMessage =
      error instanceof Error ? error.message : "Transcription failed.";
    console.error("Background transcription failed", error);
    void markTranscriptionJobFailed({ errorMessage, jobId }).catch((markError) => {
      console.error("Could not mark transcription job failed", markError);
    });
  });
}

export async function POST(request: Request) {
  let body: TranscriptionRequest;

  try {
    body = (await request.json()) as TranscriptionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const expectedPassword = serverEnv("TRANSCRIPTION_PASSWORD");

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Transcription password is not configured." },
      { status: 503 },
    );
  }

  if (
    typeof body.password !== "string" ||
    typeof body.lessonId !== "string" ||
    typeof body.recordingId !== "string" ||
    !safeCompare(body.password, expectedPassword)
  ) {
    return NextResponse.json(
      { error: "Authorisation failed. Transcription was not started." },
      { status: 401 },
    );
  }

  if (typeof body.testAudioFixture === "string") {
    if (!testAudioFixturesEnabled()) {
      return NextResponse.json(
        { error: "Test audio fixtures are disabled." },
        { status: 404 },
      );
    }

    const fixture = getTestAudioFixture(body.testAudioFixture);

    if (!fixture) {
      return NextResponse.json(
        { error: "Unknown transcription test fixture." },
        { status: 400 },
      );
    }

    try {
      const transcription = await transcribeAudioFile({
        filePath: fixture.filePath,
      });

      return NextResponse.json({
        ok: true,
        status: "transcribed_fixture",
        lessonId: body.lessonId,
        recordingId: body.recordingId,
        fixture: body.testAudioFixture,
        model: transcription.model,
        durationMs: transcription.durationMs,
        characterCount: transcription.text.length,
        text: transcription.text,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Transcription failed.",
        },
        { status: 502 },
      );
    }
  }

  try {
    const job = await createLessonTranscriptionJob({
      includeFullRecording: body.includeFullRecording === true,
      lessonId: body.lessonId,
      recordingId: body.recordingId,
    });

    if (job.shouldStart) {
      try {
        await startTranscriptionJob({
          expectedPassword,
          jobId: job.jobId,
          request,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Transcription was queued but the background job did not start.";
        await markTranscriptionJobFailed({ errorMessage, jobId: job.jobId });
        return NextResponse.json({ error: errorMessage }, { status: 502 });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        status: "queued",
        lessonId: body.lessonId,
        recordingId: body.recordingId,
        ...job,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof TranscriptionRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Transcription failed.",
      },
      { status: 502 },
    );
  }
}
