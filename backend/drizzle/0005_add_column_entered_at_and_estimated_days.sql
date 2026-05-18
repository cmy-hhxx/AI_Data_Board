ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "column_entered_at" timestamp with time zone;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_days" integer;
DROP TABLE IF EXISTS "task_tags" CASCADE;
DROP TABLE IF EXISTS "tags" CASCADE;
