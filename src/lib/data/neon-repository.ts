import { asc } from "drizzle-orm";
import { createDatabaseClient, type PracticeLoopDatabase } from "@/db/client";
import * as dbSchema from "@/db/schema";
import type {
  Exercise,
  Lesson,
  LessonExtract,
  LessonRecording,
  LessonSegment,
  LessonSegmentTranscript,
  Piece,
  PieceAsset,
  PracticeSession,
  PracticeTask,
  Recording,
  SessionItem,
  SmartQueueItem,
  Tag,
  Transcript,
} from "@/lib/types";
import type {
  PracticeLoopReadModel,
  PracticeLoopRepository,
} from "./practice-loop-repository";

function toConfidence(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value <= 1) return 1;
  if (value >= 5) return 5;
  return value as 1 | 2 | 3 | 4 | 5;
}

function optional<T>(value: T | null | undefined) {
  return value ?? undefined;
}

function toLocale(value: string): "en" | "it" {
  return value === "it" ? "it" : "en";
}

function mapTag(row: dbSchema.TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color:
      row.color === "green" ||
      row.color === "blue" ||
      row.color === "amber" ||
      row.color === "rose"
        ? row.color
        : "slate",
  };
}

function mapPiece(row: dbSchema.PieceRow): Piece {
  return {
    id: row.id,
    title: row.title,
    composer: optional(row.composer),
    lyricist: optional(row.lyricist),
    key: row.musicalKey ?? "",
    status: row.status,
    confidence: toConfidence(row.confidence),
    lastPractised: row.lastPractisedOn ?? "",
    targetTempo: row.targetTempo ?? 0,
    currentTempo: row.currentTempo ?? 0,
    spotifyUrl: optional(row.spotifyUrl),
    isSpineTune: row.isSpineTune,
    notes: row.notes ?? "",
    relatedExerciseIds: [],
  };
}

function attachRelatedExerciseIds(
  pieces: Piece[],
  rows: dbSchema.PieceExerciseRow[],
) {
  const exerciseIdsByPiece = new Map<string, string[]>();

  for (const row of rows) {
    const exerciseIds = exerciseIdsByPiece.get(row.pieceId) ?? [];
    exerciseIds.push(row.exerciseId);
    exerciseIdsByPiece.set(row.pieceId, exerciseIds);
  }

  return pieces.map((piece) => ({
    ...piece,
    relatedExerciseIds: exerciseIdsByPiece.get(piece.id) ?? [],
  }));
}

function mapExercise(row: dbSchema.ExerciseRow): Exercise {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    keyFocus: row.keyFocus ?? "",
    confidence: toConfidence(row.confidence),
    lastPractised: row.lastPractisedOn ?? "",
    targetTempo: optional(row.targetTempo),
    currentTempo: optional(row.currentTempo),
    notes: row.notes ?? "",
  };
}

function mapLesson(row: dbSchema.LessonRow): Lesson {
  return {
    id: row.id,
    title: row.title,
    teacher: row.teacher ?? "",
    lessonDate: row.lessonDate,
    status: row.status,
    summary: row.summary ?? "",
  };
}

function mapLessonRecording(
  row: dbSchema.LessonRecordingRow,
): LessonRecording {
  return {
    id: row.id,
    lessonId: row.lessonId,
    title: row.title,
    storageBucket: row.storageBucket,
    durationSeconds: row.durationSeconds ?? 0,
    recordedAt: row.recordedAt,
    storagePath: row.storagePath,
  };
}

function mapLessonSegment(row: dbSchema.LessonSegmentRow): LessonSegment {
  return {
    id: row.id,
    lessonId: row.lessonId,
    recordingId: row.recordingId,
    title: row.title,
    notes: row.notes ?? "",
    startsAtSeconds: row.startsAtSeconds,
    endsAtSeconds: row.endsAtSeconds,
    status: row.status,
    source: row.source,
  };
}

function mapTranscript(row: dbSchema.TranscriptRow): Transcript {
  return {
    id: row.id,
    lessonId: row.lessonId,
    recordingId: row.recordingId,
    language: toLocale(row.language),
    status: row.status,
    text: row.text ?? "",
  };
}

function mapLessonSegmentTranscript(
  row: dbSchema.LessonSegmentTranscriptRow,
): LessonSegmentTranscript {
  return {
    id: row.id,
    lessonId: row.lessonId,
    recordingId: row.recordingId,
    segmentId: row.segmentId,
    transcriptId: optional(row.transcriptId),
    language: toLocale(row.language),
    status: row.status,
    text: row.text ?? "",
    summaryTitle: row.summaryTitle ?? "",
    summaryBody: row.summaryBody ?? "",
  };
}

