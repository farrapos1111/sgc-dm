-- CodeRabbit follow-ups: throttle atômico, atas draft key, logos UUID,
-- assinaturas RLS, cash flow histórico, platform_access, purge em lotes.

-- 1) record_login_throttle_failure: ON CONFLICT calcula a partir da linha existente
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
  IF _window_ms IS NULL OR _window_ms < 1 THEN
    RAISE EXCEPTION 'window_ms inválido' USING ERRCODE = '22023';
  END IF;
  IF _lock_ms IS NULL OR _lock_ms < 1 THEN
    RAISE EXCEPTION 'lock_ms inválido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.auth_login_throttle AS t (
    scope, scope_key, fail_count, window_started_at, locked_until, updated_at
  )
  VALUES (_scope, _scope_key, 1, v_now, NULL, v_now)
  ON CONFLICT (scope, scope_key) DO UPDATE
  SET
    fail_count = CASE
      WHEN t.locked_until IS NOT NULL AND t.locked_until > v_now THEN t.fail_count
      WHEN (v_now - t.window_started_at) < make_interval(secs => (_window_ms / 1000.0))
        THEN t.fail_count + 1
      ELSE 1
    END,
    window_started_at = CASE
      WHEN t.locked_until IS NOT NULL AND t.locked_until > v_now THEN t.window_started_at
      WHEN (v_now - t.window_started_at) < make_interval(secs => (_window_ms / 1000.0))
        THEN t.window_started_at
      ELSE v_now
    END,
    locked_until = CASE
      WHEN t.locked_until IS NOT NULL AND t.locked_until > v_now THEN t.locked_until
      WHEN (v_now - t.window_started_at) < make_interval(secs => (_window_ms / 1000.0))
        AND (t.fail_count + 1) >= _max_fails
        THEN v_now + make_interval(secs => (_lock_ms / 1000.0))
      WHEN NOT ((v_now - t.window_started_at) < make_interval(secs => (_window_ms / 1000.0)))
        AND 1 >= _max_fails
        THEN v_now + make_interval(secs => (_lock_ms / 1000.0))
      ELSE NULL
    END,
    updated_at = v_now
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'fail_count', v_row.fail_count,
    'window_started_at', v_row.window_started_at,
    'locked_until', v_row.locked_until
  );
END;
$$;

-- 2) submit_org_join_request: telefone só dígitos na comparação e no insert
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
  v_rphone text := nullif(regexp_replace(coalesce(_responsible_phone, ''), '\D', '', 'g'), '');
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
  IF v_rphone IS NULL OR length(v_rphone) < 8 THEN
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
      OR regexp_replace(responsible_phone, '\D', '', 'g') = v_rphone
    );
  IF coalesce(v_recent, 0) >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações. Tente novamente mais tarde.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.org_join_requests (
    org_type, org_type_other, name_number, full_address, founded_on,
    active_members_band, sponsoring_lodge,
    responsible_name, responsible_phone, responsible_email, responsible_role
  ) VALUES (
    v_type, v_other, v_name, v_addr, _founded_on,
    v_band, v_lodge,
    v_rname, v_rphone, v_remail, v_rrole
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

-- 3) Purge em lotes
CREATE OR REPLACE FUNCTION public.purge_old_org_join_requests(
  _retain_days integer DEFAULT 180
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer := 0;
  v_batch integer;
BEGIN
  IF _retain_days IS NULL OR _retain_days < 30 THEN
    RAISE EXCEPTION 'retain_days mínimo 30' USING ERRCODE = '22023';
  END IF;

  LOOP
    DELETE FROM public.org_join_requests
    WHERE id IN (
      SELECT id FROM public.org_join_requests
      WHERE created_at < (now() - make_interval(days => _retain_days))
      ORDER BY created_at
      LIMIT 500
    );
    GET DIAGNOSTICS v_batch = ROW_COUNT;
    v_deleted := v_deleted + v_batch;
    EXIT WHEN v_batch = 0;
  END LOOP;

  RETURN v_deleted;
END;
$$;

CREATE INDEX IF NOT EXISTS org_join_requests_created_at_idx
  ON public.org_join_requests (created_at);

-- 4) session_minutes draft key + RPC atômico
ALTER TABLE public.session_minutes
  ADD COLUMN IF NOT EXISTS client_draft_key uuid;

DROP INDEX IF EXISTS session_minutes_client_draft_key_uidx;
ALTER TABLE public.session_minutes
  DROP CONSTRAINT IF EXISTS session_minutes_client_draft_key_key;
ALTER TABLE public.session_minutes
  ADD CONSTRAINT session_minutes_client_draft_key_key UNIQUE (client_draft_key);

