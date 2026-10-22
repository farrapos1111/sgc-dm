-- Correções da auditoria de segurança (out/2026).
--
-- 1) Remove o cadastro público por ID DeMolay (lia/alterava PII de qualquer
--    membro, inclusive menores) e cria update_my_member_cadastro (dono via
--    auth.uid()).
-- 2) Vínculo conta↔membro apenas por members.user_id: is_linked_member deixa de
--    aceitar e-mail; user_id só muda via servidor (service_role / SECURITY DEFINER).
-- 3) Atas públicas: acesso/voto como membro exige login; senha com throttle;
--    senhas saem de chapters.settings (legível por qualquer membro).
-- 4) CPF/RG do indicado mascarados no link de participação da sindicância.
-- 5) Funções SECURITY DEFINER deixam de ser executáveis por anon (exceto a
--    allowlist de RPCs públicas) — inclui a matriz platform_access.

-- ---------------------------------------------------------------------------
-- 0) Throttle: novos escopos
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_login_throttle
  DROP CONSTRAINT IF EXISTS auth_login_throttle_scope_check;

ALTER TABLE public.auth_login_throttle
  ADD CONSTRAINT auth_login_throttle_scope_check
  CHECK (scope IN ('ip', 'identifier', 'org_join', 'minute_password', 'password_reset', 'ai'));

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
  IF _scope IS NULL OR _scope NOT IN ('ip', 'identifier', 'org_join', 'minute_password', 'password_reset', 'ai') THEN
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

-- ---------------------------------------------------------------------------
-- 1) Cadastro: remove caminhos anônimos por ID DeMolay
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.lookup_member_cadastro_by_demolay_id(text);
DROP FUNCTION IF EXISTS public.submit_member_cadastro_update(text, text, text, jsonb, text, text, jsonb);
DROP FUNCTION IF EXISTS public.lookup_lobby_member_cadastro(text, text);
DROP FUNCTION IF EXISTS public.submit_lobby_member_cadastro(text, text, text, text, jsonb, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.update_my_member_cadastro(
  _member_id uuid,
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
  v_uid uuid := auth.uid();
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = _member_id
  FOR UPDATE;

  IF NOT FOUND OR v_member.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Este cadastro não está vinculado à sua conta' USING ERRCODE = '42501';
  END IF;

  -- Telefone
  IF coalesce(v_member.phone, '') IS DISTINCT FROM coalesce(v_phone, '') THEN
    v_old := v_old || jsonb_build_object('phone', v_member.phone);
    v_new := v_new || jsonb_build_object('phone', v_phone);
    v_changed := true;
  END IF;

  -- Email
  IF coalesce(v_member.email, '') IS DISTINCT FROM coalesce(v_email, '') THEN
    v_old := v_old || jsonb_build_object('email', v_member.email);
    v_new := v_new || jsonb_build_object('email', v_email);
    v_changed := true;
  END IF;

  -- Endereço
  IF coalesce(v_member.address, '{}'::jsonb) IS DISTINCT FROM v_address THEN
    v_old := v_old || jsonb_build_object('address', coalesce(v_member.address, '{}'::jsonb));
    v_new := v_new || jsonb_build_object('address', v_address);
    v_changed := true;
  END IF;

  -- CPF (só se informado)
  IF length(v_cpf_clean) > 0 THEN
    v_old := v_old || jsonb_build_object('cpf_last2', v_member.cpf_last2);
    v_new := v_new || jsonb_build_object('cpf_last2', right(v_cpf_clean, 2));
    v_changed := true;
  END IF;

  -- RG (só se informado)
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

  -- Responsáveis: atualiza só relationship/cpf/phone/email (nome permanece)
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
    v_uid,
    'member_cadastro_self_update',
    'members',
    v_member.id,
    v_old || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name),
    v_new || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name, 'source', 'perfil')
  );

  RETURN jsonb_build_object('ok', true, 'changed', true, 'member_id', v_member.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_member_cadastro(uuid, text, text, jsonb, text, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_member_cadastro(uuid, text, text, jsonb, text, text, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Vínculo por user_id
-- ---------------------------------------------------------------------------

-- 2a) user_id só pode ser gravado pelo servidor. Chamadas PostgREST rodam como
--     anon/authenticated; SECURITY DEFINER (owner) e service_role passam.
CREATE OR REPLACE FUNCTION public.tg_guard_member_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    (TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id)
  ) THEN
    RAISE EXCEPTION 'O vínculo de conta (user_id) só pode ser alterado pelo provisionamento de contas'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_guard_member_user_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_members_guard_user_id ON public.members;
CREATE TRIGGER trg_members_guard_user_id
  BEFORE INSERT OR UPDATE OF user_id ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_member_user_id();

DROP TRIGGER IF EXISTS trg_fdj_members_guard_user_id ON public.fdj_members;
CREATE TRIGGER trg_fdj_members_guard_user_id
  BEFORE INSERT OR UPDATE OF user_id ON public.fdj_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_member_user_id();

DROP TRIGGER IF EXISTS trg_loja_members_guard_user_id ON public.loja_members;
CREATE TRIGGER trg_loja_members_guard_user_id
  BEFORE INSERT OR UPDATE OF user_id ON public.loja_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_guard_member_user_id();

-- 2b) Backfill: preserva o acesso de quem dependia do vínculo por e-mail.
--     Só e-mails confirmados no Auth, correspondência 1:1, conta ainda sem
--     membro vinculado e sem alteração de e-mail pelo formulário público.
WITH candidates AS (
  SELECT m.id AS member_id, u.id AS user_id
  FROM public.members m
  JOIN auth.users u
    ON lower(u.email) = lower(trim(m.email))
  JOIN public.profiles p ON p.id = u.id
  WHERE m.user_id IS NULL
    AND m.email IS NOT NULL
    AND length(trim(m.email)) > 0
    AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.members m2 WHERE m2.user_id = u.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.audit_logs a
      WHERE a.record_id = m.id
        AND a.action = 'member_cadastro_self_update'
        AND a.new_value ? 'email'
    )
),
uniq AS (
  SELECT c.member_id, c.user_id
  FROM candidates c
  WHERE (SELECT count(*) FROM candidates c2 WHERE c2.user_id = c.user_id) = 1
    AND (SELECT count(*) FROM candidates c3 WHERE c3.member_id = c.member_id) = 1
)
UPDATE public.members m
SET user_id = uniq.user_id
FROM uniq
WHERE m.id = uniq.member_id;

