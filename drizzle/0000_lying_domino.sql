CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('lead_sheet_pdf', 'lead_sheet_image', 'annotated_version');--> statement-breakpoint
CREATE TYPE "public"."exercise_category" AS ENUM('voicing', 'ii-v-i', 'minor_harmony', 'transition', 'ear_training', 'rhythm');--> statement-breakpoint
CREATE TYPE "public"."extract_status" AS ENUM('candidate', 'kept', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('draft', 'recorded', 'transcribed', 'extracted');--> statement-breakpoint
CREATE TYPE "public"."piece_status" AS ENUM('spine', 'learning', 'maintenance', 'parked');--> statement-breakpoint
CREATE TYPE "public"."practice_source" AS ENUM('lesson', 'manual', 'generated');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('new', 'active', 'parked', 'mastered');--> statement-breakpoint
CREATE TYPE "public"."recording_kind" AS ENUM('lesson', 'practice', 'voice_note');--> statement-breakpoint
CREATE TYPE "public"."session_item_status" AS ENUM('queued', 'accepted', 'skipped', 'replaced', 'done');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('pending', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"practice_session_id" uuid,
	"practised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"musical_key" text,
	"tempo" integer,
	"confidence" integer DEFAULT 3 NOT NULL,
	"notes" text,
	CONSTRAINT "exercise_logs_tempo_positive" CHECK ("exercise_logs"."tempo" is null or "exercise_logs"."tempo" > 0),
	CONSTRAINT "exercise_logs_confidence_range" CHECK ("exercise_logs"."confidence" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" "exercise_category" NOT NULL,
	"key_focus" text,
	"confidence" integer DEFAULT 3 NOT NULL,
	"last_practised_on" date,
	"target_tempo" integer,
	"current_tempo" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_confidence_range" CHECK ("exercises"."confidence" between 1 and 5),
	CONSTRAINT "exercises_target_tempo_positive" CHECK ("exercises"."target_tempo" is null or "exercises"."target_tempo" > 0),
	CONSTRAINT "exercises_current_tempo_positive" CHECK ("exercises"."current_tempo" is null or "exercises"."current_tempo" > 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_extract_tags" (
	"lesson_extract_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "lesson_extract_tags_lesson_extract_id_tag_id_pk" PRIMARY KEY("lesson_extract_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_extracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"transcript_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"starts_at_seconds" integer NOT NULL,
	"ends_at_seconds" integer,
	"status" "extract_status" DEFAULT 'candidate' NOT NULL,
	"linked_piece_id" uuid,
	"linked_exercise_id" uuid,
	"similar_extract_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_extracts_start_non_negative" CHECK ("lesson_extracts"."starts_at_seconds" >= 0),
	CONSTRAINT "lesson_extracts_end_after_start" CHECK ("lesson_extracts"."ends_at_seconds" is null or "lesson_extracts"."ends_at_seconds" >= "lesson_extracts"."starts_at_seconds")
);
--> statement-breakpoint
CREATE TABLE "lesson_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" text DEFAULT 'Lesson recording' NOT NULL,
	"storage_bucket" text DEFAULT 'lesson-recordings' NOT NULL,
	"storage_path" text NOT NULL,
	"duration_seconds" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_recordings_duration_positive" CHECK ("lesson_recordings"."duration_seconds" is null or "lesson_recordings"."duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"teacher" text,
	"lesson_date" date NOT NULL,
	"status" "lesson_status" DEFAULT 'draft' NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"title" text NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"version_label" text,
	"storage_bucket" text DEFAULT 'piece-assets' NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piece_exercises" (
	"piece_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	CONSTRAINT "piece_exercises_piece_id_exercise_id_pk" PRIMARY KEY("piece_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "piece_tags" (
	"piece_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "piece_tags_piece_id_tag_id_pk" PRIMARY KEY("piece_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"musical_key" text,
	"status" "piece_status" DEFAULT 'learning' NOT NULL,
	"confidence" integer DEFAULT 3 NOT NULL,
	"last_practised_on" date,
	"target_tempo" integer,
	"current_tempo" integer,
	"spotify_url" text,
	"is_spine_tune" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pieces_confidence_range" CHECK ("pieces"."confidence" between 1 and 5),
	CONSTRAINT "pieces_target_tempo_positive" CHECK ("pieces"."target_tempo" is null or "pieces"."target_tempo" > 0),
	CONSTRAINT "pieces_current_tempo_positive" CHECK ("pieces"."current_tempo" is null or "pieces"."current_tempo" > 0)
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_task_tags" (
	"practice_task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "practice_task_tags_practice_task_id_tag_id_pk" PRIMARY KEY("practice_task_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "practice_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"source" "practice_source" DEFAULT 'manual' NOT NULL,
	"source_lesson_id" uuid,
	"source_extract_id" uuid,
	"linked_piece_id" uuid,
	"linked_exercise_id" uuid,
	"linked_recording_id" uuid,
	"starts_at_seconds" integer,
	"ends_at_seconds" integer,
	"status" "practice_status" DEFAULT 'new' NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"resurfacing_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_tasks_importance_range" CHECK ("practice_tasks"."importance" between 1 and 5),
	CONSTRAINT "practice_tasks_start_non_negative" CHECK ("practice_tasks"."starts_at_seconds" is null or "practice_tasks"."starts_at_seconds" >= 0),
	CONSTRAINT "practice_tasks_end_after_start" CHECK ("practice_tasks"."ends_at_seconds" is null or "practice_tasks"."starts_at_seconds" is null or "practice_tasks"."ends_at_seconds" >= "practice_tasks"."starts_at_seconds")
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "recording_kind" NOT NULL,
	"title" text NOT NULL,
	"storage_bucket" text DEFAULT 'practice-recordings' NOT NULL,
	"storage_path" text NOT NULL,
	"duration_seconds" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lesson_id" uuid,
	"practice_session_id" uuid,
	"piece_id" uuid,
	"exercise_id" uuid,
	"practice_task_id" uuid,
	"spoken_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recordings_duration_positive" CHECK ("recordings"."duration_seconds" is null or "recordings"."duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "session_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"queue_reason" text,
	"status" "session_item_status" DEFAULT 'queued' NOT NULL,
	"practice_task_id" uuid,
	"piece_id" uuid,
	"exercise_id" uuid,
	"override_reason" text,
	"planned_minutes" integer,
	"actual_seconds" integer,
	"confidence_before" integer,
	"confidence_after" integer,
	"tempo" integer,
	"notes" text,
	CONSTRAINT "session_items_planned_minutes_positive" CHECK ("session_items"."planned_minutes" is null or "session_items"."planned_minutes" > 0),
	CONSTRAINT "session_items_actual_seconds_non_negative" CHECK ("session_items"."actual_seconds" is null or "session_items"."actual_seconds" >= 0),
	CONSTRAINT "session_items_confidence_before_range" CHECK ("session_items"."confidence_before" is null or "session_items"."confidence_before" between 1 and 5),
	CONSTRAINT "session_items_confidence_after_range" CHECK ("session_items"."confidence_after" is null or "session_items"."confidence_after" between 1 and 5),
	CONSTRAINT "session_items_tempo_positive" CHECK ("session_items"."tempo" is null or "session_items"."tempo" > 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"status" "transcript_status" DEFAULT 'pending' NOT NULL,
	"text" text,
	"model" text,
	"requested_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcripts_language_supported" CHECK ("transcripts"."language" in ('en', 'it'))
);
--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extract_tags" ADD CONSTRAINT "lesson_extract_tags_lesson_extract_id_lesson_extracts_id_fk" FOREIGN KEY ("lesson_extract_id") REFERENCES "public"."lesson_extracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extract_tags" ADD CONSTRAINT "lesson_extract_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_linked_piece_id_pieces_id_fk" FOREIGN KEY ("linked_piece_id") REFERENCES "public"."pieces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_linked_exercise_id_exercises_id_fk" FOREIGN KEY ("linked_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_similar_extract_id_lesson_extracts_id_fk" FOREIGN KEY ("similar_extract_id") REFERENCES "public"."lesson_extracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_recordings" ADD CONSTRAINT "lesson_recordings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_assets" ADD CONSTRAINT "piece_assets_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_exercises" ADD CONSTRAINT "piece_exercises_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_exercises" ADD CONSTRAINT "piece_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_tags" ADD CONSTRAINT "piece_tags_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_tags" ADD CONSTRAINT "piece_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_task_tags" ADD CONSTRAINT "practice_task_tags_practice_task_id_practice_tasks_id_fk" FOREIGN KEY ("practice_task_id") REFERENCES "public"."practice_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_task_tags" ADD CONSTRAINT "practice_task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_source_lesson_id_lessons_id_fk" FOREIGN KEY ("source_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_source_extract_id_lesson_extracts_id_fk" FOREIGN KEY ("source_extract_id") REFERENCES "public"."lesson_extracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_linked_piece_id_pieces_id_fk" FOREIGN KEY ("linked_piece_id") REFERENCES "public"."pieces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_linked_exercise_id_exercises_id_fk" FOREIGN KEY ("linked_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_linked_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("linked_recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_practice_task_id_practice_tasks_id_fk" FOREIGN KEY ("practice_task_id") REFERENCES "public"."practice_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_practice_session_id_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_practice_task_id_practice_tasks_id_fk" FOREIGN KEY ("practice_task_id") REFERENCES "public"."practice_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_extracts_lesson_id_idx" ON "lesson_extracts" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_recordings_lesson_id_idx" ON "lesson_recordings" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "pieces_spine_last_practised_idx" ON "pieces" USING btree ("is_spine_tune","last_practised_on");--> statement-breakpoint
CREATE INDEX "practice_tasks_status_idx" ON "practice_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "practice_tasks_piece_idx" ON "practice_tasks" USING btree ("linked_piece_id");--> statement-breakpoint
CREATE INDEX "recordings_piece_idx" ON "recordings" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "recordings_practice_task_idx" ON "recordings" USING btree ("practice_task_id");--> statement-breakpoint
CREATE INDEX "session_items_session_position_idx" ON "session_items" USING btree ("practice_session_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "transcripts_lesson_id_idx" ON "transcripts" USING btree ("lesson_id");
