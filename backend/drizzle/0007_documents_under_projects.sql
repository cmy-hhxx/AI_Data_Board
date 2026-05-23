-- Documents now hang directly off projects; the standalone knowledge_bases
-- concept is removed in favor of using the board's existing project list.
-- Destructive: any rows in `documents` / `knowledge_bases` are dropped, since
-- the new schema has no way to back-fill project_id from a knowledge_base_id.

DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "knowledge_bases" CASCADE;

CREATE TABLE "documents" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "name" text NOT NULL,
  "url" text,
  "content" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
