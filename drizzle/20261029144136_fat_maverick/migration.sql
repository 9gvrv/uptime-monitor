CREATE TABLE "monitors" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"timeout_seconds" double precision DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_monitors_user_id" ON "monitors" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_email" ON "users" ("email");--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;