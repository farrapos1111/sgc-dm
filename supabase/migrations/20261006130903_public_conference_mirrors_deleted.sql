-- Conferência pública espelha o painel: ignora lançamentos e cobranças excluídos.
-- Cobranças do portal seguem o perfil (todas as vivas, não só o ano).

CREATE OR REPLACE FUNCTION public.get_public_cash_flow(
  _token text,
  _year integer,
  _month integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_today_excl date;
  v_opening_until date;
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

  v_today_excl := (timezone('America/Sao_Paulo', now()))::date + 1;

  IF _month IS NULL THEN
    v_period_start := make_date(_year, 1, 1);
    v_period_end := make_date(_year + 1, 1, 1);
  ELSE
    v_period_start := make_date(_year, _month, 1);
    v_period_end := (make_date(_year, _month, 1) + interval '1 month')::date;
  END IF;

  IF v_period_end > v_today_excl THEN
    v_period_end := v_today_excl;
  END IF;
  v_opening_until := LEAST(v_period_start, v_today_excl);

  SELECT count(*)::integer INTO v_entries_total
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND deleted_at IS NULL
    AND entry_date >= v_period_start
    AND entry_date < v_period_end;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN kind = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_period_in, v_period_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND deleted_at IS NULL
    AND entry_date >= v_period_start
    AND entry_date < v_period_end;

  SELECT coalesce(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.entry_date DESC, e.created_at DESC), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT id, kind, category, subcategory, description, amount, entry_date, created_at
    FROM public.cash_entries
    WHERE chapter_id = v_chapter.id
      AND deleted_at IS NULL
      AND entry_date >= v_period_start
      AND entry_date < v_period_end
    ORDER BY entry_date DESC, created_at DESC
    LIMIT 2000
  ) e;

  SELECT coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE -amount END), 0)
  INTO v_opening
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND deleted_at IS NULL
    AND entry_date < v_opening_until;

  SELECT
    coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN kind = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_bank_in, v_bank_out
  FROM public.cash_entries
  WHERE chapter_id = v_chapter.id
    AND deleted_at IS NULL
    AND entry_date < v_today_excl;

  v_term_year := _year;
  v_term_semester := CASE WHEN coalesce(_month, 12) <= 6 THEN 1 ELSE 2 END;

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
      AND mp.created_at < v_period_end::timestamptz
      AND (mp.ended_at IS NULL OR mp.ended_at >= v_period_start::timestamptz)
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
$function$;

CREATE OR REPLACE FUNCTION public.get_public_member_portal(
  _token text,
  _demolay_id text,
  _year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_id text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_member public.members%ROWTYPE;
  v_default numeric;
  v_dues jsonb;
  v_charges jsonb;
  v_payments jsonb;
  v_events jsonb;
  v_attendance jsonb;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  IF v_id IS NULL OR length(v_id) < 3 THEN
    RAISE EXCEPTION 'Informe um ID DeMolay válido' USING ERRCODE = '22023';
  END IF;
  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
  END IF;

  v_default := coalesce(
    nullif(v_chapter.settings->>'default_dues_amount', '')::numeric,
    50
  );

  SELECT * INTO v_member
  FROM public.members
  WHERE chapter_id = v_chapter.id
    AND demolay_id = v_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado neste capítulo' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'competence_year', d.competence_year,
      'competence_month', d.competence_month,
      'amount', CASE WHEN d.status = 'pago' THEN d.amount ELSE v_default END,
      'status', d.status,
      'paid_at', d.paid_at
    ) ORDER BY d.competence_month
  ), '[]'::jsonb)
  INTO v_dues
  FROM public.member_dues d
  WHERE d.chapter_id = v_chapter.id
    AND d.member_id = v_member.id
    AND d.competence_year = _year;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'description', c.description,
      'amount', c.amount,
      'due_date', c.due_date,
      'status', c.status,
      'paid_at', c.paid_at,
      'category', c.category,
      'kind', c.kind,
      'cash_entry_id', c.cash_entry_id
    ) ORDER BY c.due_date DESC
  ), '[]'::jsonb)
  INTO v_charges
  FROM (
    SELECT id, description, amount, due_date, status, paid_at, category, kind, cash_entry_id
    FROM public.member_charges
    WHERE chapter_id = v_chapter.id
      AND member_id = v_member.id
      AND deleted_at IS NULL
    ORDER BY due_date DESC
    LIMIT 200
  ) c;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'charge_id', p.charge_id,
      'amount', p.amount,
      'paid_at', p.paid_at
    ) ORDER BY p.paid_at DESC
  ), '[]'::jsonb)
  INTO v_payments
  FROM public.member_charge_payments p
  JOIN public.member_charges c ON c.id = p.charge_id
  WHERE c.chapter_id = v_chapter.id
    AND c.member_id = v_member.id
    AND c.deleted_at IS NULL
    AND p.deleted_at IS NULL;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'event_type', e.event_type,
      'starts_at', e.start_at,
      'mandatory', coalesce(e.mandatory, false)
    ) ORDER BY e.start_at
  ), '[]'::jsonb)
  INTO v_events
  FROM public.calendar_events e
  WHERE e.chapter_id = v_chapter.id
    AND coalesce(e.mandatory, false) = true
    AND extract(year from (e.start_at AT TIME ZONE 'America/Sao_Paulo'))::integer = _year;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'event_id', a.calendar_event_id,
      'status', a.status
    )
  ), '[]'::jsonb)
  INTO v_attendance
  FROM public.attendance_records a
  JOIN public.calendar_events e ON e.id = a.calendar_event_id
  WHERE a.member_id = v_member.id
    AND a.chapter_id = v_chapter.id
    AND coalesce(e.mandatory, false) = true
    AND extract(year from (e.start_at AT TIME ZONE 'America/Sao_Paulo'))::integer = _year;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'primary_color', v_chapter.primary_color
    ),
    'year', _year,
    'defaultAmount', v_default,
    'member', jsonb_build_object(
      'id', v_member.id,
      'full_name', v_member.full_name,
      'status', v_member.status,
      'kind', v_member.kind,
      'demolay_id', v_member.demolay_id,
      'birth_date', v_member.birth_date,
      'iniciacao_ordem', v_member.iniciacao_ordem
    ),
    'dues', v_dues,
    'charges', v_charges,
    'payments', coalesce(v_payments, '[]'::jsonb),
    'events', v_events,
    'attendance', v_attendance
  );
END;
$function$;
