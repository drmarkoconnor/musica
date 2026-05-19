import "server-only";

import { createHash } from "node:crypto";
import { mockPracticeLoopReadModel } from "./mock-repository";
import { createPracticeLoopRepository } from "./index";
import type { PracticeLoopReadModel } from "./practice-loop-repository";

function stableUuid(input: string) {
  const bytes = createHash("sha1")
    .update(`practice-loop:v1:${input}`)
    .digest()
    .subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function createNeonCompatibleMockReadModel(): PracticeLoopReadModel {
  const pieceIds = new Map(
    mockPracticeLoopReadModel.pieces.map((piece) => [piece.id, stableUuid(piece.id)]),
  );
  const exerciseIds = new Map(
    mockPracticeLoopReadModel.exercises.map((exercise) => [
      exercise.id,
      stableUuid(exercise.id),
    ]),
  );
  const tagIds = new Map(
    mockPracticeLoopReadModel.tags.map((tag) => [tag.id, stableUuid(tag.id)]),
  );

  const mapPieceId = (id: string | undefined) =>
    id ? (pieceIds.get(id) ?? id) : undefined;
  const mapExerciseId = (id: string | undefined) =>
    id ? (exerciseIds.get(id) ?? id) : undefined;
  const mapTagId = (id: string) => tagIds.get(id) ?? id;

  return {
    tags: mockPracticeLoopReadModel.tags.map((tag) => ({
      ...tag,
      id: mapTagId(tag.id),
    })),
    pieces: mockPracticeLoopReadModel.pieces.map((piece) => ({
      ...piece,
      id: mapPieceId(piece.id) ?? piece.id,
      relatedExerciseIds: piece.relatedExerciseIds
        .map(mapExerciseId)
        .filter((id): id is string => Boolean(id)),
    })),
    exercises: mockPracticeLoopReadModel.exercises.map((exercise) => ({
      ...exercise,
      id: mapExerciseId(exercise.id) ?? exercise.id,
    })),
    lessons: mockPracticeLoopReadModel.lessons,
    lessonRecordings: mockPracticeLoopReadModel.lessonRecordings,
    lessonSegments: mockPracticeLoopReadModel.lessonSegments,
    lessonSegmentTranscripts: mockPracticeLoopReadModel.lessonSegmentTranscripts,
    transcripts: mockPracticeLoopReadModel.transcripts,
    lessonExtracts: mockPracticeLoopReadModel.lessonExtracts.map((extract) => ({
      ...extract,
      linkedPieceId: mapPieceId(extract.linkedPieceId),
      linkedExerciseId: mapExerciseId(extract.linkedExerciseId),
      tags: extract.tags.map(mapTagId),
    })),
    practiceTasks: mockPracticeLoopReadModel.practiceTasks.map((task) => ({
      ...task,
      linkedPieceId: mapPieceId(task.linkedPieceId),
      linkedExerciseId: mapExerciseId(task.linkedExerciseId),
      tags: task.tags.map(mapTagId),
    })),
    pieceAssets: mockPracticeLoopReadModel.pieceAssets.map((asset) => ({
      ...asset,
      pieceId: mapPieceId(asset.pieceId) ?? asset.pieceId,
    })),
    practiceSessions: mockPracticeLoopReadModel.practiceSessions,
    sessionItems: mockPracticeLoopReadModel.sessionItems.map((item) => ({
      ...item,
      pieceId: mapPieceId(item.pieceId),
      exerciseId: mapExerciseId(item.exerciseId),
    })),
    recordings: mockPracticeLoopReadModel.recordings.map((recording) => ({
      ...recording,
      pieceId: mapPieceId(recording.pieceId),
      exerciseId: mapExerciseId(recording.exerciseId),
    })),
    smartQueue: mockPracticeLoopReadModel.smartQueue.map((item) => ({
      ...item,
      pieceId: mapPieceId(item.pieceId),
      exerciseId: mapExerciseId(item.exerciseId),
    })),
  };
}

function mergeWithFallback(model: PracticeLoopReadModel): PracticeLoopReadModel {
  const fallback = createNeonCompatibleMockReadModel();
  const isHostedApp = process.env.NETLIFY === "true";
  const visiblePieceAssets = isHostedApp
    ? model.pieceAssets.filter((asset) => asset.storageBucket !== "local-docs")
    : model.pieceAssets;

  return {
    tags: model.tags.length > 0 ? model.tags : fallback.tags,
    pieces: model.pieces.length > 0 ? model.pieces : fallback.pieces,
    exercises: model.exercises.length > 0 ? model.exercises : fallback.exercises,
    lessons: model.lessons,
    lessonRecordings: model.lessonRecordings,
    lessonSegments: model.lessonSegments,
    lessonSegmentTranscripts: model.lessonSegmentTranscripts,
    transcripts: model.transcripts,
    lessonExtracts: model.lessonExtracts,
    practiceTasks: model.practiceTasks,
    pieceAssets:
      visiblePieceAssets.length > 0 || isHostedApp
        ? visiblePieceAssets
        : fallback.pieceAssets,
    practiceSessions:
      model.practiceSessions.length > 0
        ? model.practiceSessions
        : fallback.practiceSessions,
    sessionItems: model.sessionItems,
    recordings: model.recordings,
    smartQueue:
      model.smartQueue.length > 0
        ? model.smartQueue
        : fallback.smartQueue.filter((item) => item.kind !== "lesson_task"),
  };
}

export async function getPracticeLoopReadModel() {
  const repository = createPracticeLoopRepository();
  const model = await repository.getReadModel();

  if (process.env.PRACTICE_LOOP_DATA_SOURCE === "neon") {
    return mergeWithFallback(model);
  }

  return model;
}
