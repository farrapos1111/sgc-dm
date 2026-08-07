-- Ofícios da Secretaria: modelos, séries por escrivão e emissão numerada.

CREATE TABLE IF NOT EXISTS public.oficio_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oficio_templates_chapter_idx
  ON public.oficio_templates (chapter_id);

DROP TRIGGER IF EXISTS oficio_templates_updated_at ON public.oficio_templates;
CREATE TRIGGER oficio_templates_updated_at
  BEFORE UPDATE ON public.oficio_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficio_templates TO authenticated;
GRANT ALL ON public.oficio_templates TO service_role;
ALTER TABLE public.oficio_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oficio_templates_select ON public.oficio_templates;
CREATE POLICY oficio_templates_select ON public.oficio_templates
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS oficio_templates_write ON public.oficio_templates;
CREATE POLICY oficio_templates_write ON public.oficio_templates
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

-- Série de numeração: reinicia quando a pessoa no cargo de escrivão muda.
CREATE TABLE IF NOT EXISTS public.oficio_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  escrivao_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_number integer NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oficio_series_chapter_idx
  ON public.oficio_series (chapter_id);

CREATE UNIQUE INDEX IF NOT EXISTS oficio_series_one_active_per_chapter
  ON public.oficio_series (chapter_id)
  WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficio_series TO authenticated;
GRANT ALL ON public.oficio_series TO service_role;
ALTER TABLE public.oficio_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oficio_series_select ON public.oficio_series;
CREATE POLICY oficio_series_select ON public.oficio_series
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS oficio_series_write ON public.oficio_series;
CREATE POLICY oficio_series_write ON public.oficio_series
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

CREATE TABLE IF NOT EXISTS public.oficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.oficio_series(id) ON DELETE RESTRICT,
  number integer NOT NULL CHECK (number >= 1),
  year integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  template_id uuid REFERENCES public.oficio_templates(id) ON DELETE SET NULL,
  mc_name text NOT NULL,
  pcc_name text NOT NULL,
  escrivao_name text NOT NULL,
  escrivao_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'expedido'
    CHECK (status IN ('rascunho', 'expedido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, number)
);

CREATE INDEX IF NOT EXISTS oficios_chapter_idx
  ON public.oficios (chapter_id, issued_at DESC);

DROP TRIGGER IF EXISTS oficios_updated_at ON public.oficios;
CREATE TRIGGER oficios_updated_at
  BEFORE UPDATE ON public.oficios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios TO authenticated;
GRANT ALL ON public.oficios TO service_role;
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oficios_select ON public.oficios;
CREATE POLICY oficios_select ON public.oficios
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS oficios_write ON public.oficios;
CREATE POLICY oficios_write ON public.oficios
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

CREATE OR REPLACE FUNCTION public.issue_oficio(
  _chapter_id uuid,
  _title text,
  _body text,
  _template_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text := nullif(trim(_title), '');
  v_body text := coalesce(_body, '');
  v_mc_name text;
  v_pcc_name text;
  v_escrivao_name text;
  v_escrivao_member_id uuid;
  v_series_id uuid;
  v_series_escrivao uuid;
  v_last integer;
  v_number integer;
  v_year integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.has_permission(_chapter_id, 'secretaria') THEN
    RAISE EXCEPTION 'Sem permissão para emitir ofícios';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Informe o título do ofício';
  END IF;

  IF _template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.oficio_templates t
    WHERE t.id = _template_id AND t.chapter_id = _chapter_id
  ) THEN
    RAISE EXCEPTION 'Modelo não encontrado neste capítulo';
  END IF;

  SELECT m.full_name INTO v_mc_name
  FROM public.member_positions mp
  JOIN public.positions p ON p.id = mp.position_id
  JOIN public.members m ON m.id = mp.member_id
  WHERE mp.chapter_id = _chapter_id
    AND mp.term_year = public.current_term_year()
    AND mp.term_semester = public.current_term_semester()
    AND p.code = 'mestre_conselheiro'
  ORDER BY m.full_name
  LIMIT 1;

  SELECT m.full_name INTO v_pcc_name
  FROM public.member_positions mp
  JOIN public.positions p ON p.id = mp.position_id
  JOIN public.members m ON m.id = mp.member_id
  WHERE mp.chapter_id = _chapter_id
    AND mp.term_year = public.current_term_year()
    AND mp.term_semester = public.current_term_semester()
    AND p.code = 'presidente_conselho_consultivo'
  ORDER BY m.full_name
  LIMIT 1;

  SELECT m.id, m.full_name INTO v_escrivao_member_id, v_escrivao_name
  FROM public.member_positions mp
  JOIN public.positions p ON p.id = mp.position_id
  JOIN public.members m ON m.id = mp.member_id
  WHERE mp.chapter_id = _chapter_id
    AND mp.term_year = public.current_term_year()
    AND mp.term_semester = public.current_term_semester()
    AND p.code = 'escrivao'
  ORDER BY m.full_name
  LIMIT 1;

  IF v_mc_name IS NULL THEN
    RAISE EXCEPTION 'Cargo de Mestre Conselheiro não preenchido no termo atual';
  END IF;
  IF v_pcc_name IS NULL THEN
    RAISE EXCEPTION 'Cargo de Presidente do Conselho Consultivo não preenchido no termo atual';
  END IF;
  IF v_escrivao_member_id IS NULL OR v_escrivao_name IS NULL THEN
    RAISE EXCEPTION 'Cargo de Escrivão não preenchido no termo atual';
  END IF;

  SELECT s.id, s.escrivao_member_id, s.last_number
    INTO v_series_id, v_series_escrivao, v_last
  FROM public.oficio_series s
  WHERE s.chapter_id = _chapter_id
    AND s.ended_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_series_id IS NULL OR v_series_escrivao IS DISTINCT FROM v_escrivao_member_id THEN
    IF v_series_id IS NOT NULL THEN
      UPDATE public.oficio_series
         SET ended_at = now()
       WHERE id = v_series_id;
    END IF;

    INSERT INTO public.oficio_series (
      chapter_id, escrivao_member_id, last_number
    ) VALUES (
      _chapter_id, v_escrivao_member_id, 0
    )
    RETURNING id, last_number INTO v_series_id, v_last;
  END IF;

  v_number := coalesce(v_last, 0) + 1;
  v_year := extract(year from (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;

  UPDATE public.oficio_series
     SET last_number = v_number
   WHERE id = v_series_id;

  INSERT INTO public.oficios (
    chapter_id,
    series_id,
    number,
    year,
    title,
    body,
    template_id,
    mc_name,
    pcc_name,
    escrivao_name,
    escrivao_member_id,
    issued_by,
    status
  ) VALUES (
    _chapter_id,
    v_series_id,
    v_number,
    v_year,
    v_title,
    rtrim(v_body),
    _template_id,
    v_mc_name,
    v_pcc_name,
    v_escrivao_name,
    v_escrivao_member_id,
    auth.uid(),
    'expedido'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'number', v_number,
    'year', v_year,
    'title', v_title,
    'label', format('Nº %s/%s', v_number, v_year),
    'mc_name', v_mc_name,
    'pcc_name', v_pcc_name,
    'escrivao_name', v_escrivao_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_oficio(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_oficio(uuid, text, text, uuid)
  TO authenticated, service_role;