function mapLessonExtract(row: dbSchema.LessonExtractRow): LessonExtract {
  return {
    id: row.id,
    lessonId: row.lessonId,
    segmentId: optional(row.segmentId),
    transcriptId: row.transcriptId ?? "",
    title: row.title,
    body: row.body ?? "",
    startsAtSeconds: row.startsAtSeconds,
    endsAtSeconds: optional(row.endsAtSeconds),
    status: row.status,
    tags: [],
    linkedPieceId: optional(row.linkedPieceId),
    linkedExerciseId: optional(row.linkedExerciseId),
    similarExtractId: optional(row.similarExtractId),
  };
}

function mapPracticeTask(row: dbSchema.PracticeTaskRow): PracticeTask {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    source: row.source,
    sourceLessonId: optional(row.sourceLessonId),
    sourceExtractId: optional(row.sourceExtractId),
    linkedPieceId: optional(row.linkedPieceId),
    linkedExerciseId: optional(row.linkedExerciseId),
    linkedRecordingId: optional(row.linkedRecordingId),
    startsAtSeconds: optional(row.startsAtSeconds),
    endsAtSeconds: optional(row.endsAtSeconds),
    tags: [],
    status: row.status,
    confidence: toConfidence(row.confidence),
    importance: row.importance,
    lastPractised: row.lastPractisedOn ?? "",
    targetFrequencyDays: row.targetFrequencyDays,
    resurfacingScore: Number(row.resurfacingScore),
    createdAt: row.createdAt,
  };
}

function mapPieceAsset(row: dbSchema.PieceAssetRow): PieceAsset {
  return {
    id: row.id,
    pieceId: row.pieceId,
    title: row.title,
    type: row.assetType,
    versionLabel: row.versionLabel ?? "",
    uploadedAt: row.uploadedAt,
    storageBucket: row.storageBucket,
    storagePath: row.storagePath,
  };
}

function mapPracticeSession(
  row: dbSchema.PracticeSessionRow,
): PracticeSession {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: optional(row.endedAt),
    notes: row.notes ?? "",
  };
}

function mapSessionItem(row: dbSchema.SessionItemRow): SessionItem {
  return {
    id: row.id,
    sessionId: row.practiceSessionId,
    position: row.position,
    title: row.title,
    reason: row.queueReason ?? "",
    status: row.status,
    practiceTaskId: optional(row.practiceTaskId),
    pieceId: optional(row.pieceId),
    exerciseId: optional(row.exerciseId),
    plannedMinutes: row.plannedMinutes ?? 0,
    actualSeconds: row.actualSeconds ?? 0,
    confidenceBefore: row.confidenceBefore
      ? toConfidence(row.confidenceBefore)
      : undefined,
    confidenceAfter: row.confidenceAfter
      ? toConfidence(row.confidenceAfter)
      : undefined,
    tempo: optional(row.tempo),
    notes: row.notes ?? "",
  };
}

function mapRecording(row: dbSchema.RecordingRow): Recording {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    durationSeconds: row.durationSeconds ?? 0,
    recordedAt: row.recordedAt,
    storagePath: row.storagePath,
    lessonId: optional(row.lessonId),
    practiceSessionId: optional(row.practiceSessionId),
    pieceId: optional(row.pieceId),
    exerciseId: optional(row.exerciseId),
    practiceTaskId: optional(row.practiceTaskId),
    spokenNote: optional(row.spokenNote),
  };
}

function buildSmartQueue(
  pieces: Piece[],
  exercises: Exercise[],
  practiceTasks: PracticeTask[],
): SmartQueueItem[] {
  const dayMs = 24 * 60 * 60 * 1000;

  function daysSince(value: string) {
    if (!value) return 120;

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return 120;

    return Math.max(0, Math.floor((Date.now() - timestamp) / dayMs));
  }

  type QueueCandidate = SmartQueueItem & { score: number };

  const taskCandidates = practiceTasks
    .filter((task) => task.status === "new" || task.status === "active")
    .map<QueueCandidate>((task) => {
      const days = daysSince(task.lastPractised);
      const overdueDays = Math.max(0, days - task.targetFrequencyDays);
      const confidenceDebt = (6 - task.confidence) * 10;

      return {
        id: `queue-task-${task.id}`,
        title: task.title,
        kind: "lesson_task",
        reason:
          task.source === "lesson"
            ? "New from lesson"
            : task.lastPractised
              ? "Due by practice frequency"
              : "Manual practice item",
        minutes: task.source === "lesson" ? 12 : 10,
        confidence: task.confidence,
        taskId: task.id,
        pieceId: task.linkedPieceId,
        score:
          task.resurfacingScore +
          task.importance * 6 +
          overdueDays * 4 +
          confidenceDebt +
          (task.status === "new" ? 30 : 12) +
          (task.source === "lesson" ? 5 : 0),
      };
    });

  const pieceCandidates = pieces
    .filter((piece) => piece.status !== "parked")
    .map<QueueCandidate>((piece) => {
      const days = daysSince(piece.lastPractised);
      const confidenceDebt = (6 - piece.confidence) * 12;

      return {
        id: `queue-piece-${piece.id}`,
        title: piece.title,
        kind: "piece",
        reason: piece.isSpineTune
          ? "Spine tune review"
          : piece.lastPractised
            ? "Due by last practised"
            : "Not practised yet",
        minutes: piece.isSpineTune ? 18 : 14,
        confidence: piece.confidence,
        pieceId: piece.id,
        score:
          Math.min(days, 180) +
          confidenceDebt +
          (piece.isSpineTune ? 16 : 0) +
          (piece.status === "learning" ? 8 : 0),
      };
    });

  const exerciseCandidates = exercises.map<QueueCandidate>((exercise) => {
    const days = daysSince(exercise.lastPractised);
    const confidenceDebt = (6 - exercise.confidence) * 10;

    return {
      id: `queue-exercise-${exercise.id}`,
      title: exercise.title,
      kind: "exercise",
      reason: exercise.lastPractised ? "Due by last practised" : "Warm-up rotation",
      minutes: 10,
      confidence: exercise.confidence,
      exerciseId: exercise.id,
      score: Math.min(days, 120) + confidenceDebt + 6,
    };
  });

  return [...taskCandidates, ...pieceCandidates, ...exerciseCandidates]
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ score: _score, ...item }) => item);
}

