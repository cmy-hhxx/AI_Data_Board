-- Repair schema drift where code expects documents.project_id but an older
-- database still has documents.knowledge_base_id.

DO $$
DECLARE
  fk_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'project_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.documents d
      LEFT JOIN public.projects p ON p.id = d.knowledge_base_id
      WHERE p.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot auto-repair documents schema: knowledge_base_id values do not match projects.id';
    END IF;

    FOR fk_name IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN unnest(con.conkey) AS key(attnum) ON TRUE
      JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = key.attnum
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'documents'
        AND con.contype = 'f'
        AND attr.attname = 'knowledge_base_id'
    LOOP
      EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', fk_name);
    END LOOP;

    ALTER TABLE public.documents RENAME COLUMN knowledge_base_id TO project_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'documents'
      AND column_name = 'project_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'documents'
      AND ref.relname = 'projects'
      AND con.contype = 'f'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_project_id_projects_id_fk
      FOREIGN KEY (project_id) REFERENCES public.projects(id)
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END
$$;

DROP TABLE IF EXISTS public.knowledge_bases;