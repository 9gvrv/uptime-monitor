ALTER TABLE "monitors" ADD COLUMN "interval_seconds" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "timeout_ms" integer DEFAULT 5000 NOT NULL;