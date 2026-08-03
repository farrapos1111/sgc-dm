-- Cascade votes when sindicancia_details is removed (calendar-event cleanup).

ALTER TABLE public.sindicancia_votes
  DROP CONSTRAINT IF EXISTS sindicancia_votes_event_chapter_fkey;

ALTER TABLE public.sindicancia_votes
  ADD CONSTRAINT sindicancia_votes_event_chapter_fkey
  FOREIGN KEY (calendar_event_id, chapter_id)
  REFERENCES public.sindicancia_details (calendar_event_id, chapter_id)
  ON DELETE CASCADE;
