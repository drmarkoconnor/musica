CREATE TYPE "public"."transcription_chunk_status" AS ENUM('pending', 'running', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transcription_job_mode" AS ENUM('selected_segments', 'full_recording');--> statement-breakpoint
CREATE TYPE "public"."transcription_job_status" AS ENUM('queued', 'running', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "transcription_job_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"segment_id" uuid,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"starts_at_seconds" integer NOT NULL,
	"ends_at_seconds" integer NOT NULL,
	"status" "transcription_chunk_status" DEFAULT 'pending' NOT NULL,
	"text" text,
	"model" text,
	"duration_ms" integer,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcription_job_chunks_position_positive" CHECK ("transcription_job_chunks"."position" > 0),
	CONSTRAINT "transcription_job_chunks_start_non_negative" CHECK ("transcription_job_chunks"."starts_at_seconds" >= 0),
	CONSTRAINT "transcription_job_chunks_end_after_start" CHECK ("transcription_job_chunks"."ends_at_seconds" > "transcription_job_chunks"."starts_at_seconds"),
	CONSTRAINT "transcription_job_chunks_duration_ms_positive" CHECK ("transcription_job_chunks"."duration_ms" is null or "transcription_job_chunks"."duration_ms" > 0)
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"transcript_id" uuid,
	"mode" "transcription_job_mode" NOT NULL,
	"status" "transcription_job_status" DEFAULT 'queued' NOT NULL,
	"total_chunks" integer NOT NULL,
	"completed_chunks" integer DEFAULT 0 NOT NULL,
	"selected_segment_count" integer DEFAULT 0 NOT NULL,
	"selected_seconds" integer DEFAULT 0 NOT NULL,
	"full_duration_seconds" integer,
	"current_label" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	CONSTRAINT "transcription_jobs_total_chunks_positive" CHECK ("transcription_jobs"."total_chunks" > 0),
	CONSTRAINT "transcription_jobs_completed_chunks_valid" CHECK ("transcription_jobs"."completed_chunks" >= 0 and "transcription_jobs"."completed_chunks" <= "transcription_jobs"."total_chunks"),
	CONSTRAINT "transcription_jobs_selected_count_non_negative" CHECK ("transcription_jobs"."selected_segment_count" >= 0),
	CONSTRAINT "transcription_jobs_selected_seconds_non_negative" CHECK ("transcription_jobs"."selected_seconds" >= 0),
	CONSTRAINT "transcription_jobs_full_duration_positive" CHECK ("transcription_jobs"."full_duration_seconds" is null or "transcription_jobs"."full_duration_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "transcription_job_chunks" ADD CONSTRAINT "transcription_job_chunks_job_id_transcription_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_job_chunks" ADD CONSTRAINT "transcription_job_chunks_segment_id_lesson_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."lesson_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_job_chunks_job_position_unique_idx" ON "transcription_job_chunks" USING btree ("job_id","position");--> statement-breakpoint
CREATE INDEX "transcription_job_chunks_job_status_idx" ON "transcription_job_chunks" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "transcription_jobs_lesson_recording_idx" ON "transcription_jobs" USING btree ("lesson_id","recording_id","requested_at");--> statement-breakpoint
CREATE INDEX "transcription_jobs_status_idx" ON "transcription_jobs" USING btree ("status");