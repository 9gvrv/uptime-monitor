CREATE TABLE "groups" (
	"id" serial PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "health_checks" ALTER COLUMN "error_message" SET DATA TYPE text USING "error_message"::text;--> statement-breakpoint
CREATE INDEX "idx_groups_user_id" ON "groups" ("user_id");--> statement-breakpoint
CREATE INDEX "ix_monitors_group_id" ON "monitors" ("group_id");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL;