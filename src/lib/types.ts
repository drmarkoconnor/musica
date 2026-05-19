export type Locale = "en" | "it";

export type LessonStatus = "draft" | "recorded" | "transcribed" | "extracted";

export type ExtractStatus = "candidate" | "kept" | "discarded";

export type LessonSegmentStatus = "selected" | "discarded" | "transcribed";

export type LessonSegmentSource =
  | "live_marker"
  | "post_lesson_review"
  | "ai_suggestion";

export type PracticeStatus = "new" | "active" | "parked" | "mastered";

export type PracticeSource = "lesson" | "manual" | "generated";

export type PieceStatus = "spine" | "learning" | "maintenance" | "parked";

export type RecordingKind = "lesson" | "practice" | "voice_note";

export type AssetType = "lead_sheet_pdf" | "lead_sheet_image" | "annotated_version";

export type SessionItemStatus = "queued" | "accepted" | "skipped" | "replaced" | "done";

export type ExerciseCategory =
  | "voicing"
  | "ii-v-i"
  | "minor_harmony"
  | "transition"
  | "ear_training"
  | "rhythm";

export type Confidence = 1 | 2 | 3 | 4 | 5;

export type Tag = {
  id: string;
  name: string;
  color: "green" | "blue" | "amber" | "rose" | "slate";
};

export type Lesson = {
  id: string;
  title: string;
  teacher: string;
  lessonDate: string;
  status: LessonStatus;
  summary: string;
};

export type LessonRecording = {
  id: string;
  lessonId: string;
  title: string;
  storageBucket: string;
  durationSeconds: number;
  recordedAt: string;
  storagePath: string;
};

export type LessonSegment = {
  id: string;
  lessonId: string;
  recordingId: string;
  title: string;
  notes: string;
  startsAtSeconds: number;
  endsAtSeconds: number;
  status: LessonSegmentStatus;
  source: LessonSegmentSource;
};

export type Transcript = {
  id: string;
  lessonId: string;
  recordingId: string;
  language: Locale;
  status: "pending" | "complete" | "failed";
  text: string;
};

export type LessonSegmentTranscript = {
  id: string;
  lessonId: string;
  recordingId: string;
  segmentId: string;
  transcriptId?: string;
  language: Locale;
  status: "pending" | "complete" | "failed";
  text: string;
  summaryTitle: string;
  summaryBody: string;
};

export type LessonExtract = {
  id: string;
  lessonId: string;
  segmentId?: string;
  transcriptId: string;
  title: string;
  body: string;
  startsAtSeconds: number;
  endsAtSeconds?: number;
  status: ExtractStatus;
  tags: string[];
  linkedPieceId?: string;
  linkedExerciseId?: string;
  similarExtractId?: string;
};

export type PracticeTask = {
  id: string;
  title: string;
  body: string;
  source: PracticeSource;
  sourceLessonId?: string;
  sourceExtractId?: string;
  linkedPieceId?: string;
  linkedExerciseId?: string;
  linkedRecordingId?: string;
  startsAtSeconds?: number;
  endsAtSeconds?: number;
  tags: string[];
  status: PracticeStatus;
  resurfacingScore: number;
  createdAt: string;
};

export type Piece = {
  id: string;
  title: string;
  composer?: string;
  lyricist?: string;
  key: string;
  status: PieceStatus;
  confidence: Confidence;
  lastPractised: string;
  targetTempo: number;
  currentTempo: number;
  spotifyUrl?: string;
  isSpineTune: boolean;
  notes: string;
  relatedExerciseIds: string[];
};

export type PieceAsset = {
  id: string;
  pieceId: string;
  title: string;
  type: AssetType;
  versionLabel: string;
  uploadedAt: string;
  storageBucket: string;
  storagePath: string;
};

export type Exercise = {
  id: string;
  title: string;
  category: ExerciseCategory;
  keyFocus: string;
  confidence: Confidence;
  lastPractised: string;
  targetTempo?: number;
  currentTempo?: number;
  notes: string;
};

export type PracticeSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  notes: string;
};

export type SessionItem = {
  id: string;
  sessionId: string;
  position: number;
  title: string;
  reason: string;
  status: SessionItemStatus;
  practiceTaskId?: string;
  pieceId?: string;
  exerciseId?: string;
  plannedMinutes: number;
  confidenceBefore?: Confidence;
  confidenceAfter?: Confidence;
  tempo?: number;
};

export type Recording = {
  id: string;
  kind: RecordingKind;
  title: string;
  durationSeconds: number;
  recordedAt: string;
  storagePath: string;
  lessonId?: string;
  practiceSessionId?: string;
  pieceId?: string;
  exerciseId?: string;
  practiceTaskId?: string;
  spokenNote?: string;
};

export type ExerciseLog = {
  id: string;
  exerciseId: string;
  sessionId?: string;
  practisedAt: string;
  tempo?: number;
  confidence: Confidence;
  notes: string;
};

export type SmartQueueItem = {
  id: string;
  title: string;
  kind: "piece" | "exercise" | "lesson_task";
  reason: string;
  minutes: number;
  confidence?: Confidence;
  taskId?: string;
  pieceId?: string;
  exerciseId?: string;
};
