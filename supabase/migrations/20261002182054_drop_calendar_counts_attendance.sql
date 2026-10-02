-- A marca "não conta" passou a ser o próprio facultativo (mandatory = false).

ALTER TABLE public.calendar_events
  DROP COLUMN IF EXISTS counts_attendance;
