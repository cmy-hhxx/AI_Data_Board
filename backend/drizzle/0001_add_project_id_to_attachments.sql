ALTER TABLE "attachments" ADD COLUMN "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attachments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE "attachments" ALTER COLUMN "task_id" DROP NOT NULL;
