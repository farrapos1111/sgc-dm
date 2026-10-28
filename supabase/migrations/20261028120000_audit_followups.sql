-- Correções da auditoria técnica de 28/10/2026 (ver docs/TECNICO.md §12).
--
-- 1) Lobby público: a visão de frequência deixa de devolver data de nascimento;
--    o portal do membro exige a data de nascimento cadastrada como segundo
--    fator e compara o ID DeMolay normalizado (usa o índice único).
-- 2) Throttle: novo escopo lobby_portal e take_rate_quota atômica (cotas de
--    IA, reset de senha e portal do lobby).
-- 3) Auth Hook (custom access token) que nega token a membro sem situação
--    regular — bloqueia também login/refresh direto na API do Supabase.
--    Precisa ser ativado no painel: Authentication → Hooks.
-- 4) CHECKs de formato (NOT VALID: valem só para gravações novas).

-- ---------------------------------------------------------------------------
-- 1) Lobby público
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

DROP FUNCTION IF EXISTS public.get_public_member_portal(text, text, integer);

CREATE OR REPLACE FUNCTION public.get_public_member_portal(
  _token text,
  _demolay_id text,
  _year integer,
  _birth_date date DEFAULT NULL
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
    AND public.normalize_demolay_id(demolay_id) = public.normalize_demolay_id(v_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado neste capítulo' USING ERRCODE = 'P0002';
  END IF;

  -- Segundo fator: com data de nascimento cadastrada, ela precisa conferir.
  -- Mesma mensagem do "não encontrado" para não virar oráculo.
  IF v_member.birth_date IS NOT NULL
     AND (_birth_date IS NULL OR _birth_date <> v_member.birth_date) THEN
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

REVOKE ALL ON FUNCTION public.get_public_member_portal(text, text, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_member_portal(text, text, integer, date)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Throttle
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_login_throttle
  DROP CONSTRAINT IF EXISTS auth_login_throttle_scope_check;

ALTER TABLE public.auth_login_throttle
  ADD CONSTRAINT auth_login_throttle_scope_check
  CHECK (scope IN ('ip', 'identifier', 'org_join', 'minute_password', 'password_reset', 'ai', 'lobby_portal'));

CREATE OR REPLACE FUNCTION public.record_login_throttle_failure(
  _scope text,
  _scope_key text,
  _max_fails integer,
  _window_ms bigint,
  _lock_ms bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_existing public.auth_login_throttle%ROWTYPE;
  v_fail integer;
  v_window_start timestamptz;
  v_locked timestamptz;
  v_row public.auth_login_throttle%ROWTYPE;
BEGIN
  IF _scope IS NULL OR _scope NOT IN ('ip', 'identifier', 'org_join', 'minute_password', 'password_reset', 'ai', 'lobby_portal') THEN
    RAISE EXCEPTION 'scope inválido' USING ERRCODE = '22023';
  END IF;
  IF _scope_key IS NULL OR length(trim(_scope_key)) = 0 THEN
    RAISE EXCEPTION 'scope_key inválido' USING ERRCODE = '22023';
  END IF;
  IF _max_fails IS NULL OR _max_fails < 1 THEN
    RAISE EXCEPTION 'max_fails inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.auth_login_throttle
  WHERE scope = _scope AND scope_key = _scope_key
  FOR UPDATE;

  IF NOT FOUND THEN
    v_fail := 1;
    v_window_start := v_now;
    v_locked := CASE WHEN 1 >= _max_fails
      THEN v_now + make_interval(secs => (_lock_ms / 1000.0))
      ELSE NULL END;
  ELSIF v_existing.locked_until IS NOT NULL AND v_existing.locked_until > v_now THEN
    v_fail := v_existing.fail_count;
    v_window_start := v_existing.window_started_at;
    v_locked := v_existing.locked_until;
  ELSIF (v_now - v_existing.window_started_at) < make_interval(secs => (_window_ms / 1000.0)) THEN
    v_fail := v_existing.fail_count + 1;
    v_window_start := v_existing.window_started_at;
    v_locked := CASE WHEN v_fail >= _max_fails
      THEN v_now + make_interval(secs => (_lock_ms / 1000.0))
      ELSE NULL END;
  ELSE
    v_fail := 1;
    v_window_start := v_now;
    v_locked := CASE WHEN 1 >= _max_fails
      THEN v_now + make_interval(secs => (_lock_ms / 1000.0))
      ELSE NULL END;
  END IF;

  INSERT INTO public.auth_login_throttle AS t (
    scope, scope_key, fail_count, window_started_at, locked_until, updated_at
  )
  VALUES (_scope, _scope_key, v_fail, v_window_start, v_locked, v_now)
  ON CONFLICT (scope, scope_key) DO UPDATE
  SET
    fail_count = EXCLUDED.fail_count,
    window_started_at = EXCLUDED.window_started_at,
    locked_until = EXCLUDED.locked_until,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'fail_count', v_row.fail_count,
    'window_started_at', v_row.window_started_at,
    'locked_until', v_row.locked_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_throttle_failure(text, text, integer, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_throttle_failure(text, text, integer, bigint, bigint)
  TO service_role;

-- Consome uma unidade da cota numa única transação (a linha fica travada por
-- FOR UPDATE dentro de record_login_throttle_failure). Retorna false quando a
-- cota da janela já foi usada.
CREATE OR REPLACE FUNCTION public.take_rate_quota(
  _scope text,
  _scope_key text,
  _max integer,
  _window_ms bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF _scope NOT IN ('password_reset', 'ai', 'lobby_portal') THEN
    RAISE EXCEPTION 'scope inválido' USING ERRCODE = '22023';
  END IF;
  IF _max IS NULL OR _max < 1 THEN
    RAISE EXCEPTION 'max inválido' USING ERRCODE = '22023';
  END IF;

  -- Trava em _max + 1: a chamada número _max ainda passa; a seguinte encontra
  -- locked_until no futuro e o contador não avança mais.
  v_row := public.record_login_throttle_failure(
    _scope, _scope_key, _max + 1, _window_ms, _window_ms
  );
  RETURN (v_row->>'fail_count')::integer <= _max;
END;
$$;

REVOKE ALL ON FUNCTION public.take_rate_quota(text, text, integer, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_rate_quota(text, text, integer, bigint)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Auth Hook: membro irregular não recebe token
-- ---------------------------------------------------------------------------
-- Mesma regra de evaluateMemberLoginGate (accounts.functions.ts): sem ficha
-- vinculada → liberado (papéis org); com ficha → precisa de ao menos uma
-- regular. Vale para login e para refresh de sessão já aberta.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := (event->>'user_id')::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = v_user)
     AND NOT EXISTS (
       SELECT 1 FROM public.members m
       WHERE m.user_id = v_user AND m.status = 'regular'
     ) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Acesso suspenso: sua situação no capítulo não está regular. Procure a secretaria.'
      )
    );
  END IF;
  RETURN jsonb_build_object('claims', event->'claims');
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 4) Formato de dados (NOT VALID: não reprocessa linhas antigas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_email_format_ck;
ALTER TABLE public.members
  ADD CONSTRAINT members_email_format_ck
  CHECK (email IS NULL OR email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') NOT VALID;

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_full_name_length_ck;
ALTER TABLE public.members
  ADD CONSTRAINT members_full_name_length_ck
  CHECK (char_length(full_name) BETWEEN 1 AND 200) NOT VALID;
