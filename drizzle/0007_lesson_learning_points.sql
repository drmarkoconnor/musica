CREATE TABLE "learning_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"analysis_run_id" uuid,
	"source_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'teaching' NOT NULL,
	"practice_action" text,
	"starts_at_seconds" integer NOT NULL,
	"ends_at_seconds" integer NOT NULL,
	"evidence_precision" text DEFAULT 'approximate' NOT NULL,
	"evidence_text" text,
	"status" "extract_status" DEFAULT 'candidate' NOT NULL,
	"practice_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_points_range_valid" CHECK ("learning_points"."starts_at_seconds" >= 0 and "learning_points"."ends_at_seconds" > "learning_points"."starts_at_seconds"),
	CONSTRAINT "learning_points_kind_valid" CHECK ("learning_points"."kind" in ('teaching', 'practice', 'repertoire', 'decision')),
	CONSTRAINT "learning_points_precision_valid" CHECK ("learning_points"."evidence_precision" in ('approximate', 'segment'))
);
--> statement-breakpoint
ALTER TABLE "transcription_jobs" DROP CONSTRAINT "transcription_jobs_total_chunks_positive";--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD COLUMN "analysis_run_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD COLUMN "source_key" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "analysis_result" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "analysis_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learning_points" ADD CONSTRAINT "learning_points_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_points" ADD CONSTRAINT "learning_points_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_points" ADD CONSTRAINT "learning_points_analysis_run_id_transcription_jobs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_points" ADD CONSTRAINT "learning_points_practice_task_id_practice_tasks_id_fk" FOREIGN KEY ("practice_task_id") REFERENCES "public"."practice_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_points_lesson_idx" ON "learning_points" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "learning_points_recording_idx" ON "learning_points" USING btree ("recording_id");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_points_run_source_unique_idx" ON "learning_points" USING btree ("analysis_run_id","source_key");--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_analysis_run_id_transcription_jobs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."transcription_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_extracts_run_source_unique_idx" ON "lesson_extracts" USING btree ("analysis_run_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_jobs_request_key_unique_idx" ON "transcription_jobs" USING btree ("request_key");--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_analysis_status_valid" CHECK ("transcription_jobs"."analysis_status" in ('pending', 'running', 'complete', 'failed'));--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_total_chunks_positive" CHECK ("transcription_jobs"."total_chunks" >= 0);
--> statement-breakpoint
UPDATE "transcription_jobs" SET "analysis_status" = CASE WHEN "status" = 'complete' AND "error_message" IS NOT NULL THEN 'failed' WHEN "status" = 'complete' THEN 'complete' ELSE 'pending' END;
--> statement-breakpoint
UPDATE "transcription_jobs" SET "status" = 'failed', "completed_at" = NULL WHERE "analysis_status" = 'failed';
