ALTER TYPE public.calendar_event_type ADD VALUE IF NOT EXISTS 'entretenimento';

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS mandatory boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('presente','ausente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  calendar_event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'ausente',
  justification text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_event_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON public.attendance_records
  FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "attendance_write" ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','consultor','presidente_conselho']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','consultor','presidente_conselho']));

CREATE TRIGGER attendance_records_set_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.session_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  calendar_event_id uuid NOT NULL UNIQUE REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_minutes TO authenticated;
GRANT ALL ON public.session_minutes TO service_role;
ALTER TABLE public.session_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minutes_select" ON public.session_minutes
  FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "minutes_write" ON public.session_minutes
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','consultor','presidente_conselho']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','consultor','presidente_conselho']));

CREATE TRIGGER session_minutes_set_updated_at
  BEFORE UPDATE ON public.session_minutes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS attendance_records_member_idx ON public.attendance_records(member_id);
CREATE INDEX IF NOT EXISTS attendance_records_event_idx ON public.attendance_records(calendar_event_id);
CREATE INDEX IF NOT EXISTS calendar_events_chapter_start_idx ON public.calendar_events(chapter_id, start_at);