-- 2c) is_linked_member: somente user_id (e-mail é editável e não prova titularidade).
CREATE OR REPLACE FUNCTION public.is_linked_member(_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = _member_id
        AND m.user_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- 3) Atas: senhas fora de chapters.settings + throttle + membro com login
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chapter_minute_passwords (
  chapter_id uuid NOT NULL REFERENCES public.chapters (id) ON DELETE CASCADE,
  kind public.minute_kind NOT NULL,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  PRIMARY KEY (chapter_id, kind)
);

COMMENT ON TABLE public.chapter_minute_passwords IS
  'Senhas do link público de ata por tipo. Sem policies: acesso só via RPCs SECURITY DEFINER.';

ALTER TABLE public.chapter_minute_passwords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chapter_minute_passwords FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chapter_minute_passwords TO service_role;

INSERT INTO public.chapter_minute_passwords (chapter_id, kind, password)
SELECT c.id, k.kind::public.minute_kind, trim(c.settings -> 'minute_passwords' ->> k.kind)
FROM public.chapters c
CROSS JOIN (VALUES ('publica'), ('grau_iniciatico'), ('grau_demolay')) AS k(kind)
WHERE jsonb_typeof(c.settings -> 'minute_passwords') = 'object'
  AND nullif(trim(coalesce(c.settings -> 'minute_passwords' ->> k.kind, '')), '') IS NOT NULL
ON CONFLICT (chapter_id, kind) DO NOTHING;

UPDATE public.chapters
SET settings = settings - 'minute_passwords'
WHERE settings ? 'minute_passwords';

