ALTER TABLE "learning_points" DROP CONSTRAINT "learning_points_precision_valid";--> statement-breakpoint
ALTER TABLE "learning_points" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "transcription_job_chunks" ADD COLUMN "timed_segments" jsonb;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "transcription_provider" text DEFAULT 'openai' NOT NULL;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "transcription_model" text;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD COLUMN "analysis_usage" jsonb;--> statement-breakpoint
ALTER TABLE "learning_points" ADD CONSTRAINT "learning_points_precision_valid" CHECK ("learning_points"."evidence_precision" in ('approximate', 'segment', 'timed'));--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_provider_valid" CHECK ("transcription_jobs"."transcription_provider" in ('openai', 'local-whisper'));