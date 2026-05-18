import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const lessonStatusEnum = pgEnum("lesson_status", [
  "draft",
  "recorded",
  "transcribed",
  "extracted",
]);

export const transcriptStatusEnum = pgEnum("transcript_status", [
  "pending",
  "complete",
  "failed",
]);

export const extractStatusEnum = pgEnum("extract_status", [
  "candidate",
  "kept",
  "discarded",
]);

export const lessonSegmentStatusEnum = pgEnum("lesson_segment_status", [
  "selected",
  "discarded",
  "transcribed",
]);

export const lessonSegmentSourceEnum = pgEnum("lesson_segment_source", [
  "live_marker",
  "post_lesson_review",
  "ai_suggestion",
]);

export const practiceSourceEnum = pgEnum("practice_source", [
  "lesson",
  "manual",
  "generated",
]);

export const practiceStatusEnum = pgEnum("practice_status", [
  "new",
  "active",
  "parked",
  "mastered",
]);

export const pieceStatusEnum = pgEnum("piece_status", [
  "spine",
  "learning",
  "maintenance",
  "parked",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "lead_sheet_pdf",
  "lead_sheet_image",
  "annotated_version",
]);

export const recordingKindEnum = pgEnum("recording_kind", [
  "lesson",
  "practice",
  "voice_note",
]);

export const sessionItemStatusEnum = pgEnum("session_item_status", [
  "queued",
  "accepted",
  "skipped",
  "replaced",
  "done",
]);

export const exerciseCategoryEnum = pgEnum("exercise_category", [
  "voicing",
  "ii-v-i",
  "minor_harmony",
  "transition",
  "ear_training",
  "rhythm",
]);

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  teacher: text("teacher"),
  lessonDate: date("lesson_date", { mode: "string" }).notNull(),
  status: lessonStatusEnum("status").notNull().default("draft"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lessonRecordings = pgTable(
  "lesson_recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Lesson recording"),
    storageBucket: text("storage_bucket").notNull().default("lesson-recordings"),
    storagePath: text("storage_path").notNull(),
    durationSeconds: integer("duration_seconds"),
    recordedAt: timestamp("recorded_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lesson_recordings_lesson_id_idx").on(table.lessonId),
    check(
      "lesson_recordings_duration_positive",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
    ),
  ],
);

export const lessonSegments = pgTable(
  "lesson_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => lessonRecordings.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Teaching segment"),
    notes: text("notes"),
    startsAtSeconds: integer("starts_at_seconds").notNull(),
    endsAtSeconds: integer("ends_at_seconds").notNull(),
    status: lessonSegmentStatusEnum("status").notNull().default("selected"),
    source: lessonSegmentSourceEnum("source")
      .notNull()
      .default("post_lesson_review"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lesson_segments_lesson_id_idx").on(table.lessonId),
    index("lesson_segments_recording_status_idx").on(
      table.recordingId,
      table.status,
    ),
    check("lesson_segments_start_non_negative", sql`${table.startsAtSeconds} >= 0`),
    check(
      "lesson_segments_end_after_start",
      sql`${table.endsAtSeconds} > ${table.startsAtSeconds}`,
    ),
  ],
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => lessonRecordings.id, { onDelete: "cascade" }),
    language: text("language").notNull().default("en"),
    status: transcriptStatusEnum("status").notNull().default("pending"),
    text: text("text"),
    model: text("model"),
    requestedAt: timestamp("requested_at", {
      mode: "string",
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transcripts_lesson_id_idx").on(table.lessonId),
    check("transcripts_language_supported", sql`${table.language} in ('en', 'it')`),
  ],
);

export const pieces = pgTable(
  "pieces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    composer: text("composer"),
    lyricist: text("lyricist"),
    musicalKey: text("musical_key"),
    status: pieceStatusEnum("status").notNull().default("learning"),
    confidence: integer("confidence").notNull().default(3),
    lastPractisedOn: date("last_practised_on", { mode: "string" }),
    targetTempo: integer("target_tempo"),
    currentTempo: integer("current_tempo"),
    spotifyUrl: text("spotify_url"),
    isSpineTune: boolean("is_spine_tune").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pieces_spine_last_practised_idx").on(
      table.isSpineTune,
      table.lastPractisedOn,
    ),
    check("pieces_confidence_range", sql`${table.confidence} between 1 and 5`),
    check(
      "pieces_target_tempo_positive",
      sql`${table.targetTempo} is null or ${table.targetTempo} > 0`,
    ),
    check(
      "pieces_current_tempo_positive",
      sql`${table.currentTempo} is null or ${table.currentTempo} > 0`,
    ),
  ],
);

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    category: exerciseCategoryEnum("category").notNull(),
    keyFocus: text("key_focus"),
    confidence: integer("confidence").notNull().default(3),
    lastPractisedOn: date("last_practised_on", { mode: "string" }),
    targetTempo: integer("target_tempo"),
    currentTempo: integer("current_tempo"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("exercises_confidence_range", sql`${table.confidence} between 1 and 5`),
    check(
      "exercises_target_tempo_positive",
      sql`${table.targetTempo} is null or ${table.targetTempo} > 0`,
    ),
    check(
      "exercises_current_tempo_positive",
      sql`${table.currentTempo} is null or ${table.currentTempo} > 0`,
    ),
  ],
);

