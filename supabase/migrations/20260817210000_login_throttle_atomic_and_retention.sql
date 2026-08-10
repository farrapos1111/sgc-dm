-- Atomic login throttle + org-join rate limit + retention purge.
-- service_role only for throttle RPC / purge.

ALTER TABLE public.auth_login_throttle
  DROP CONSTRAINT IF EXISTS auth_login_throttle_scope_check;

ALTER TABLE public.auth_login_throttle
  ADD CONSTRAINT auth_login_throttle_scope_check
  CHECK (scope IN ('ip', 'identifier', 'org_join'));

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
  IF _scope IS NULL OR _scope NOT IN ('ip', 'identifier', 'org_join') THEN
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

-- Rate limit inside public RPC (email/phone window) — mantém tipos abelhinhas/arco_iris.
CREATE OR REPLACE FUNCTION public.submit_org_join_request(
  _org_type text,
  _org_type_other text DEFAULT NULL,
  _name_number text DEFAULT NULL,
  _full_address text DEFAULT NULL,
  _founded_on date DEFAULT NULL,
  _active_members_band text DEFAULT NULL,
  _sponsoring_lodge text DEFAULT NULL,
  _responsible_name text DEFAULT NULL,
  _responsible_phone text DEFAULT NULL,
  _responsible_email text DEFAULT NULL,
  _responsible_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_type text := lower(nullif(trim(coalesce(_org_type, '')), ''));
  v_other text := nullif(trim(coalesce(_org_type_other, '')), '');
  v_name text := nullif(trim(coalesce(_name_number, '')), '');
  v_addr text := nullif(trim(coalesce(_full_address, '')), '');
  v_band text := nullif(trim(coalesce(_active_members_band, '')), '');
  v_lodge text := nullif(trim(coalesce(_sponsoring_lodge, '')), '');
  v_rname text := nullif(trim(coalesce(_responsible_name, '')), '');
  v_rphone text := nullif(trim(coalesce(_responsible_phone, '')), '');
  v_remail text := lower(nullif(trim(coalesce(_responsible_email, '')), ''));
  v_rrole text := nullif(trim(coalesce(_responsible_role, '')), '');
  v_recent integer;
BEGIN
  IF v_type IS NULL OR v_type NOT IN (
    'loja', 'bethel', 'capitulo', 'priorado', 'castelo', 'apj', 'outro',
    'abelhinhas', 'arco_iris'
  ) THEN
    RAISE EXCEPTION 'Tipo de organização inválido' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'outro' THEN
    IF v_other IS NULL THEN
      RAISE EXCEPTION 'Informe o tipo de organização (Outro)' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_other := NULL;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Informe o nome/número' USING ERRCODE = '22023';
  END IF;
  IF v_addr IS NULL THEN
    RAISE EXCEPTION 'Informe o endereço completo' USING ERRCODE = '22023';
  END IF;
  IF _founded_on IS NULL THEN
    RAISE EXCEPTION 'Informe a data de fundação/instalação' USING ERRCODE = '22023';
  END IF;
  IF v_band IS NULL OR v_band NOT IN ('5-10', '10-25', '25-30', '30+') THEN
    RAISE EXCEPTION 'Faixa de membros ativos inválida' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'loja' THEN
    v_lodge := NULL;
  ELSIF v_lodge IS NULL THEN
    RAISE EXCEPTION 'Informe a loja patrocinadora' USING ERRCODE = '22023';
  END IF;

  IF v_rname IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_rphone IS NULL THEN
    RAISE EXCEPTION 'Informe o telefone do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_remail IS NULL OR v_remail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_rrole IS NULL THEN
    RAISE EXCEPTION 'Informe o cargo do responsável' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::integer INTO v_recent
  FROM public.org_join_requests
  WHERE created_at > now() - interval '1 hour'
    AND (
      lower(responsible_email) = v_remail
      OR responsible_phone = v_rphone
    );
  IF coalesce(v_recent, 0) >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações. Tente novamente mais tarde.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.org_join_requests (
    org_type,
    org_type_other,
    name_number,
    full_address,
    founded_on,
    active_members_band,
    sponsoring_lodge,
    responsible_name,
    responsible_phone,
    responsible_email,
    responsible_role
  ) VALUES (
    v_type,
    v_other,
    v_name,
    v_addr,
    _founded_on,
    v_band,
    v_lodge,
    v_rname,
    v_rphone,
    v_remail,
    v_rrole
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_org_join_requests(
  _retain_days integer DEFAULT 180
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF _retain_days IS NULL OR _retain_days < 30 THEN
    RAISE EXCEPTION 'retain_days mínimo 30' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.org_join_requests
  WHERE created_at < (now() - make_interval(days => _retain_days));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_org_join_requests(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_org_join_requests(integer)
  TO service_role;

COMMENT ON FUNCTION public.purge_old_org_join_requests(integer) IS
  'Remove solicitações públicas antigas (LGPD/retenção). Agendar via cron/service_role.';
