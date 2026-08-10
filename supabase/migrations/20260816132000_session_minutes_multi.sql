-- Allow multiple session minutes (atas) per calendar event.
ALTER TABLE public.session_minutes DROP CONSTRAINT IF EXISTS session_minutes_calendar_event_id_key;
DROP INDEX IF EXISTS session_minutes_calendar_event_id_key;
CREATE INDEX IF NOT EXISTS session_minutes_calendar_event_id_idx
  ON public.session_minutes (calendar_event_id);
