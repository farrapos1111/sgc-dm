-- Realtime para chamada (presenças) e ata em andamento
ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.session_minutes REPLICA IDENTITY FULL;
ALTER TABLE public.minute_approvals REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_minutes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.minute_approvals;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
