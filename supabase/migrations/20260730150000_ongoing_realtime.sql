-- Realtime para chamada (presenças) e ata em andamento
DO $$
BEGIN
  -- Verifica a publication antes de qualquer alteração relacionada a ela.
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'Publication supabase_realtime não existe; pulando ADD TABLE.';
  ELSE
    BEGIN
      IF to_regclass('public.attendance_records') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      IF to_regclass('public.session_minutes') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.session_minutes;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      IF to_regclass('public.minute_approvals') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.minute_approvals;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;

  -- Replica identity: não interrompe se a tabela ainda não existir
  BEGIN
    ALTER TABLE IF EXISTS public.attendance_records REPLICA IDENTITY FULL;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.session_minutes REPLICA IDENTITY FULL;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.minute_approvals REPLICA IDENTITY FULL;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;
END $$;
