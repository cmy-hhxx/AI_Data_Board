CREATE TYPE "public"."role" AS ENUM('supervisor', 'pm', 'algorithm', 'annotator', 'crawler', 'intern');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL
);--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "assignee";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_users_id_fk" FOREIGN KEY ("assignee") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