CREATE OR REPLACE FUNCTION public.upsert_session_minute_draft(
  _chapter_id uuid,
  _calendar_event_id uuid,
  _content text,
  _kind text,
  _title text,
  _client_draft_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.session_minutes%ROWTYPE;
  v_kind text := coalesce(nullif(trim(_kind), ''), 'publica');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _client_draft_key IS NULL THEN
    RAISE EXCEPTION 'client_draft_key obrigatório' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.has_permission(_chapter_id, 'secretaria')
    OR public.has_permission(_chapter_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gravar ata' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.session_minutes
  WHERE client_draft_key = _client_draft_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.opened_by IS DISTINCT FROM auth.uid()
       OR v_row.chapter_id IS DISTINCT FROM _chapter_id
       OR v_row.calendar_event_id IS DISTINCT FROM _calendar_event_id THEN
      RAISE EXCEPTION 'Rascunho não pertence a esta sessão';
    END IF;
    IF v_row.status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Ata bloqueada para edição';
    END IF;
    UPDATE public.session_minutes
    SET
      content = _content,
      kind = v_kind::public.minute_kind,
      title = COALESCE(_title, title)
    WHERE id = v_row.id
      AND status = 'rascunho'
    RETURNING * INTO v_row;
  ELSE
    BEGIN
      INSERT INTO public.session_minutes (
        chapter_id, calendar_event_id, content, kind, title,
        opened_by, status, client_draft_key
      )
      VALUES (
        _chapter_id, _calendar_event_id, _content,
        v_kind::public.minute_kind,
        _title, auth.uid(), 'rascunho', _client_draft_key
      )
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO v_row
      FROM public.session_minutes
      WHERE client_draft_key = _client_draft_key
        AND opened_by = auth.uid()
        AND status = 'rascunho'
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      UPDATE public.session_minutes
      SET
        content = _content,
        kind = v_kind::public.minute_kind,
        title = COALESCE(_title, title)
      WHERE id = v_row.id
        AND status = 'rascunho'
      RETURNING * INTO v_row;
    END;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível salvar o rascunho';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'kind', v_row.kind,
    'title', v_row.title
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_session_minute_draft(uuid, uuid, text, text, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_session_minute_draft(uuid, uuid, text, text, text, uuid)
  TO authenticated, service_role;

-- 5) chapter logos: CASE WHEN uuid before cast
DROP POLICY IF EXISTS chapter_logos_select ON storage.objects;
CREATE POLICY chapter_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (
      CASE
        WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN
          public.is_chapter_member(((storage.foldername(name))[1])::uuid)
          OR public.can_manage_region_chapter(((storage.foldername(name))[1])::uuid)
          OR EXISTS (
            SELECT 1
            FROM public.chapters c
            JOIN public.org_leaderships l ON l.state_id = c.state_id
            WHERE c.id = ((storage.foldername(name))[1])::uuid
              AND l.user_id = auth.uid()
              AND l.active
              AND l.org_role = 'mce'::public.org_role
          )
        ELSE false
      END
    )
  );

-- 6) member_office_signatures: exigir cargo atual compatível
CREATE OR REPLACE FUNCTION public.canonical_office_signature_code(code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(code))
    WHEN 'presidente_conselho' THEN 'presidente_conselho_consultivo'
    WHEN 'consultor' THEN 'conselheiro_consultor'
    ELSE lower(trim(code))
  END;
$$;

DROP POLICY IF EXISTS mos_insert_own ON public.member_office_signatures;
CREATE POLICY mos_insert_own ON public.member_office_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
    AND public.member_visible_in_chapter(member_id, chapter_id)
    AND length(trim(signature_data_url)) > 0
    AND EXISTS (
      SELECT 1
      FROM public.member_positions mp
      JOIN public.positions p ON p.id = mp.position_id
      WHERE mp.member_id = member_office_signatures.member_id
        AND mp.chapter_id = member_office_signatures.chapter_id
        AND mp.term_year = public.current_term_year()
        AND mp.term_semester = public.current_term_semester()
        AND mp.ended_at IS NULL
        AND public.canonical_office_signature_code(p.code)
          = public.canonical_office_signature_code(member_office_signatures.position_code)
    )
  );

DROP POLICY IF EXISTS mos_update_own ON public.member_office_signatures;
CREATE POLICY mos_update_own ON public.member_office_signatures
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
    AND public.member_visible_in_chapter(member_id, chapter_id)
    AND length(trim(signature_data_url)) > 0
    AND EXISTS (
      SELECT 1
      FROM public.member_positions mp
      JOIN public.positions p ON p.id = mp.position_id
      WHERE mp.member_id = member_office_signatures.member_id
        AND mp.chapter_id = member_office_signatures.chapter_id
        AND mp.term_year = public.current_term_year()
        AND mp.term_semester = public.current_term_semester()
        AND mp.ended_at IS NULL
        AND public.canonical_office_signature_code(p.code)
          = public.canonical_office_signature_code(member_office_signatures.position_code)
    )
  );