export const lessonExtracts = pgTable(
  "lesson_extracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    transcriptId: uuid("transcript_id").references(() => transcripts.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body"),
    startsAtSeconds: integer("starts_at_seconds").notNull(),
    endsAtSeconds: integer("ends_at_seconds"),
    status: extractStatusEnum("status").notNull().default("candidate"),
    linkedPieceId: uuid("linked_piece_id").references(() => pieces.id, {
      onDelete: "set null",
    }),
    linkedExerciseId: uuid("linked_exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    similarExtractId: uuid("similar_extract_id").references(
      (): AnyPgColumn => lessonExtracts.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lesson_extracts_lesson_id_idx").on(table.lessonId),
    check("lesson_extracts_start_non_negative", sql`${table.startsAtSeconds} >= 0`),
    check(
      "lesson_extracts_end_after_start",
      sql`${table.endsAtSeconds} is null or ${table.endsAtSeconds} >= ${table.startsAtSeconds}`,
    ),
  ],
);

export const practiceTasks = pgTable(
  "practice_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body"),
    source: practiceSourceEnum("source").notNull().default("manual"),
    sourceLessonId: uuid("source_lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    sourceExtractId: uuid("source_extract_id").references(() => lessonExtracts.id, {
      onDelete: "set null",
    }),
    linkedPieceId: uuid("linked_piece_id").references(() => pieces.id, {
      onDelete: "set null",
    }),
    linkedExerciseId: uuid("linked_exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    linkedRecordingId: uuid("linked_recording_id").references(
      () => lessonRecordings.id,
      { onDelete: "set null" },
    ),
    startsAtSeconds: integer("starts_at_seconds"),
    endsAtSeconds: integer("ends_at_seconds"),
    status: practiceStatusEnum("status").notNull().default("new"),
    importance: integer("importance").notNull().default(3),
    resurfacingScore: numeric("resurfacing_score", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("practice_tasks_status_idx").on(table.status),
    index("practice_tasks_piece_idx").on(table.linkedPieceId),
    check("practice_tasks_importance_range", sql`${table.importance} between 1 and 5`),
    check(
      "practice_tasks_start_non_negative",
      sql`${table.startsAtSeconds} is null or ${table.startsAtSeconds} >= 0`,
    ),
    check(
      "practice_tasks_end_after_start",
      sql`${table.endsAtSeconds} is null or ${table.startsAtSeconds} is null or ${table.endsAtSeconds} >= ${table.startsAtSeconds}`,
    ),
  ],
);

