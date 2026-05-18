import type {
  Exercise,
  Lesson,
  LessonExtract,
  LessonRecording,
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

export type PracticeLoopReadModel = {
  tags: Tag[];
  pieces: Piece[];
  exercises: Exercise[];
  lessons: Lesson[];
  lessonRecordings: LessonRecording[];
  transcripts: Transcript[];
  lessonExtracts: LessonExtract[];
  practiceTasks: PracticeTask[];
  pieceAssets: PieceAsset[];
  practiceSessions: PracticeSession[];
  sessionItems: SessionItem[];
  recordings: Recording[];
  smartQueue: SmartQueueItem[];
};

export type PracticeLoopRepository = {
  getReadModel: () => Promise<PracticeLoopReadModel>;
  listPieces: () => Promise<Piece[]>;
  listPracticeTasks: () => Promise<PracticeTask[]>;
  listLessons: () => Promise<Lesson[]>;
  listExercises: () => Promise<Exercise[]>;
};

export type PracticeLoopDataSource = "mock" | "neon";
