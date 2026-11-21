ALTER TABLE "monitors" ADD COLUMN "next_check_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ix_monitors_next_check_at" ON "monitors" ("next_check_at");