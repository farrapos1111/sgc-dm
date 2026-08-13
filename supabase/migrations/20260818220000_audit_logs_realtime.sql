-- Audit logs no Realtime (live) do banco.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      IF to_regclass('public.audit_logs') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime não existe; pulando ADD TABLE.';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.audit_logs REPLICA IDENTITY FULL;
