-- Inclui totais agregados do período no fluxo público (sem depender do LIMIT da lista).
CREATE OR REPLACE FUNCTION public.get_public_cash_flow(
  _token text,
  _year integer,
  _month integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_chapter public.chapters%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_entries jsonb;
  v_opening numeric := 0;
  v_period_in numeric := 0;
  v_period_out numeric := 0;
  v_bank_in numeric := 0;
  v_bank_out numeric := 0;
  v_signers jsonb;
  v_term_year integer;
  v_term_semester integer;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;
  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
  END IF;
  IF _month IS NOT NULL AND (_month < 1 OR _month > 12) THEN
    RAISE EXCEPTION 'Mês inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE settings->>'cash_share_token' = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  IF _month IS NULL THEN
    v_period_start := make_date(_year, 1, 1);
    v_period_end := make_date(_year + 1, 1, 1);
  ELSE
    v_period_start := make_date(_year, _month, 1);
    v_period_end := (make_date(_year, _month, 1) + interval '1 month')::date;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.entry_date DESC, e.created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id, kind, category, subcategory, description, amount, entry_date, created_at
    FROM public.cash_entries
    WHERE chapter_id = v_chapter.id
      AND entry_date >= v_period_start
      AND entry_date < v_period_end
    ORDER BY entry_date DESC, created_at DESC
    LIMIT 5000
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
  INTO v_period_in, v_period_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND entry_date >= v_period_start
    AND entry_date < v_period_end;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN kind = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_bank_in, v_bank_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id;

  v_term_year := extract(year from current_date)::integer;
  v_term_semester := CASE WHEN extract(month from current_date)::integer < 7 THEN 1 ELSE 2 END;

  WITH pos AS (
    SELECT p.code, m.full_name
    FROM public.member_positions mp
    JOIN public.positions p ON p.id = mp.position_id
    JOIN public.members m ON m.id = mp.member_id
    WHERE mp.chapter_id = v_chapter.id
      AND mp.term_year = v_term_year
      AND mp.term_semester = v_term_semester
  )
  SELECT jsonb_build_array(
    jsonb_build_object(
      'role', 'Presidente do Conselho Consultivo',
      'name', coalesce((SELECT full_name FROM pos WHERE code IN ('presidente_conselho', 'pcc') LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Mestre Conselheiro',
      'name', coalesce((SELECT full_name FROM pos WHERE code IN ('mestre_conselheiro', 'mc') LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Tesoureiro',
      'name', coalesce((SELECT full_name FROM pos WHERE code IN ('tesoureiro', 'tes') LIMIT 1), '')
    ),
    jsonb_build_object(
      'role', 'Consultor da Tesouraria',
      'name', coalesce((SELECT full_name FROM pos WHERE code IN ('consultor_tesouraria', 'consultor') LIMIT 1), '')
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
    'opening', jsonb_build_object(
      'balance', v_opening,
      'previousYear', _year - 1
    ),
    'totals', jsonb_build_object(
      'income', v_period_in,
      'expense', v_period_out,
      'balance', v_period_in - v_period_out
    ),
    'bank', jsonb_build_object(
      'income', v_bank_in,
      'expense', v_bank_out,
      'balance', v_bank_in - v_bank_out
    ),
    'signers', coalesce(v_signers, '[]'::jsonb)
  );
END;
$function$;
