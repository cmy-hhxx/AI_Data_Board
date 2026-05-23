-- Tasks now track an explicit completion progress (0–100) and a free-form
-- progress note. The note is intentionally separate from `blocker`: blocker
-- describes what's in the way, progress_note records what was accomplished
-- in the last progress update.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "progress" integer NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "progress_note" text;