export const pieceAssets = pgTable("piece_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  pieceId: uuid("piece_id")
    .notNull()
    .references(() => pieces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  assetType: assetTypeEnum("asset_type").notNull(),
  versionLabel: text("version_label"),
  storageBucket: text("storage_bucket").notNull().default("piece-assets"),
  storagePath: text("storage_path").notNull(),
  uploadedAt: timestamp("uploaded_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const practiceSessions = pgTable("practice_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { mode: "string", withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionItems = pgTable(
  "session_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    queueReason: text("queue_reason"),
    status: sessionItemStatusEnum("status").notNull().default("queued"),
    practiceTaskId: uuid("practice_task_id").references(() => practiceTasks.id, {
      onDelete: "set null",
    }),
    pieceId: uuid("piece_id").references(() => pieces.id, {
      onDelete: "set null",
    }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    overrideReason: text("override_reason"),
    plannedMinutes: integer("planned_minutes"),
    actualSeconds: integer("actual_seconds"),
    confidenceBefore: integer("confidence_before"),
    confidenceAfter: integer("confidence_after"),
    tempo: integer("tempo"),
    notes: text("notes"),
  },
  (table) => [
    index("session_items_session_position_idx").on(
      table.practiceSessionId,
      table.position,
    ),
    check(
      "session_items_planned_minutes_positive",
      sql`${table.plannedMinutes} is null or ${table.plannedMinutes} > 0`,
    ),
    check(
      "session_items_actual_seconds_non_negative",
      sql`${table.actualSeconds} is null or ${table.actualSeconds} >= 0`,
    ),
    check(
      "session_items_confidence_before_range",
      sql`${table.confidenceBefore} is null or ${table.confidenceBefore} between 1 and 5`,
    ),
    check(
      "session_items_confidence_after_range",
      sql`${table.confidenceAfter} is null or ${table.confidenceAfter} between 1 and 5`,
    ),
    check(
      "session_items_tempo_positive",
      sql`${table.tempo} is null or ${table.tempo} > 0`,
    ),
  ],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: recordingKindEnum("kind").notNull(),
    title: text("title").notNull(),
    storageBucket: text("storage_bucket").notNull().default("practice-recordings"),
    storagePath: text("storage_path").notNull(),
    durationSeconds: integer("duration_seconds"),
    recordedAt: timestamp("recorded_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    practiceSessionId: uuid("practice_session_id").references(
      () => practiceSessions.id,
      { onDelete: "set null" },
    ),
    pieceId: uuid("piece_id").references(() => pieces.id, {
      onDelete: "set null",
    }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    practiceTaskId: uuid("practice_task_id").references(() => practiceTasks.id, {
      onDelete: "set null",
    }),
    spokenNote: text("spoken_note"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("recordings_piece_idx").on(table.pieceId),
    index("recordings_practice_task_idx").on(table.practiceTaskId),
    check(
      "recordings_duration_positive",
      sql`${table.durationSeconds} is null or ${table.durationSeconds} > 0`,
    ),
  ],
);

export const exerciseLogs = pgTable(
  "exercise_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    practiceSessionId: uuid("practice_session_id").references(
      () => practiceSessions.id,
      { onDelete: "set null" },
    ),
    practisedAt: timestamp("practised_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    musicalKey: text("musical_key"),
    tempo: integer("tempo"),
    confidence: integer("confidence").notNull().default(3),
    notes: text("notes"),
  },
  (table) => [
    check(
      "exercise_logs_tempo_positive",
      sql`${table.tempo} is null or ${table.tempo} > 0`,
    ),
    check(
      "exercise_logs_confidence_range",
      sql`${table.confidence} between 1 and 5`,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color").notNull().default("slate"),
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("tags_name_unique_idx").on(table.name)],
);

export const practiceTaskTags = pgTable(
  "practice_task_tags",
  {
    practiceTaskId: uuid("practice_task_id")
      .notNull()
      .references(() => practiceTasks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.practiceTaskId, table.tagId] })],
);

export const lessonExtractTags = pgTable(
  "lesson_extract_tags",
  {
    lessonExtractId: uuid("lesson_extract_id")
      .notNull()
      .references(() => lessonExtracts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.lessonExtractId, table.tagId] })],
);

export const pieceTags = pgTable(
  "piece_tags",
  {
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.pieceId, table.tagId] })],
);

export const pieceExercises = pgTable(
  "piece_exercises",
  {
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.pieceId, table.exerciseId] })],
);

export type LessonRow = typeof lessons.$inferSelect;
export type NewLessonRow = typeof lessons.$inferInsert;
export type LessonRecordingRow = typeof lessonRecordings.$inferSelect;
export type NewLessonRecordingRow = typeof lessonRecordings.$inferInsert;
export type LessonSegmentRow = typeof lessonSegments.$inferSelect;
export type NewLessonSegmentRow = typeof lessonSegments.$inferInsert;
export type TranscriptRow = typeof transcripts.$inferSelect;
export type NewTranscriptRow = typeof transcripts.$inferInsert;
export type LessonExtractRow = typeof lessonExtracts.$inferSelect;
export type NewLessonExtractRow = typeof lessonExtracts.$inferInsert;
export type PieceRow = typeof pieces.$inferSelect;
export type NewPieceRow = typeof pieces.$inferInsert;
export type PieceAssetRow = typeof pieceAssets.$inferSelect;
export type NewPieceAssetRow = typeof pieceAssets.$inferInsert;
export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type PracticeTaskRow = typeof practiceTasks.$inferSelect;
export type NewPracticeTaskRow = typeof practiceTasks.$inferInsert;
export type PracticeSessionRow = typeof practiceSessions.$inferSelect;
export type NewPracticeSessionRow = typeof practiceSessions.$inferInsert;
export type SessionItemRow = typeof sessionItems.$inferSelect;
export type NewSessionItemRow = typeof sessionItems.$inferInsert;
export type RecordingRow = typeof recordings.$inferSelect;
export type NewRecordingRow = typeof recordings.$inferInsert;
export type ExerciseLogRow = typeof exerciseLogs.$inferSelect;
export type NewExerciseLogRow = typeof exerciseLogs.$inferInsert;
export type TagRow = typeof tags.$inferSelect;
export type NewTagRow = typeof tags.$inferInsert;
export type PieceExerciseRow = typeof pieceExercises.$inferSelect;
