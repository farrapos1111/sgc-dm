ALTER TABLE public.member_positions
  DROP CONSTRAINT IF EXISTS member_positions_chapter_id_position_id_term_year_term_seme_key;

CREATE UNIQUE INDEX IF NOT EXISTS member_positions_unique_single_seat
  ON public.member_positions (chapter_id, position_id, term_year, term_semester)
  WHERE position_id <> 25;

CREATE UNIQUE INDEX IF NOT EXISTS member_positions_unique_multi_seat
  ON public.member_positions (chapter_id, position_id, member_id, term_year, term_semester);