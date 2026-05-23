-- The single progress percentage + single note field on tasks (introduced in
-- 0008) are replaced by a proper notes history table. Each row is one update
-- ("completed 30%, API hooked up"), timestamped. Drop the legacy columns —
-- 0008 hadn't been in production use.

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "progress";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "progress_note";

CREATE TABLE IF NOT EXISTS "task_progress_notes" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "task_id" uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "task_progress_notes_task_id_idx" ON "task_progress_notes" ("task_id");
