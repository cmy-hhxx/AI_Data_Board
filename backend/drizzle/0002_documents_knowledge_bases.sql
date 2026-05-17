DROP TABLE IF EXISTS "attachments" CASCADE;

CREATE TABLE "knowledge_bases" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "documents" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "knowledge_base_id" uuid NOT NULL REFERENCES "public"."knowledge_bases"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "name" text NOT NULL,
  "url" text,
  "content" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "description";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "due_date";
