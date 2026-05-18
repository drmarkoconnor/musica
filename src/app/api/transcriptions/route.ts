import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  lessonExtracts,
  lessonRecordings,
  lessons,
  transcripts,
} from "@/db/schema";
import { serverEnv } from "@/lib/server/env";
import {
  analyzeLessonTranscript,
  lessonSummaryText,
  type LessonAnalysisResult,
} from "@/lib/server/lesson-analysis";
import { materializeLessonAudioFile } from "@/lib/server/lesson-audio-storage";
import { transcribeAudioFile } from "@/lib/server/openai-transcription";
import { getTestAudioFixture } from "@/lib/server/test-audio-fixtures";

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

async function saveLessonAnalysis({
  analysis,
  lessonId,
  transcriptId,
}: {
  analysis: LessonAnalysisResult;
  lessonId: string;
  transcriptId: string;
}) {
  const db = createDatabaseClient();
  const summary = lessonSummaryText(analysis);
  const updatedAt = new Date().toISOString();

  await db
    .delete(lessonExtracts)
    .where(
      and(
        eq(lessonExtracts.lessonId, lessonId),
        eq(lessonExtracts.status, "candidate"),
      ),
    );

  if (analysis.practiceCandidates.length > 0) {
    await db.insert(lessonExtracts).values(
      analysis.practiceCandidates.map((item) => ({
        lessonId,
        transcriptId,
        title: item.title,
        body: `${item.body}\n\nPossible follow-up: ${item.suggestedPracticeNote}`,
        startsAtSeconds: item.startsAtSeconds,
        endsAtSeconds: item.endsAtSeconds,
        status: "candidate" as const,
      })),
    );
  }

  await db
    .update(lessons)
    .set({
      status: analysis.practiceCandidates.length > 0 ? "extracted" : "transcribed",
      summary: summary || null,
      updatedAt,
    })
    .where(eq(lessons.id, lessonId));
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

  const audioFile = await materializeLessonAudioFile({
    storageBucket: recording.storageBucket,
    storagePath: recording.storagePath,
  });

  if (!audioFile) {
    return NextResponse.json(
      { error: "Recording audio is not available for transcription." },
      { status: 404 },
    );
  }

  const requestedAt = new Date().toISOString();

  try {
    const transcription = await transcribeAudioFile({ filePath: audioFile.filePath });
    const completedAt = new Date().toISOString();
    let transcriptId: string;
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
      transcriptId = existingTranscript.id;
    } else {
      const [createdTranscript] = await db
        .insert(transcripts)
        .values({
          lessonId: body.lessonId,
          recordingId: body.recordingId,
          language: "en",
          status: "complete",
          text: transcription.text,
          model: transcription.model,
          requestedAt,
          completedAt,
        })
        .returning({ id: transcripts.id });
      transcriptId = createdTranscript.id;
    }

    await db
      .update(lessons)
      .set({ status: "transcribed", updatedAt: completedAt })
      .where(eq(lessons.id, body.lessonId));

    let analysisStatus: "complete" | "failed" = "complete";
    let practiceCandidateCount = 0;
    let summaryBulletCount = 0;

    try {
      const analysis = await analyzeLessonTranscript({
        transcriptText: transcription.text,
      });
      await saveLessonAnalysis({
        analysis,
        lessonId: body.lessonId,
        transcriptId,
      });
      practiceCandidateCount = analysis.practiceCandidates.length;
      summaryBulletCount = analysis.summaryBullets.length;
    } catch (error) {
      analysisStatus = "failed";
      console.error("Lesson analysis failed", error);
    }

    return NextResponse.json({
      ok: true,
      status:
        analysisStatus === "complete"
          ? "transcribed_and_extracted"
          : "transcribed_recording",
      analysisStatus,
      lessonId: body.lessonId,
      recordingId: body.recordingId,
      model: transcription.model,
      durationMs: transcription.durationMs,
      characterCount: transcription.text.length,
      practiceCandidateCount,
      summaryBulletCount,
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
  } finally {
    await audioFile.cleanup();
  }
}
