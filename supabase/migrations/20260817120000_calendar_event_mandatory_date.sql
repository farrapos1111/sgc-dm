-- Optional link from calendar events to an org mandatory date.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS org_mandatory_date_id uuid
    REFERENCES public.org_mandatory_dates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS calendar_events_org_mandatory_date_idx
  ON public.calendar_events (chapter_id, org_mandatory_date_id)
  WHERE org_mandatory_date_id IS NOT NULL;