-- patch_chapter_settings não aceita mais minute_passwords
CREATE OR REPLACE FUNCTION public.patch_chapter_settings(
  _chapter_id uuid,
  _patch jsonb,
  _primary_color text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_key text;
  v_val jsonb;
  v_old jsonb;
  v_allowed text[] := ARRAY[
    'sindicancia_chave_template',
    'sindicancia_parecer_template',
    'pix_key',
    'pix_qr_path',
    'chave_template',
    'dues_enabled',
    'theme',
    'calendar_type_labels'
  ];
BEGIN
  IF NOT (
    public.has_permission(_chapter_id, 'admin')
    OR public.has_permission(_chapter_id, 'tesouraria')
    OR public.has_permission(_chapter_id, 'secretaria')
    OR public.has_any_role(
      _chapter_id,
      ARRAY[
        'mestre_conselheiro',
        'admin_total',
        'escrivao',
        'presidente_conselho',
        'tesoureiro'
      ]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar configurações'
      USING ERRCODE = '42501';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch inválido';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Chave de configuração não permitida: %', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF _primary_color IS NOT NULL THEN
    IF _primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'primary_color inválida';
    END IF;
    UPDATE public.chapters
    SET primary_color = upper(_primary_color)
    WHERE id = _chapter_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Capítulo não encontrado';
    END IF;
  END IF;

  SELECT coalesce(c.settings, '{}'::jsonb)
  INTO v_settings
  FROM public.chapters c
  WHERE c.id = _chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    v_old := v_settings -> v_key;

    IF v_val IS NULL
       OR v_val = 'null'::jsonb
       OR v_val = '""'::jsonb
    THEN
      v_settings := v_settings - v_key;
    ELSE
      v_settings := jsonb_set(v_settings, ARRAY[v_key], v_val, true);
    END IF;

    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      _chapter_id,
      auth.uid(),
      'settings_patch',
      'chapters',
      _chapter_id,
      jsonb_build_object(
        'key', v_key,
        'old', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
          ELSE v_old
        END,
        'new', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
          WHEN v_val IS NULL OR v_val = 'null'::jsonb OR v_val = '""'::jsonb
          THEN NULL
          ELSE v_val
        END
      )
    );
  END LOOP;

  UPDATE public.chapters
  SET settings = v_settings
  WHERE id = _chapter_id;

  RETURN v_settings;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_chapter_settings(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.patch_chapter_settings(uuid, jsonb, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_minute_passwords(_chapter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(_chapter_id, 'secretaria') THEN
    RAISE EXCEPTION 'Sem permissão para ver as senhas das atas' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(
    (SELECT jsonb_object_agg(p.kind::text, p.password)
     FROM public.chapter_minute_passwords p
     WHERE p.chapter_id = _chapter_id),
    '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_minute_passwords(_chapter_id uuid, _passwords jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_val text;
BEGIN
  IF NOT public.has_permission(_chapter_id, 'secretaria') THEN
    RAISE EXCEPTION 'Apenas Escrivão, Presidente do Conselho ou Mestre Conselheiro podem alterar as senhas das atas'
      USING ERRCODE = '42501';
  END IF;
  IF _passwords IS NULL OR jsonb_typeof(_passwords) <> 'object' THEN
    RAISE EXCEPTION 'Senhas inválidas' USING ERRCODE = '22023';
  END IF;

  FOR v_kind IN SELECT unnest(ARRAY['publica', 'grau_iniciatico', 'grau_demolay'])
  LOOP
    IF NOT (_passwords ? v_kind) THEN
      CONTINUE;
    END IF;
    v_val := nullif(trim(coalesce(_passwords ->> v_kind, '')), '');
    IF v_val IS NOT NULL AND length(v_val) > 64 THEN
      RAISE EXCEPTION 'Senha muito longa' USING ERRCODE = '22023';
    END IF;
    IF v_val IS NULL THEN
      DELETE FROM public.chapter_minute_passwords
      WHERE chapter_id = _chapter_id AND kind = v_kind::public.minute_kind;
    ELSE
      INSERT INTO public.chapter_minute_passwords (chapter_id, kind, password, updated_at, updated_by)
      VALUES (_chapter_id, v_kind::public.minute_kind, v_val, now(), auth.uid())
      ON CONFLICT (chapter_id, kind) DO UPDATE
      SET password = EXCLUDED.password,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    _chapter_id,
    auth.uid(),
    'settings_patch',
    'chapters',
    _chapter_id,
    jsonb_build_object('key', 'minute_passwords', 'old', '[redacted]', 'new', '[redacted]')
  );

  RETURN public.get_minute_passwords(_chapter_id);
END;
$$;

-- Senha do tipo da ata, para quem pode gerar o link (texto de compartilhamento).
CREATE OR REPLACE FUNCTION public.get_minute_share_password(_minute_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute public.session_minutes%ROWTYPE;
BEGIN
  SELECT * INTO v_minute FROM public.session_minutes WHERE id = _minute_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_manage_minute_public_share(v_minute.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar esta ata' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT p.password
    FROM public.chapter_minute_passwords p
    WHERE p.chapter_id = v_minute.chapter_id AND p.kind = v_minute.kind
  );
END;
$$;

-- Verificação de senha com throttle por ata (10 erros / 15 min → 15 min bloqueado).
-- Retorna NULL quando a senha confere; senão a mensagem de erro.
CREATE OR REPLACE FUNCTION public.check_minute_public_password(
  _minute public.session_minutes,
  _password text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := _minute.id::text;
  v_locked timestamptz;
  v_expected text;
BEGIN
  SELECT t.locked_until INTO v_locked
  FROM public.auth_login_throttle t
  WHERE t.scope = 'minute_password' AND t.scope_key = v_key;
  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RETURN 'Muitas tentativas de senha. Tente novamente em alguns minutos.';
  END IF;

  SELECT nullif(trim(p.password), '') INTO v_expected
  FROM public.chapter_minute_passwords p
  WHERE p.chapter_id = _minute.chapter_id AND p.kind = _minute.kind;

  IF v_expected IS NULL THEN
    RETURN 'Senha deste tipo de ata não configurada no capítulo';
  END IF;

  IF coalesce(_password, '') <> v_expected THEN
    PERFORM public.record_login_throttle_failure(
      'minute_password', v_key, 10, 900000, 900000
    );
    RETURN 'Senha incorreta';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_minute(
  _token text,
  _password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_password text := coalesce(_password, '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_check text;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;
  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_minute.calendar_event_id;

  v_check := public.check_minute_public_password(v_minute, v_password);
  IF v_check IS NOT NULL THEN
    -- Retorna (não RAISE) para que a falha registrada no throttle seja persistida.
    RETURN jsonb_build_object('error', v_check);
  END IF;

  RETURN jsonb_build_object(
    'minute', jsonb_build_object(
      'id', v_minute.id,
      'content', v_minute.content,
      'status', v_minute.status,
      'title', v_minute.title,
      'kind', v_minute.kind,
      'updated_at', v_minute.updated_at,
      'voting_open', v_minute.status = 'rascunho'
    ),
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'start_at', v_event.start_at,
      'location', v_event.location
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_minute_by_member(
  _token text,
  _demolay_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_allowed boolean;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;
  -- Acesso de membro exige login: o vínculo é members.user_id = auth.uid().
  -- _demolay_id é mantido na assinatura por compatibilidade e ignorado.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Entre com sua conta para acessar como membro' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;
  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_minute.calendar_event_id;

  SELECT * INTO v_member
  FROM public.members
  WHERE user_id = auth.uid()
    AND (
      chapter_id = v_minute.chapter_id
      OR public.member_visible_in_chapter(id, v_minute.chapter_id)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a um membro deste capítulo'
      USING ERRCODE = '42501';
  END IF;

  v_allowed := public.member_can_access_minute_kind(
    v_member.kind,
    v_member.exam_grau_iniciatico,
    v_member.exam_grau_demolay,
    v_member.iniciacao_ordem,
    v_member.iniciacao_grau_demolay,
    v_minute.kind
  );

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'locked', true,
      'kind', v_minute.kind,
      'member_name', v_member.full_name,
      'chapter', jsonb_build_object(
        'id', v_chapter.id,
        'name', v_chapter.name,
        'number', v_chapter.number,
        'city', v_chapter.city,
        'primary_color', v_chapter.primary_color
      ),
      'event', jsonb_build_object(
        'id', v_event.id,
        'title', v_event.title,
        'start_at', v_event.start_at,
        'location', v_event.location
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'unlocked_by', 'member',
    'demolay_id', v_member.demolay_id,
    'member_name', v_member.full_name,
    'minute', jsonb_build_object(
      'id', v_minute.id,
      'content', v_minute.content,
      'status', v_minute.status,
      'title', v_minute.title,
      'kind', v_minute.kind,
      'updated_at', v_minute.updated_at,
      'voting_open', v_minute.status = 'rascunho'
    ),
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'start_at', v_event.start_at,
      'location', v_event.location
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_public_minute_vote(
  _token text,
  _password text,
  _email text,
  _decision text,
  _justification text DEFAULT NULL,
  _demolay_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_password text := coalesce(_password, '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_email text := lower(trim(coalesce(_email, '')));
  v_decision text := lower(trim(coalesce(_decision, '')));
  v_justification text := nullif(trim(coalesce(_justification, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_row public.minute_public_votes%ROWTYPE;
  v_check text;
  v_ok boolean := false;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  IF v_decision NOT IN ('aprovada', 'reprovada') THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE = '22023';
  END IF;

  IF v_decision = 'reprovada' AND v_justification IS NULL THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovação'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  IF v_minute.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Consulta encerrada — a ata já não está em rascunho'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;

  IF v_demolay IS NOT NULL THEN
    -- Voto como membro: exige login e usa o e-mail verificado da conta.
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Entre com sua conta para votar como membro' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_member
    FROM public.members
    WHERE user_id = auth.uid()
      AND (
        chapter_id = v_minute.chapter_id
        OR public.member_visible_in_chapter(id, v_minute.chapter_id)
      )
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sua conta não está vinculada a um membro deste capítulo'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.member_can_access_minute_kind(
      v_member.kind,
      v_member.exam_grau_iniciatico,
      v_member.exam_grau_demolay,
      v_member.iniciacao_ordem,
      v_member.iniciacao_grau_demolay,
      v_minute.kind
    ) THEN
      RAISE EXCEPTION 'Seu grau não permite acesso a este tipo de ata'
        USING ERRCODE = '42501';
    END IF;

    v_email := lower(coalesce(auth.jwt() ->> 'email', v_email));
    v_ok := true;
  ELSE
    v_check := public.check_minute_public_password(v_minute, v_password);
    IF v_check IS NOT NULL THEN
      RETURN jsonb_build_object('error', v_check);
    END IF;
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.minute_public_votes (
    chapter_id, minute_id, email, decision, justification
  )
  VALUES (
    v_minute.chapter_id,
    v_minute.id,
    v_email,
    v_decision::public.minute_public_vote_decision,
    CASE WHEN v_decision = 'reprovada' THEN v_justification ELSE NULL END
  )
  ON CONFLICT (minute_id, email) DO UPDATE
  SET
    decision = EXCLUDED.decision,
    justification = EXCLUDED.justification,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'vote', jsonb_build_object(
      'id', v_row.id,
      'email', v_row.email,
      'decision', v_row.decision,
      'justification', v_row.justification,
      'updated_at', v_row.updated_at
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.minute_expected_public_password(jsonb, public.minute_kind);

REVOKE ALL ON FUNCTION public.get_minute_passwords(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_minute_passwords(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_minute_share_password(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_minute_public_password(public.session_minutes, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_minute_passwords(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_minute_passwords(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_minute_share_password(uuid) TO authenticated, service_role;

-- Acesso como membro exige sessão.
REVOKE ALL ON FUNCTION public.get_public_minute_by_member(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_minute_by_member(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Sindicância: CPF/RG mascarados no link de participação
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_sindicancia_participation(
  _token text,
  _demolay_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_row public.sindicancia_details%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_file public.investigation_files%ROWTYPE;
  v_role text;
  v_band text;
  v_blocks jsonb;
  v_minute public.sindicancia_minutes%ROWTYPE;
  v_has_minute boolean := false;
  v_padrinho text;
  v_sindicante text;
  v_senior text;
  v_escrivao text;
  v_macom text;
  v_dm text;
  v_has_macom boolean := false;
  v_has_dm boolean := false;
  v_candidate text;
  v_cpf text := '';
  v_rg text := '';
  v_senior_kind text;
  v_senior_council boolean := false;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = '22023';
  END IF;
  IF v_demolay IS NULL THEN
    RAISE EXCEPTION 'Informe o ID DeMolay' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.sindicancia_details
  WHERE participation_token = v_token;

  IF NOT FOUND OR v_row.status NOT IN ('aberta', 'em_andamento') THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_member
  FROM public.members m
  WHERE m.chapter_id = v_row.chapter_id
    AND m.demolay_id IS NOT NULL
    AND lower(trim(m.demolay_id)) = lower(v_demolay)
    AND m.id IN (
      v_row.clerk_member_id,
      v_row.investigator_member_id,
      v_row.senior_member_id
    )
  ORDER BY CASE
    WHEN m.id = v_row.clerk_member_id THEN 0
    WHEN m.id = v_row.investigator_member_id THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este ID não é participante desta sindicância'
      USING ERRCODE = '42501';
  END IF;

  IF v_member.id = v_row.clerk_member_id THEN
    v_role := 'escrivao';
  ELSIF v_member.id = v_row.investigator_member_id THEN
    v_role := 'sindicante';
  ELSE
    v_role := 'senior';
  END IF;

  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_row.calendar_event_id;
  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_row.chapter_id;

  v_band := '18_mais';
  v_macom := NULL;
  v_dm := NULL;
  IF v_row.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.investigation_files WHERE id = v_row.file_id;
    IF FOUND THEN
      v_band := public.sindicancia_age_band(v_file.candidate_birth_date);
      v_candidate := v_file.candidate_name;
      v_has_macom := coalesce(v_file.has_mason_relative, false);
      v_has_dm := coalesce(v_file.has_demolay_relative, false);
      v_padrinho := coalesce(
        (
          SELECT full_name FROM public.members
          WHERE id = v_file.sponsor_member_id
        ),
        nullif(trim(coalesce(v_file.sponsor_text, '')), ''),
        nullif(trim(coalesce(v_file.referred_by, '')), '')
      );
      v_macom := nullif(
        concat_ws(
          ' — ',
          nullif(trim(coalesce(v_file.mason_relative_name, '')), ''),
          nullif(trim(coalesce(v_file.mason_relative_lodge, '')), '')
        ),
        ''
      );
      v_dm := nullif(
        concat_ws(
          ' — ',
          nullif(trim(coalesce(v_file.demolay_relative_name, '')), ''),
          nullif(trim(coalesce(v_file.demolay_relative_chapter, '')), '')
        ),
        ''
      );
      -- Link público: só os 2 últimos dígitos (documento completo fica com a comissão autenticada).
      v_cpf := CASE WHEN nullif(trim(coalesce(v_file.cpf_last2, '')), '') IS NOT NULL
        THEN '***.***.***-' || v_file.cpf_last2 ELSE '' END;
      v_rg := CASE WHEN nullif(trim(coalesce(v_file.rg_last2, '')), '') IS NOT NULL
        THEN '••••••' || v_file.rg_last2 ELSE '' END;
    END IF;
  END IF;

  v_sindicante := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.investigator_member_id),
    nullif(trim(coalesce(v_row.investigator_text, '')), '')
  );
  v_senior := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.senior_member_id),
    nullif(trim(coalesce(v_row.senior_text, '')), '')
  );
  v_escrivao := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.clerk_member_id),
    nullif(trim(coalesce(v_row.clerk_text, '')), '')
  );

  IF v_row.senior_member_id IS NOT NULL THEN
    SELECT m.kind::text INTO v_senior_kind
    FROM public.members m
    WHERE m.id = v_row.senior_member_id;

    v_senior_council := EXISTS (
      SELECT 1
      FROM public.member_positions mp
      JOIN public.position_org_types pot ON pot.position_id = mp.position_id
      WHERE mp.member_id = v_row.senior_member_id
        AND mp.chapter_id = v_row.chapter_id
        AND mp.ended_at IS NULL
        AND pot.org_type = 'capitulo'
        AND pot.role_group = 'conselho'
        AND mp.term_year = extract(year FROM (v_event.start_at AT TIME ZONE 'America/Sao_Paulo'))::int
        AND mp.term_semester = CASE
          WHEN extract(month FROM (v_event.start_at AT TIME ZONE 'America/Sao_Paulo')) <= 6 THEN 1
          ELSE 2
        END
    );
  END IF;

  v_blocks := coalesce(
    v_chapter.settings->'sindicancia_ata_templates'->v_band->'blocks',
    '[]'::jsonb
  );
  IF jsonb_typeof(v_blocks) IS DISTINCT FROM 'array' THEN
    v_blocks := '[]'::jsonb;
  END IF;

  IF v_role = 'escrivao' THEN
    SELECT * INTO v_minute
    FROM public.sindicancia_minutes
    WHERE calendar_event_id = v_row.calendar_event_id;
    v_has_minute := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'role', v_role,
    'participant_name', v_member.full_name,
    'age_band', v_band,
    'chapter', jsonb_build_object(
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'title', coalesce(v_event.title, v_row.nominee_name),
      'start_at', v_event.start_at,
      'location', coalesce(nullif(trim(coalesce(v_event.location, '')), ''), v_event.address)
    ),
    'chave', jsonb_build_object(
      'template', v_chapter.settings->>'sindicancia_chave_template',
      'chapter_name', v_chapter.name,
      'nominee', coalesce(nullif(trim(v_row.nominee_name), ''), v_event.title),
      'padrinho', coalesce(v_padrinho, ''),
      'start_at', v_event.start_at,
      'location', coalesce(nullif(trim(coalesce(v_event.location, '')), ''), v_event.address, ''),
      'sindicante', coalesce(v_sindicante, ''),
      'senior', coalesce(v_senior, ''),
      'escrivao', coalesce(v_escrivao, '')
    ),
    'names', jsonb_build_object(
      'sindicante', coalesce(v_sindicante, ''),
      'senior', coalesce(v_senior, ''),
      'escrivao', coalesce(v_escrivao, ''),
      'nominee', coalesce(nullif(trim(v_row.nominee_name), ''), '')
    ),
    'candidate_cpf', coalesce(v_cpf, ''),
    'candidate_rg', coalesce(v_rg, ''),
    'senior_kind', v_senior_kind,
    'senior_on_council', v_senior_council,
    'blocks', v_blocks,
    'prefill', CASE
      WHEN v_role = 'escrivao' THEN jsonb_build_object(
        'pre_nome', coalesce(nullif(trim(v_row.nominee_name), ''), v_candidate, ''),
        'pre_macom', v_has_macom,
        'pre_macom_grau', coalesce(v_macom, ''),
        'pre_demolay', v_has_dm,
        'pre_demolay_grau', coalesce(v_dm, '')
      )
      ELSE NULL
    END,
    'minute', CASE
      WHEN v_has_minute THEN jsonb_build_object(
        'answers', coalesce(v_minute.answers, '{}'::jsonb),
        'signatures', coalesce(v_minute.signatures, '{}'::jsonb),
        'completed_at', v_minute.completed_at
      )
      ELSE NULL
    END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) anon: só a allowlist de RPCs públicas executa funções SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- No Supabase, funções novas em public recebem EXECUTE direto para anon e
-- authenticated (default privileges); "REVOKE ... FROM PUBLIC" não basta.
REVOKE ALL ON FUNCTION public.set_platform_access_role_org_type(uuid, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reorder_platform_access_roles(text, text, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_access_role_org_type(uuid, text, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reorder_platform_access_roles(text, text, uuid[])
  TO service_role;

DO $$
DECLARE
  r record;
  v_public_rpcs text[] := ARRAY[
    'get_public_attendance_overview',
    'get_public_calendar',
    'get_public_cash_flow',
    'get_public_lobby',
    'get_public_member_portal',
    'get_public_minute',
    'get_public_nominata',
    'get_public_year_dues',
    'list_investigation_signup_members',
    'list_org_join_catalog',
    'normalize_demolay_id',
    'peek_public_minute',
    'public_org_slug_for_token',
    'resolve_investigation_signup_chapter',
    'resolve_public_org_path',
    'resolve_sindicancia_participation',
    'save_sindicancia_participation_minute',
    'submit_investigation_signup',
    'submit_org_join_request',
    'submit_public_minute_vote'
  ];
BEGIN
  FOR r IN
    SELECT
      p.oid::regprocedure AS sig,
      p.proname,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_ok
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
  LOOP
    IF r.proname = ANY (v_public_rpcs) THEN
      CONTINUE;
    END IF;
    -- Preserva quem já executava (inclusive via PUBLIC) antes de revogar PUBLIC.
    IF r.auth_ok THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    IF r.svc_ok THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END;
$$;

-- Funções futuras: anon só com GRANT explícito na migration
-- (authenticated/service_role continuam recebendo pelo default do schema).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
