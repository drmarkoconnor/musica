import { timingSafeEqual } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabaseClient } from "@/db/client";
import {
  lessonExtracts,
  lessonRecordings,
  lessonSegments,
  lessonSegmentTranscripts,
  lessons,
  transcripts,
} from "@/db/schema";
import { serverEnv } from "@/lib/server/env";
import {
  analyzeLessonSegments,
  analyzeLessonTranscript,
  lessonSummaryText,
  type LessonAnalysisResult,
  type LessonSegmentAnalysisInput,
  type SegmentedLessonAnalysisResult,
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
  includeFullRecording?: unknown;
};

type TranscribedLessonSegment = LessonSegmentAnalysisInput & {
  model: string;
};

function safeCompare(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

function formatTimestamp(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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

async function saveRawSegmentTranscripts({
  completedAt,
  lessonId,
  recordingId,
  requestedAt,
  segments,
  transcriptId,
}: {
  completedAt: string;
  lessonId: string;
  recordingId: string;
  requestedAt: string;
  segments: TranscribedLessonSegment[];
  transcriptId: string;
}) {
  const db = createDatabaseClient();

  for (const segment of segments) {
    const [existing] = await db
      .select({ id: lessonSegmentTranscripts.id })
      .from(lessonSegmentTranscripts)
      .where(eq(lessonSegmentTranscripts.segmentId, segment.segmentId));

    const values = {
      completedAt,
      errorMessage: null,
      language: "en" as const,
      lessonId,
      model: segment.model,
      recordingId,
      requestedAt,
      segmentId: segment.segmentId,
      status: "complete" as const,
      text: segment.transcriptText,
      transcriptId,
      updatedAt: completedAt,
    };

    if (existing) {
      await db
        .update(lessonSegmentTranscripts)
        .set(values)
        .where(eq(lessonSegmentTranscripts.id, existing.id));
      continue;
    }

    await db.insert(lessonSegmentTranscripts).values(values);
  }
}

async function saveSegmentedLessonAnalysis({
  analysis,
  lessonId,
  transcriptId,
}: {
  analysis: SegmentedLessonAnalysisResult;
  lessonId: string;
  transcriptId: string;
}) {
  const db = createDatabaseClient();
  const summary = lessonSummaryText(analysis);
  const updatedAt = new Date().toISOString();
  const memoryBySegmentId = new Map(
    analysis.segmentMemories.map((memory) => [memory.segmentId, memory]),
  );

  await db
    .delete(lessonExtracts)
    .where(
      and(
        eq(lessonExtracts.lessonId, lessonId),
        eq(lessonExtracts.status, "candidate"),
      ),
    );

  for (const memory of analysis.segmentMemories) {
    await db
      .update(lessonSegmentTranscripts)
      .set({
        summaryBody: memory.body,
        summaryTitle: memory.title,
        updatedAt,
      })
      .where(eq(lessonSegmentTranscripts.segmentId, memory.segmentId));
  }

  const practiceCandidateRows = analysis.practiceCandidates
    .filter((item) => item.segmentId && memoryBySegmentId.has(item.segmentId))
    .map((item) => {
      const memory = memoryBySegmentId.get(item.segmentId ?? "");

      return {
        lessonId,
        segmentId: item.segmentId,
        transcriptId,
        title: item.title,
        body: `${item.body}\n\nPossible follow-up: ${item.suggestedPracticeNote}`,
        startsAtSeconds: item.startsAtSeconds,
        endsAtSeconds:
          item.endsAtSeconds ??
          memory?.endsAtSeconds ??
          Math.max(item.startsAtSeconds + 1, item.startsAtSeconds),
        status: "candidate" as const,
      };
    });

  if (practiceCandidateRows.length > 0) {
    await db.insert(lessonExtracts).values(practiceCandidateRows);
  }

  await db
    .update(lessons)
    .set({
      status: practiceCandidateRows.length > 0 ? "extracted" : "transcribed",
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
    const selectedSegments = await db
      .select({
        endsAtSeconds: lessonSegments.endsAtSeconds,
        id: lessonSegments.id,
        notes: lessonSegments.notes,
        startsAtSeconds: lessonSegments.startsAtSeconds,
        title: lessonSegments.title,
      })
      .from(lessonSegments)
      .where(
        and(
          eq(lessonSegments.lessonId, body.lessonId),
          eq(lessonSegments.recordingId, body.recordingId),
          eq(lessonSegments.status, "selected"),
        ),
      )
      .orderBy(asc(lessonSegments.startsAtSeconds));

    if (selectedSegments.length === 0 && body.includeFullRecording !== true) {
      return NextResponse.json(
        {
          error:
            "No teaching segments selected. Confirm full-recording transcription to continue.",
        },
        { status: 400 },
      );
    }

    let transcriptionText = "";
    let transcriptionModel = "";
    let transcriptionDurationMs = 0;
    const segmentTranscriptions: TranscribedLessonSegment[] = [];

    if (selectedSegments.length > 0) {
      const { clipAudioSegments } = await import("@/lib/server/audio-segments");
      const clipped = await clipAudioSegments({
        segments: selectedSegments,
        sourceFilePath: audioFile.filePath,
      });

      try {
        const segmentTexts: string[] = [];

        for (const [index, clippedSegment] of clipped.clippedSegments.entries()) {
          const transcription = await transcribeAudioFile({
            filePath: clippedSegment.filePath,
          });
          transcriptionModel = transcription.model;
          transcriptionDurationMs += transcription.durationMs;
          segmentTranscriptions.push({
            endsAtSeconds: clippedSegment.segment.endsAtSeconds,
            model: transcription.model,
            notes: clippedSegment.segment.notes ?? "",
            segmentId: clippedSegment.segment.id,
            startsAtSeconds: clippedSegment.segment.startsAtSeconds,
            title: clippedSegment.segment.title,
            transcriptText: transcription.text,
          });
          segmentTexts.push(
            [
              `[Teaching segment ${index + 1}: ${clippedSegment.segment.title}. Original audio ${formatTimestamp(
                clippedSegment.segment.startsAtSeconds,
              )}-${formatTimestamp(clippedSegment.segment.endsAtSeconds)}.]`,
              transcription.text,
            ].join("\n"),
          );
        }

        transcriptionText = segmentTexts.join("\n\n");
      } finally {
        await clipped.cleanup();
      }
    } else {
      const transcription = await transcribeAudioFile({ filePath: audioFile.filePath });
      transcriptionText = transcription.text;
      transcriptionModel = transcription.model;
      transcriptionDurationMs = transcription.durationMs;
    }

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
          text: transcriptionText,
          model: transcriptionModel,
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
          text: transcriptionText,
          model: transcriptionModel,
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

    if (segmentTranscriptions.length > 0) {
      await saveRawSegmentTranscripts({
        completedAt,
        lessonId: body.lessonId,
        recordingId: body.recordingId,
        requestedAt,
        segments: segmentTranscriptions,
        transcriptId,
      });
    }

    let analysisStatus: "complete" | "failed" = "complete";
    let practiceCandidateCount = 0;
    let summaryBulletCount = 0;

    try {
      if (segmentTranscriptions.length > 0) {
        const analysis = await analyzeLessonSegments({
          segments: segmentTranscriptions,
        });
        await saveSegmentedLessonAnalysis({
          analysis,
          lessonId: body.lessonId,
          transcriptId,
        });
        practiceCandidateCount = analysis.practiceCandidates.length;
        summaryBulletCount = analysis.summaryBullets.length;
      } else {
        const analysis = await analyzeLessonTranscript({
          transcriptText: transcriptionText,
        });
        await saveLessonAnalysis({
          analysis,
          lessonId: body.lessonId,
          transcriptId,
        });
        practiceCandidateCount = analysis.practiceCandidates.length;
        summaryBulletCount = analysis.summaryBullets.length;
      }
    } catch (error) {
      analysisStatus = "failed";
      console.error("Lesson analysis failed", error);
    }

    if (selectedSegments.length > 0) {
      await Promise.all(
        selectedSegments.map((segment) =>
          db
            .update(lessonSegments)
            .set({ status: "transcribed", updatedAt: completedAt })
            .where(eq(lessonSegments.id, segment.id)),
        ),
      );
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
      model: transcriptionModel,
      durationMs: transcriptionDurationMs,
      characterCount: transcriptionText.length,
      practiceCandidateCount,
      selectedSegmentCount: selectedSegments.length,
      summaryBulletCount,
      text: transcriptionText,
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