export function createNeonPracticeLoopRepository(
  db: PracticeLoopDatabase = createDatabaseClient(),
): PracticeLoopRepository {
  async function listPieces() {
    const rows = await db.select().from(dbSchema.pieces).orderBy(asc(dbSchema.pieces.title));
    return rows.map(mapPiece);
  }

  async function listExercises() {
    const rows = await db
      .select()
      .from(dbSchema.exercises)
      .orderBy(asc(dbSchema.exercises.title));
    return rows.map(mapExercise);
  }

  async function listLessons() {
    const rows = await db
      .select()
      .from(dbSchema.lessons)
      .orderBy(asc(dbSchema.lessons.lessonDate));
    return rows.map(mapLesson);
  }

  async function listPracticeTasks() {
    const rows = await db
      .select()
      .from(dbSchema.practiceTasks)
      .orderBy(asc(dbSchema.practiceTasks.createdAt));
    return rows.map(mapPracticeTask);
  }

  async function getReadModel(): Promise<PracticeLoopReadModel> {
    const [
      tagRows,
      basePieces,
      exercises,
      lessons,
      lessonRecordingRows,
      lessonSegmentRows,
      lessonSegmentTranscriptRows,
      transcriptRows,
      lessonExtractRows,
      practiceTasks,
      pieceAssetRows,
      practiceSessionRows,
      sessionItemRows,
      recordingRows,
      pieceExerciseRows,
    ] = await Promise.all([
      db.select().from(dbSchema.tags).orderBy(asc(dbSchema.tags.name)),
      listPieces(),
      listExercises(),
      listLessons(),
      db
        .select()
        .from(dbSchema.lessonRecordings)
        .orderBy(asc(dbSchema.lessonRecordings.recordedAt)),
      db
        .select()
        .from(dbSchema.lessonSegments)
        .orderBy(asc(dbSchema.lessonSegments.startsAtSeconds)),
      db
        .select()
        .from(dbSchema.lessonSegmentTranscripts)
        .orderBy(asc(dbSchema.lessonSegmentTranscripts.completedAt)),
      db.select().from(dbSchema.transcripts),
      db.select().from(dbSchema.lessonExtracts),
      listPracticeTasks(),
      db.select().from(dbSchema.pieceAssets),
      db.select().from(dbSchema.practiceSessions),
      db.select().from(dbSchema.sessionItems),
      db.select().from(dbSchema.recordings),
      db.select().from(dbSchema.pieceExercises),
    ]);

    const pieces = attachRelatedExerciseIds(basePieces, pieceExerciseRows);

    return {
      tags: tagRows.map(mapTag),
      pieces,
      exercises,
      lessons,
      lessonRecordings: lessonRecordingRows.map(mapLessonRecording),
      lessonSegments: lessonSegmentRows.map(mapLessonSegment),
      lessonSegmentTranscripts: lessonSegmentTranscriptRows.map(
        mapLessonSegmentTranscript,
      ),
      transcripts: transcriptRows.map(mapTranscript),
      lessonExtracts: lessonExtractRows.map(mapLessonExtract),
      practiceTasks,
      pieceAssets: pieceAssetRows.map(mapPieceAsset),
      practiceSessions: practiceSessionRows.map(mapPracticeSession),
      sessionItems: sessionItemRows.map(mapSessionItem),
      recordings: recordingRows.map(mapRecording),
      smartQueue: buildSmartQueue(pieces, exercises, practiceTasks),
    };
  }

  return {
    getReadModel,
    listPieces,
    listPracticeTasks,
    listLessons,
    listExercises,
  };
}
