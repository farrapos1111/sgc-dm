-- Lobby público unificado (/c/$token)
-- Token em chapters.settings.public_lobby_token
-- Resolve também dues_share_token / cash_share_token nas RPCs públicas existentes

-- ---------------------------------------------------------------------------
-- Gestão do token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_public_lobby(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_chapter_member(_chapter_id)
    AND (
      public.has_role(_chapter_id, 'admin_total')
      OR public.has_role(_chapter_id, 'mestre_conselheiro')
      OR public.has_role(_chapter_id, 'tesoureiro')
    );
$function$;

CREATE OR REPLACE FUNCTION public.ensure_public_lobby_token(
  _chapter_id uuid,
  _regenerate boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF NOT public.can_manage_public_lobby(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT nullif(settings->>'public_lobby_token', '') INTO v_token
  FROM public.chapters
  WHERE id = _chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_token IS NULL OR _regenerate THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.chapters
    SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('public_lobby_token', v_token)
    WHERE id = _chapter_id;
  END IF;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_public_lobby_token(_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_manage_public_lobby(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.chapters
  SET settings = coalesce(settings, '{}'::jsonb) - 'public_lobby_token'
  WHERE id = _chapter_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_lobby_token(_chapter_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF NOT public.can_manage_public_lobby(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT nullif(settings->>'public_lobby_token', '') INTO v_token
  FROM public.chapters
  WHERE id = _chapter_id;

  RETURN v_token;
END;
$function$;

-- Resolve capítulo por qualquer token público conhecido
CREATE OR REPLACE FUNCTION public.resolve_public_chapter_by_token(_token text)
RETURNS public.chapters
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_chapter public.chapters%ROWTYPE;
BEGIN
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE settings->>'public_lobby_token' = v_token
     OR settings->>'dues_share_token' = v_token
     OR settings->>'cash_share_token' = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_chapter;
END;
$function$;

-- Resolve só pelo lobby token (mais restrito)
CREATE OR REPLACE FUNCTION public.resolve_lobby_chapter_by_token(_token text)
RETURNS public.chapters
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_chapter public.chapters%ROWTYPE;
BEGIN
  IF v_token IS NULL OR length(v_token) < 16 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE settings->>'public_lobby_token' = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_chapter;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Branding do lobby
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_lobby(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter public.chapters%ROWTYPE;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'logo_url', v_chapter.logo_url,
      'primary_color', v_chapter.primary_color
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Estender dues / cash para aceitar também public_lobby_token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_year_dues(
  _token text,
  _year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_default numeric;
  v_members jsonb;
  v_dues jsonb;
BEGIN
  v_chapter := public.resolve_public_chapter_by_token(_token);

  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
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
  v_chapter public.chapters%ROWTYPE;
  v_period_start date;
  v_period_end date;
  v_entries jsonb;
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
    'bank', jsonb_build_object(
      'income', v_bank_in,
      'expense', v_bank_out,
      'balance', v_bank_in - v_bank_out
    ),
    'signers', coalesce(v_signers, '[]'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Visão pública de presenças / frequência
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_public_attendance_overview(
  _token text,
  _year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_events jsonb;
  v_records jsonb;
  v_members jsonb;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
  END IF;

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
      'member_id', a.member_id,
      'event_id', a.calendar_event_id,
      'status', a.status
    )
  ), '[]'::jsonb)
  INTO v_records
  FROM public.attendance_records a
  JOIN public.calendar_events e ON e.id = a.calendar_event_id
  WHERE a.chapter_id = v_chapter.id
    AND coalesce(e.mandatory, false) = true
    AND extract(year from (e.start_at AT TIME ZONE 'America/Sao_Paulo'))::integer = _year;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'status', m.status,
      'kind', m.kind,
      'birth_date', m.birth_date,
      'iniciacao_ordem', m.iniciacao_ordem
    ) ORDER BY m.full_name
  ), '[]'::jsonb)
  INTO v_members
  FROM public.members m
  WHERE m.chapter_id = v_chapter.id
    AND m.status = 'regular'
    AND m.kind IN ('demolay_ativo', 'senior');

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'logo_url', v_chapter.logo_url,
      'primary_color', v_chapter.primary_color
    ),
    'year', _year,
    'events', v_events,
    'records', v_records,
    'members', v_members
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Portal do membro (ID DeMolay + token do lobby)
-- ---------------------------------------------------------------------------

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
      'amount', d.amount,
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
      'kind', c.kind
    ) ORDER BY c.due_date DESC
  ), '[]'::jsonb)
  INTO v_charges
  FROM public.member_charges c
  WHERE c.chapter_id = v_chapter.id
    AND c.member_id = v_member.id
    AND extract(year from c.due_date)::integer = _year;

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
    AND extract(year from c.due_date)::integer = _year;

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
    'member', jsonb_build_object(
      'id', v_member.id,
      'full_name', v_member.full_name,
      'status', v_member.status,
      'kind', v_member.kind,
      'demolay_id', v_member.demolay_id
    ),
    'dues', v_dues,
    'charges', v_charges,
    'payments', coalesce(v_payments, '[]'::jsonb),
    'events', v_events,
    'attendance', v_attendance
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Cadastro escopado ao capítulo do lobby
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_lobby_member_cadastro(
  _token text,
  _demolay_id text
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
  v_guardians jsonb;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  IF v_id IS NULL OR length(v_id) < 3 THEN
    RAISE EXCEPTION 'Informe um ID DeMolay válido' USING ERRCODE = '22023';
  END IF;

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
      'id', g.id,
      'full_name', g.full_name,
      'relationship', coalesce(g.relationship, ''),
      'phone', coalesce(g.phone, ''),
      'email', coalesce(g.email, ''),
      'cpf_last2', g.cpf_last2,
      'is_primary', g.is_primary
    ) ORDER BY g.is_primary DESC, g.full_name
  ), '[]'::jsonb)
  INTO v_guardians
  FROM public.guardians g
  WHERE g.member_id = v_member.id;

  RETURN jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id,
      'chapter_id', v_member.chapter_id,
      'chapter_name', v_chapter.name,
      'full_name', v_member.full_name,
      'birth_date', v_member.birth_date,
      'status', v_member.status,
      'kind', v_member.kind,
      'demolay_id', v_member.demolay_id,
      'masonic_id', v_member.masonic_id,
      'phone', coalesce(v_member.phone, ''),
      'email', coalesce(v_member.email, ''),
      'address', coalesce(v_member.address, '{}'::jsonb),
      'cpf_last2', v_member.cpf_last2,
      'rg_last2', v_member.rg_last2,
      'iniciacao_ordem', v_member.iniciacao_ordem,
      'exam_grau_iniciatico', v_member.exam_grau_iniciatico,
      'iniciacao_grau_demolay', v_member.iniciacao_grau_demolay,
      'exam_grau_demolay', v_member.exam_grau_demolay
    ),
    'guardians', v_guardians
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_lobby_member_cadastro(
  _token text,
  _demolay_id text,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address jsonb DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _rg text DEFAULT NULL,
  _guardians jsonb DEFAULT NULL
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
  v_cpf_clean text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_rg_clean text := regexp_replace(coalesce(_rg, ''), '\D', '', 'g');
  v_phone text := nullif(trim(coalesce(_phone, '')), '');
  v_email text := nullif(trim(coalesce(_email, '')), '');
  v_address jsonb := coalesce(_address, '{}'::jsonb);
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_g jsonb;
  v_g_id uuid;
  v_g_row public.guardians%ROWTYPE;
  v_g_cpf text;
  v_g_rel text;
  v_g_phone text;
  v_g_email text;
  v_g_changes jsonb;
  v_guardians_old jsonb := '[]'::jsonb;
  v_guardians_new jsonb := '[]'::jsonb;
  v_changed boolean := false;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  IF v_id IS NULL OR length(v_id) < 3 THEN
    RAISE EXCEPTION 'Informe um ID DeMolay válido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE chapter_id = v_chapter.id
    AND demolay_id = v_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado neste capítulo' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_member.phone, '') IS DISTINCT FROM coalesce(v_phone, '') THEN
    v_old := v_old || jsonb_build_object('phone', v_member.phone);
    v_new := v_new || jsonb_build_object('phone', v_phone);
    v_changed := true;
  END IF;

  IF coalesce(v_member.email, '') IS DISTINCT FROM coalesce(v_email, '') THEN
    v_old := v_old || jsonb_build_object('email', v_member.email);
    v_new := v_new || jsonb_build_object('email', v_email);
    v_changed := true;
  END IF;

  IF coalesce(v_member.address, '{}'::jsonb) IS DISTINCT FROM v_address THEN
    v_old := v_old || jsonb_build_object('address', coalesce(v_member.address, '{}'::jsonb));
    v_new := v_new || jsonb_build_object('address', v_address);
    v_changed := true;
  END IF;

  IF length(v_cpf_clean) > 0 THEN
    v_old := v_old || jsonb_build_object('cpf_last2', v_member.cpf_last2);
    v_new := v_new || jsonb_build_object('cpf_last2', right(v_cpf_clean, 2));
    v_changed := true;
  END IF;

  IF length(v_rg_clean) > 0 THEN
    v_old := v_old || jsonb_build_object('rg_last2', v_member.rg_last2);
    v_new := v_new || jsonb_build_object('rg_last2', right(v_rg_clean, 2));
    v_changed := true;
  END IF;

  UPDATE public.members SET
    phone = v_phone,
    email = v_email,
    address = v_address,
    cpf_encrypted = CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) ELSE cpf_encrypted END,
    cpf_last2 = CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) ELSE cpf_last2 END,
    rg_encrypted = CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) ELSE rg_encrypted END,
    rg_last2 = CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) ELSE rg_last2 END,
    updated_at = now()
  WHERE id = v_member.id;

  IF _guardians IS NOT NULL AND jsonb_typeof(_guardians) = 'array' THEN
    FOR v_g IN SELECT * FROM jsonb_array_elements(_guardians)
    LOOP
      BEGIN
        v_g_id := (v_g->>'id')::uuid;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;

      SELECT * INTO v_g_row FROM public.guardians
      WHERE id = v_g_id AND member_id = v_member.id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_g_rel := coalesce(v_g->>'relationship', '');
      v_g_phone := nullif(trim(coalesce(v_g->>'phone', '')), '');
      v_g_email := nullif(trim(coalesce(v_g->>'email', '')), '');
      v_g_cpf := regexp_replace(coalesce(v_g->>'cpf', ''), '\D', '', 'g');
      v_g_changes := '{}'::jsonb;

      IF coalesce(v_g_row.relationship, '') IS DISTINCT FROM v_g_rel THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'relationship', jsonb_build_object('old', v_g_row.relationship, 'new', v_g_rel)
        );
      END IF;
      IF coalesce(v_g_row.phone, '') IS DISTINCT FROM coalesce(v_g_phone, '') THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'phone', jsonb_build_object('old', v_g_row.phone, 'new', v_g_phone)
        );
      END IF;
      IF coalesce(v_g_row.email, '') IS DISTINCT FROM coalesce(v_g_email, '') THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'email', jsonb_build_object('old', v_g_row.email, 'new', v_g_email)
        );
      END IF;
      IF length(v_g_cpf) > 0 THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'cpf_last2', jsonb_build_object('old', v_g_row.cpf_last2, 'new', right(v_g_cpf, 2))
        );
      END IF;

      IF v_g_changes <> '{}'::jsonb THEN
        v_changed := true;
        v_guardians_old := v_guardians_old || jsonb_build_array(jsonb_build_object(
          'id', v_g_row.id,
          'full_name', v_g_row.full_name,
          'before', jsonb_build_object(
            'relationship', v_g_row.relationship,
            'phone', v_g_row.phone,
            'email', v_g_row.email,
            'cpf_last2', v_g_row.cpf_last2
          )
        ));
        v_guardians_new := v_guardians_new || jsonb_build_array(jsonb_build_object(
          'id', v_g_row.id,
          'full_name', v_g_row.full_name,
          'changes', v_g_changes
        ));
      END IF;

      UPDATE public.guardians SET
        relationship = v_g_rel,
        phone = v_g_phone,
        email = v_g_email,
        cpf_encrypted = CASE WHEN length(v_g_cpf) > 0 THEN public.encrypt_pii(v_g_cpf) ELSE cpf_encrypted END,
        cpf_last2 = CASE WHEN length(v_g_cpf) >= 2 THEN right(v_g_cpf, 2) ELSE cpf_last2 END
      WHERE id = v_g_row.id;
    END LOOP;

    IF jsonb_array_length(v_guardians_new) > 0 THEN
      v_old := v_old || jsonb_build_object('guardians', v_guardians_old);
      v_new := v_new || jsonb_build_object('guardians', v_guardians_new);
    END IF;
  END IF;

  IF NOT v_changed THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'member_id', v_member.id);
  END IF;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, old_value, new_value
  ) VALUES (
    v_member.chapter_id,
    NULL,
    'member_cadastro_self_update',
    'members',
    v_member.id,
    v_old || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name),
    v_new || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name, 'source', 'lobby_publico')
  );

  RETURN jsonb_build_object('ok', true, 'changed', true, 'member_id', v_member.id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.can_manage_public_lobby(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_public_lobby_token(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_public_lobby_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_lobby_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_chapter_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_lobby_chapter_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_lobby(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_attendance_overview(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_member_portal(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_lobby_member_cadastro(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_lobby_member_cadastro(text, text, text, text, jsonb, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_public_lobby(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_public_lobby_token(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_public_lobby_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_lobby_token(uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_public_lobby(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_attendance_overview(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_member_portal(text, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_lobby_member_cadastro(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_lobby_member_cadastro(text, text, text, text, jsonb, text, text, jsonb) TO anon, authenticated, service_role;

-- resolve_* só para service_role / uso interno via SECURITY DEFINER
GRANT EXECUTE ON FUNCTION public.resolve_public_chapter_by_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_lobby_chapter_by_token(text) TO service_role;

-- get_public_year_dues / get_public_cash_flow já têm grants; reafirmar
GRANT EXECUTE ON FUNCTION public.get_public_year_dues(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_cash_flow(text, integer, integer) TO anon, authenticated, service_role;
