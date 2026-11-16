CREATE TYPE "check_status" AS ENUM('up', 'down', 'degraded');--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "status" "check_status";--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "final_url" text;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "redirect_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "ttfb_ms" integer;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "total_ms" integer;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "error_type" text;--> statement-breakpoint
ALTER TABLE "health_checks" ADD COLUMN "region" text;--> statement-breakpoint
UPDATE "health_checks" SET "status" = CASE WHEN "is_up" THEN 'up'::"check_status" ELSE 'down'::"check_status" END WHERE "status" IS NULL;--> statement-breakpoint
UPDATE "health_checks" SET "total_ms" = COALESCE(ROUND("latency_ms")::integer, 0) WHERE "total_ms" IS NULL;--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "total_ms" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "status_code" SET DATA TYPE smallint USING "status_code"::smallint;--> statement-breakpoint
ALTER TABLE "health_checks" DROP COLUMN "latency_ms";--> statement-breakpoint
ALTER TABLE "health_checks" DROP COLUMN "is_up";
