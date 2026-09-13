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
  retryLessonAnalysis,
  TranscriptionRequestError,
} from "@/lib/server/transcription-job";

import { dispatchLessonTranscription } from "@/lib/server/transcription-dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

type TranscriptionRequest = {
  jobId?: unknown;
  retryAnalysis?: unknown;
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

export async function POST(request: Request) {
  let body: TranscriptionRequest;

  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request body.");
    body = parsed as TranscriptionRequest;
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
    const validId = (id: unknown) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!validId(body.lessonId) || !validId(body.recordingId) || (body.retryAnalysis === true && !validId(body.jobId))) {
      return NextResponse.json({ error: "Valid lesson, recording and retry job identifiers are required." }, { status: 400 });
    }
    if (body.retryAnalysis !== undefined && typeof body.retryAnalysis !== "boolean") {
      return NextResponse.json({ error: "retryAnalysis must be a boolean." }, { status: 400 });
    }
    if (body.includeFullRecording !== undefined && typeof body.includeFullRecording !== "boolean") {
      return NextResponse.json({ error: "includeFullRecording must be a boolean." }, { status: 400 });
    }
    const job = body.retryAnalysis === true && typeof body.jobId === "string"
      ? await retryLessonAnalysis({ jobId: body.jobId, lessonId: body.lessonId, recordingId: body.recordingId })
      : await createLessonTranscriptionJob({
      includeFullRecording: body.includeFullRecording !== false,
      lessonId: body.lessonId,
      recordingId: body.recordingId,
    });

    if (job.shouldStart) {
      try {
        await dispatchLessonTranscription({ token: expectedPassword, jobId: job.jobId, requestUrl: request.url });
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
        status: job.shouldStart ? "queued" : "existing",
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
