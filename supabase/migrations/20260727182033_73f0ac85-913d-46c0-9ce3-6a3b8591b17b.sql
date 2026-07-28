
CREATE TYPE public.calendar_event_type AS ENUM ('sessao', 'evento', 'filantropia');

CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type public.calendar_event_type NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  description text,
  related_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_chapter_start ON public.calendar_events (chapter_id, start_at);
CREATE INDEX idx_calendar_events_related_event ON public.calendar_events (related_event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

CREATE POLICY calendar_events_insert ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_chapter_member(chapter_id));

CREATE POLICY calendar_events_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_regional']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_regional']));

CREATE POLICY calendar_events_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_regional']));

CREATE TRIGGER tg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
