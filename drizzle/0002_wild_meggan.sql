CREATE TYPE "public"."lesson_segment_source" AS ENUM('live_marker', 'post_lesson_review', 'ai_suggestion');--> statement-breakpoint
CREATE TYPE "public"."lesson_segment_status" AS ENUM('selected', 'discarded', 'transcribed');--> statement-breakpoint
CREATE TABLE "lesson_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"title" text DEFAULT 'Teaching segment' NOT NULL,
	"notes" text,
	"starts_at_seconds" integer NOT NULL,
	"ends_at_seconds" integer NOT NULL,
	"status" "lesson_segment_status" DEFAULT 'selected' NOT NULL,
	"source" "lesson_segment_source" DEFAULT 'post_lesson_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_segments_start_non_negative" CHECK ("lesson_segments"."starts_at_seconds" >= 0),
	CONSTRAINT "lesson_segments_end_after_start" CHECK ("lesson_segments"."ends_at_seconds" > "lesson_segments"."starts_at_seconds")
);
--> statement-breakpoint
ALTER TABLE "lesson_segments" ADD CONSTRAINT "lesson_segments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_segments" ADD CONSTRAINT "lesson_segments_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_segments_lesson_id_idx" ON "lesson_segments" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_segments_recording_status_idx" ON "lesson_segments" USING btree ("recording_id","status");