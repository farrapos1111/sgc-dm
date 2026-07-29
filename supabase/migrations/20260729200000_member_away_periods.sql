-- Períodos em que o membro esteve irregular/afastado (mensalidades = desligado)
CREATE TABLE public.member_away_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  started_on date NOT NULL,
  ended_on date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_away_periods_range CHECK (ended_on IS NULL OR ended_on >= started_on)
);

CREATE INDEX member_away_periods_member_idx ON public.member_away_periods (member_id);
CREATE INDEX member_away_periods_chapter_idx ON public.member_away_periods (chapter_id);
-- No máximo um período aberto por membro
CREATE UNIQUE INDEX member_away_periods_one_open
  ON public.member_away_periods (member_id)
  WHERE ended_on IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_away_periods TO authenticated;
GRANT ALL ON public.member_away_periods TO service_role;

ALTER TABLE public.member_away_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_away_select ON public.member_away_periods
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

CREATE POLICY member_away_write ON public.member_away_periods
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'secretaria'))
  WITH CHECK (public.has_permission(chapter_id, 'secretaria'));

-- Marca mensalidades em aberto (sem caixa) como desligado a partir de uma competência
CREATE OR REPLACE FUNCTION public.desligar_open_dues_from(
  _member_id uuid,
  _from date
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter uuid;
  v_count integer;
BEGIN
  SELECT chapter_id INTO v_chapter FROM public.members WHERE id = _member_id;
  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;
  IF NOT public.has_permission(v_chapter, 'secretaria')
     AND NOT public.has_permission(v_chapter, 'tesouraria') THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.member_dues
     SET status = 'desligado',
         paid_at = NULL,
         updated_at = now()
   WHERE member_id = _member_id
     AND chapter_id = v_chapter
     AND status = 'em_aberto'
     AND cash_entry_id IS NULL
     AND (
       competence_year > extract(year from _from)::int
       OR (
         competence_year = extract(year from _from)::int
         AND competence_month >= extract(month from _from)::int
       )
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.desligar_open_dues_from(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desligar_open_dues_from(uuid, date) TO authenticated, service_role;
