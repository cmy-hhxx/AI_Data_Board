ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assignee_users_id_fk";
ALTER TABLE "tasks" ALTER COLUMN "assignee" TYPE text USING "assignee"::text;
UPDATE "tasks" t SET "assignee" = u."name" FROM "users" u WHERE t."assignee" = u."id"::text;
