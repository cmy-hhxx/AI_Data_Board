-- Cleanup: drop the old assignee text column after new code is deployed
-- Run this ONLY after confirming the new multi-assignee system works correctly

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "assignee";
