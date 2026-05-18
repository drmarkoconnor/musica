import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import { lessonRecordings, lessons, transcripts } from "@/db/schema";
import { serverEnv } from "@/lib/server/env";
import { transcribeAudioFile } from "@/lib/server/openai-transcription";
import {
  getTestAudioFixture,
  localLessonAudioPath,
} from "@/lib/server/test-audio-fixtures";

export const runtime = "nodejs";
export const maxDuration = 300;

type TranscriptionRequest = {
  lessonId?: unknown;
  recordingId?: unknown;
  password?: unknown;
  testAudioFixture?: unknown;
};

function safeCompare(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

async function markTranscriptFailed({
  errorMessage,
  lessonId,
  recordingId,
  requestedAt,
}: {
  errorMessage: string;
  lessonId: string;
  recordingId: string;
  requestedAt: string;
}) {
  const db = createDatabaseClient();
  const [existingTranscript] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(
      and(
        eq(transcripts.lessonId, lessonId),
        eq(transcripts.recordingId, recordingId),
      ),
    );

  if (existingTranscript) {
    await db
      .update(transcripts)
      .set({
        status: "failed",
        requestedAt,
        completedAt: null,
        errorMessage,
      })
      .where(eq(transcripts.id, existingTranscript.id));
    return;
  }

  await db.insert(transcripts).values({
    lessonId,
    recordingId,
    language: "en",
    status: "failed",
    requestedAt,
    errorMessage,
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

  const db = createDatabaseClient();
  const [recording] = await db
    .select()
    .from(lessonRecordings)
    .where(
      and(
        eq(lessonRecordings.id, body.recordingId),
        eq(lessonRecordings.lessonId, body.lessonId),
      ),
    );

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const filePath = localLessonAudioPath(
    recording.storageBucket,
    recording.storagePath,
  );

  if (!filePath) {
    return NextResponse.json(
      { error: "Only local lesson audio can be transcribed in this build." },
      { status: 501 },
    );
  }

  const requestedAt = new Date().toISOString();

  try {
    const transcription = await transcribeAudioFile({ filePath });
    const completedAt = new Date().toISOString();
    const [existingTranscript] = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(
        and(
          eq(transcripts.lessonId, body.lessonId),
          eq(transcripts.recordingId, body.recordingId),
        ),
      );

    if (existingTranscript) {
      await db
        .update(transcripts)
        .set({
          language: "en",
          status: "complete",
          text: transcription.text,
          model: transcription.model,
          requestedAt,
          completedAt,
          errorMessage: null,
        })
        .where(eq(transcripts.id, existingTranscript.id));
    } else {
      await db.insert(transcripts).values({
        lessonId: body.lessonId,
        recordingId: body.recordingId,
        language: "en",
        status: "complete",
        text: transcription.text,
        model: transcription.model,
        requestedAt,
        completedAt,
      });
    }

    await db
      .update(lessons)
      .set({ status: "transcribed", updatedAt: completedAt })
      .where(eq(lessons.id, body.lessonId));

    return NextResponse.json({
      ok: true,
      status: "transcribed_recording",
      lessonId: body.lessonId,
      recordingId: body.recordingId,
      model: transcription.model,
      durationMs: transcription.durationMs,
      characterCount: transcription.text.length,
      text: transcription.text,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Transcription failed.";

    await markTranscriptFailed({
      errorMessage,
      lessonId: body.lessonId,
      recordingId: body.recordingId,
      requestedAt,
    });

    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
