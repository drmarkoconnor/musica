import {
  exercises,
  lessonExtracts,
  lessonRecordings,
  lessonSegments,
  lessons,
  pieceAssets,
  pieces,
  practiceSessions,
  practiceTasks,
  recordings,
  sessionItems,
  smartQueue,
  tags,
  transcripts,
} from "@/lib/mock-data";
import type {
  PracticeLoopReadModel,
  PracticeLoopRepository,
} from "./practice-loop-repository";

export const mockPracticeLoopReadModel: PracticeLoopReadModel = {
  tags,
  pieces,
  exercises,
  lessons,
  lessonRecordings,
  lessonSegments,
  transcripts,
  lessonExtracts,
  practiceTasks,
  pieceAssets,
  practiceSessions,
  sessionItems,
  recordings,
  smartQueue,
};

export const mockPracticeLoopRepository: PracticeLoopRepository = {
  async getReadModel() {
    return mockPracticeLoopReadModel;
  },
  async listPieces() {
    return pieces;
  },
  async listPracticeTasks() {
    return practiceTasks;
  },
  async listLessons() {
    return lessons;
  },
  async listExercises() {
    return exercises;
  },
};
