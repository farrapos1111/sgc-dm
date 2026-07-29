-- Inclusão manual de membros no calendário de mensalidades (por ano)
CREATE TABLE public.member_dues_manual_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year integer NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, member_id, year)
);

CREATE INDEX member_dues_manual_inclusions_chapter_year_idx
  ON public.member_dues_manual_inclusions (chapter_id, year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_dues_manual_inclusions TO authenticated;
GRANT ALL ON public.member_dues_manual_inclusions TO service_role;

ALTER TABLE public.member_dues_manual_inclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dues_manual_inc_select ON public.member_dues_manual_inclusions
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

CREATE POLICY dues_manual_inc_write ON public.member_dues_manual_inclusions
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria'))
  WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));

-- Link público: inclui membros manuais do ano
CREATE OR REPLACE FUNCTION public.get_public_year_dues(_token text, _year integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(_token), '');
  v_chapter public.chapters%ROWTYPE;
  v_default numeric;
  v_members jsonb;
  v_dues jsonb;
BEGIN
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE settings->>'dues_share_token' = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  v_default := coalesce(
    nullif(v_chapter.settings->>'default_dues_amount', '')::numeric,
    50
  );

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'status', m.status,
      'kind', m.kind,
      'birth_date', m.birth_date,
      'iniciacao_ordem', m.iniciacao_ordem,
      'manualInclude', EXISTS (
        SELECT 1 FROM public.member_dues_manual_inclusions i
        WHERE i.member_id = m.id AND i.chapter_id = v_chapter.id AND i.year = _year
      )
    ) ORDER BY m.full_name
  ), '[]'::jsonb)
  INTO v_members
  FROM public.members m
  WHERE m.chapter_id = v_chapter.id
    AND (
      (
        m.status = 'regular'
        AND m.kind IN ('demolay_ativo', 'senior')
      )
      OR EXISTS (
        SELECT 1 FROM public.member_dues_manual_inclusions i
        WHERE i.member_id = m.id AND i.chapter_id = v_chapter.id AND i.year = _year
      )
    );

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'member_id', d.member_id,
      'amount', d.amount,
      'status', d.status,
      'paid_at', d.paid_at,
      'competence_year', d.competence_year,
      'competence_month', d.competence_month
    )
  ), '[]'::jsonb)
  INTO v_dues
  FROM public.member_dues d
  WHERE d.chapter_id = v_chapter.id
    AND d.competence_year = _year;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color,
      'founded_at', nullif(v_chapter.settings->>'founded_at', '')
    ),
    'year', _year,
    'defaultAmount', v_default,
    'members', v_members,
    'dues', v_dues
  );
END;
$function$;
