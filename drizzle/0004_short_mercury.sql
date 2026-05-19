ALTER TABLE "practice_tasks" ADD COLUMN "confidence" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD COLUMN "last_practised_on" date;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD COLUMN "target_frequency_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
CREATE INDEX "practice_tasks_last_practised_idx" ON "practice_tasks" USING btree ("last_practised_on");--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_confidence_range" CHECK ("practice_tasks"."confidence" between 1 and 5);--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_target_frequency_positive" CHECK ("practice_tasks"."target_frequency_days" > 0);