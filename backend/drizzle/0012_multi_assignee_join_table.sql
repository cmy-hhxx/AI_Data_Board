-- Multi-assignee: create join table and migrate data
-- Phase 1: Create the join table and populate it (old column stays for now)

-- Step 1: Create join table
CREATE TABLE IF NOT EXISTS "task_assignees" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "unique_task_user" UNIQUE("task_id", "user_id")
);

-- Step 2: Insert missing users from concatenated assignee strings
INSERT INTO "users" ("id", "name", "role")
SELECT gen_random_uuid(), trimmed_name, 'annotator'
FROM (
  SELECT DISTINCT trim(name_part) AS trimmed_name
  FROM "tasks",
  LATERAL regexp_split_to_table("assignee", '[\s,、]+') AS name_part
  WHERE "assignee" IS NOT NULL AND "assignee" != ''
) sub
WHERE trimmed_name != ''
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."name" = sub.trimmed_name);

-- Step 3: Create join records
INSERT INTO "task_assignees" ("task_id", "user_id")
SELECT DISTINCT t."id", u."id"
FROM "tasks" t,
LATERAL regexp_split_to_table(t."assignee", '[\s,、]+') AS name_part
JOIN "users" u ON u."name" = trim(name_part)
WHERE t."assignee" IS NOT NULL AND trim(name_part) != ''
ON CONFLICT DO NOTHING;

-- NOTE: Do NOT drop tasks.assignee yet — deploy the new code first,
-- then run the cleanup migration (0013) to drop the old column.
