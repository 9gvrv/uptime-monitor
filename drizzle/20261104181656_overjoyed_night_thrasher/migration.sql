CREATE TABLE "health_checks" (
	"id" serial PRIMARY KEY,
	"monitor_id" integer NOT NULL,
	"status_code" integer,
	"latency_ms" double precision,
	"is_up" boolean NOT NULL,
	"error_message" varchar(2048),
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" DROP COLUMN "timeout_seconds";--> statement-breakpoint
CREATE INDEX "ix_health_checks_monitor_id" ON "health_checks" ("monitor_id","checked_at");--> statement-breakpoint
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_monitor_id_monitors_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE;