-- Ofício: corpo sem bloco de assinaturas (assinaturas renderizadas na UI/PDF lado a lado).

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
