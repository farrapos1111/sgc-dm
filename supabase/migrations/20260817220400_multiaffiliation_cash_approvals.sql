-- approvals_write: só a própria linha (user_id = auth.uid())
-- get_public_cash_flow: signers do termo do período; sem signatureDataUrl

DROP POLICY IF EXISTS "approvals_write" ON public.minute_approvals;
CREATE POLICY "approvals_write" ON public.minute_approvals
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      public.has_any_role(
        chapter_id,
        ARRAY[
          'admin_total',
          'mestre_conselheiro',
          'escrivao',
          'presidente_conselho',
          'consultor'
        ]
      )
      OR public.has_current_position(
        chapter_id,
        ARRAY[
          'mestre_conselheiro',
          'escrivao',
          'presidente_conselho_consultivo',
          'conselheiro_consultor'
        ]
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_any_role(
        chapter_id,
        ARRAY[
          'admin_total',
          'mestre_conselheiro',
          'escrivao',
          'presidente_conselho',
          'consultor'
        ]
      )
      OR public.has_current_position(
        chapter_id,
        ARRAY[
          'mestre_conselheiro',
          'escrivao',
          'presidente_conselho_consultivo',
          'conselheiro_consultor'
        ]
      )
    )
  );

CREATE OR REPLACE FUNCTION public.get_public_cash_flow(
  _token text,
  _year integer,
  _month integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_entries jsonb;
  v_entries_total integer := 0;
  v_period_in numeric := 0;
  v_period_out numeric := 0;
  v_opening numeric := 0;
  v_bank_in numeric := 0;
  v_bank_out numeric := 0;
  v_signers jsonb;
  v_term_year integer;
  v_term_semester integer;
BEGIN
  v_chapter := public.resolve_public_chapter_by_token(_token);

  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
  END IF;
  IF _month IS NOT NULL AND (_month < 1 OR _month > 12) THEN
    RAISE EXCEPTION 'Mês inválido' USING ERRCODE = '22023';
  END IF;

  IF _month IS NULL THEN
    v_period_start := make_date(_year, 1, 1);
    v_period_end := make_date(_year + 1, 1, 1);
  ELSE
    v_period_start := make_date(_year, _month, 1);
    v_period_end := (make_date(_year, _month, 1) + interval '1 month')::date;
  END IF;

  SELECT count(*)::integer
  INTO v_entries_total
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND entry_date >= v_period_start
    AND entry_date < v_period_end;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN kind = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_period_in, v_period_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND entry_date >= v_period_start
    AND entry_date < v_period_end;

  SELECT coalesce(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.entry_date DESC, e.created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id, kind, category, subcategory, description, amount, entry_date, created_at
    FROM public.cash_entries
    WHERE chapter_id = v_chapter.id
      AND entry_date >= v_period_start
      AND entry_date < v_period_end
    ORDER BY entry_date DESC, created_at DESC
    LIMIT 2000
  ) e;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE -amount END), 0)
  INTO v_opening
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND entry_date < v_period_start;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN kind = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_bank_in, v_bank_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id;

  -- Termo do período do relatório (não now())
  v_term_year := _year;
  v_term_semester := CASE
    WHEN coalesce(_month, 12) <= 6 THEN 1
    ELSE 2
  END;

  WITH pos AS (
    SELECT DISTINCT ON (p.code)
      p.code,
      m.id AS member_id,
      m.full_name
    FROM public.member_positions mp
    JOIN public.positions p ON p.id = mp.position_id
    JOIN public.members m ON m.id = mp.member_id
    WHERE mp.chapter_id = v_chapter.id
      AND mp.term_year = v_term_year
      AND mp.term_semester = v_term_semester
      AND mp.ended_at IS NULL
      AND p.code IN (
        'presidente_conselho_consultivo',
        'mestre_conselheiro',
        'tesoureiro',
        'conselheiro_consultor'
      )
    ORDER BY p.code, mp.created_at DESC NULLS LAST
  )
  SELECT jsonb_build_array(
    jsonb_build_object(
      'role', 'Presidente do Conselho Consultivo',
      'name', coalesce((SELECT full_name FROM pos WHERE code = 'presidente_conselho_consultivo' LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Mestre Conselheiro',
      'name', coalesce((SELECT full_name FROM pos WHERE code = 'mestre_conselheiro' LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Tesoureiro',
      'name', coalesce((SELECT full_name FROM pos WHERE code = 'tesoureiro' LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Conselheiro Consultor',
      'name', coalesce((SELECT full_name FROM pos WHERE code = 'conselheiro_consultor' LIMIT 1), '')
    )
  )
  INTO v_signers;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'logo_url', v_chapter.logo_url,
      'primary_color', v_chapter.primary_color,
      'founded_at', nullif(v_chapter.settings->>'founded_at', '')
    ),
    'year', _year,
    'month', _month,
    'entries', v_entries,
    'entries_total', v_entries_total,
    'entries_truncated', v_entries_total > 2000,
    'totals', jsonb_build_object(
      'income', v_period_in,
      'expense', v_period_out,
      'balance', v_period_in - v_period_out
    ),
    'opening', jsonb_build_object(
      'balance', v_opening,
      'previousYear', _year - 1
    ),
    'bank', jsonb_build_object(
      'income', v_bank_in,
      'expense', v_bank_out,
      'balance', v_bank_in - v_bank_out
    ),
    'signers', coalesce(v_signers, '[]'::jsonb)
  );
END;
$$;