-- 7) get_public_cash_flow: vigência no período (não só ended_at IS NULL)
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

  SELECT count(*)::integer INTO v_entries_total
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

  SELECT coalesce(sum(CASE WHEN kind = 'entrada' THEN amount ELSE -amount END), 0)
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
$$;

-- 8) platform_access: reorder validation + remove with grants
CREATE OR REPLACE FUNCTION public.reorder_platform_access_roles(
  _org_type text,
  _role_group text,
  _ordered_role_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid[];
  v_dup integer;
BEGIN
  IF _ordered_role_ids IS NULL OR cardinality(_ordered_role_ids) < 1 THEN
    RAISE EXCEPTION 'Lista de cargos vazia';
  END IF;

  SELECT count(*)::integer INTO v_dup
  FROM (
    SELECT unnest(_ordered_role_ids) AS id
    GROUP BY 1
    HAVING count(*) > 1
  ) d;
  IF coalesce(v_dup, 0) > 0 THEN
    RAISE EXCEPTION 'Lista de cargos contém IDs duplicados';
  END IF;

  SELECT coalesce(array_agg(pot.role_id ORDER BY pot.sort_order, pot.role_id), '{}'::uuid[])
  INTO v_existing
  FROM public.platform_access_role_org_types pot
  WHERE pot.org_type = _org_type
    AND (
      (_role_group IS NULL AND pot.role_group IS NULL)
      OR pot.role_group IS NOT DISTINCT FROM _role_group
    );

  IF cardinality(v_existing) IS DISTINCT FROM cardinality(_ordered_role_ids)
     OR EXISTS (
       SELECT 1 FROM unnest(v_existing) e(id)
       WHERE NOT (e.id = ANY (_ordered_role_ids))
     )
     OR EXISTS (
       SELECT 1 FROM unnest(_ordered_role_ids) o(id)
       WHERE NOT (o.id = ANY (v_existing))
     ) THEN
    RAISE EXCEPTION 'Lista de cargos incompleta ou com IDs de outro grupo';
  END IF;

  UPDATE public.platform_access_role_org_types pot
  SET sort_order = (v.ord::integer) * 10
  FROM unnest(_ordered_role_ids) WITH ORDINALITY AS v(role_id, ord)
  WHERE pot.role_id = v.role_id
    AND pot.org_type = _org_type
    AND (
      (_role_group IS NULL AND pot.role_group IS NULL)
      OR pot.role_group IS NOT DISTINCT FROM _role_group
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_platform_access_role_org_type(
  _role_id uuid,
  _org_type text,
  _enabled boolean,
  _role_group text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.platform_access_roles%ROWTYPE;
  v_max integer;
  v_remaining integer;
BEGIN
  SELECT * INTO v_role FROM public.platform_access_roles WHERE id = _role_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cargo não encontrado';
  END IF;

  IF _enabled THEN
    SELECT coalesce(max(sort_order), 0) INTO v_max
    FROM public.platform_access_role_org_types
    WHERE org_type = _org_type
      AND (
        (_role_group IS NULL AND role_group IS NULL)
        OR role_group IS NOT DISTINCT FROM _role_group
      );

    INSERT INTO public.platform_access_role_org_types (
      role_id, org_type, role_group, sort_order
    ) VALUES (
      _role_id, _org_type, _role_group, v_max + 10
    )
    ON CONFLICT (role_id, org_type) DO UPDATE
      SET role_group = EXCLUDED.role_group;

    RETURN jsonb_build_object('ok', true, 'deletedRole', false);
  END IF;

  DELETE FROM public.platform_access_grants
  WHERE role_id = _role_id AND org_type = _org_type;

  DELETE FROM public.platform_access_role_org_types
  WHERE role_id = _role_id AND org_type = _org_type;

  SELECT count(*)::integer INTO v_remaining
  FROM public.platform_access_role_org_types
  WHERE role_id = _role_id;

  IF v_remaining = 0 THEN
    IF v_role.is_system THEN
      RAISE EXCEPTION 'Não é possível remover o último vínculo de um cargo de sistema';
    END IF;
    DELETE FROM public.platform_access_grants WHERE role_id = _role_id;
    DELETE FROM public.platform_access_roles WHERE id = _role_id;
    RETURN jsonb_build_object('ok', true, 'deletedRole', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'deletedRole', false);
END;
$$;
