CREATE TABLE "lesson_segment_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"transcript_id" uuid,
	"language" text DEFAULT 'en' NOT NULL,
	"status" "transcript_status" DEFAULT 'pending' NOT NULL,
	"text" text,
	"summary_title" text,
	"summary_body" text,
	"model" text,
	"requested_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_segment_transcripts_language_supported" CHECK ("lesson_segment_transcripts"."language" in ('en', 'it'))
);
--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD COLUMN "segment_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_segment_transcripts" ADD CONSTRAINT "lesson_segment_transcripts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_segment_transcripts" ADD CONSTRAINT "lesson_segment_transcripts_recording_id_lesson_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."lesson_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_segment_transcripts" ADD CONSTRAINT "lesson_segment_transcripts_segment_id_lesson_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."lesson_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_segment_transcripts" ADD CONSTRAINT "lesson_segment_transcripts_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_segment_transcripts_lesson_id_idx" ON "lesson_segment_transcripts" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_segment_transcripts_segment_id_unique_idx" ON "lesson_segment_transcripts" USING btree ("segment_id");--> statement-breakpoint
ALTER TABLE "lesson_extracts" ADD CONSTRAINT "lesson_extracts_segment_id_lesson_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."lesson_segments"("id") ON DELETE set null ON UPDATE no action;