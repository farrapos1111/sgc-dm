-- Regressão dos achados da auditoria de segurança (out/2026).
--
-- Roda contra um banco com as migrations aplicadas (Postgres com stubs do
-- Supabase: roles anon/authenticated/service_role e auth.uid() lendo
-- request.jwt.claim.sub). Cada bloco tenta o exploit e falha com
-- 'VULNERAVEL: ...' se ele ainda funcionar. Executa em transação e desfaz tudo.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/security_audit_regression.sql

BEGIN;

-- Fixtures ------------------------------------------------------------------
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'atacante@example.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'vitima@example.com', now());
INSERT INTO public.profiles (id, full_name) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'Atacante'),
  ('b0000000-0000-0000-0000-00000000000b', 'Vitima')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.chapters (id, name, number) VALUES
  ('c0000000-0000-0000-0000-00000000000c', 'Capitulo Teste', '9999');

INSERT INTO public.members (id, chapter_id, full_name, demolay_id, email, phone, birth_date, user_id) VALUES
  ('d0000000-0000-0000-0000-0000000000d1', 'c0000000-0000-0000-0000-00000000000c',
   'Membro Menor', '157789', 'menor@example.com', '54999990000', '2011-05-01', NULL),
  ('d0000000-0000-0000-0000-0000000000d2', 'c0000000-0000-0000-0000-00000000000c',
   'Membro Atacante', '157790', 'outro@example.com', NULL, '2005-01-01',
   'a0000000-0000-0000-0000-00000000000a');

INSERT INTO public.calendar_events (id, chapter_id, title, event_type, start_at)
VALUES ('e0000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-00000000000c',
        'Sessao', 'sessao_ritualistica', now());
INSERT INTO public.session_minutes (id, chapter_id, calendar_event_id, content, kind, public_share_token)
VALUES ('f0000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-00000000000c',
        'e0000000-0000-0000-0000-00000000000e', 'conteudo sigiloso', 'grau_demolay',
        repeat('t', 40));
INSERT INTO public.chapter_minute_passwords (chapter_id, kind, password)
VALUES ('c0000000-0000-0000-0000-00000000000c', 'grau_demolay', 'segredo-certo');

-- C1: cadastro público por ID DeMolay não existe mais ----------------------
DO $$
BEGIN
  IF to_regprocedure('public.lookup_member_cadastro_by_demolay_id(text)') IS NOT NULL
     OR to_regprocedure('public.submit_member_cadastro_update(text,text,text,jsonb,text,text,jsonb)') IS NOT NULL
     OR to_regprocedure('public.lookup_lobby_member_cadastro(text,text)') IS NOT NULL
     OR to_regprocedure('public.submit_lobby_member_cadastro(text,text,text,text,jsonb,text,text,jsonb)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'VULNERAVEL: RPC anônima de cadastro por ID DeMolay ainda existe';
  END IF;
END $$;

-- C1b: update_my_member_cadastro só altera o próprio cadastro ---------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_my_member_cadastro(
      'd0000000-0000-0000-0000-0000000000d1', '0', 'atacante@example.com', '{}'::jsonb, NULL, NULL, '[]'::jsonb);
    RAISE EXCEPTION 'VULNERAVEL: alterou cadastro de outro membro';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.update_my_member_cadastro(
    'd0000000-0000-0000-0000-0000000000d2', '54988887777', 'outro@example.com', '{}'::jsonb, NULL, NULL, '[]'::jsonb);
END $$;
RESET ROLE;

-- A1: is_linked_member não aceita mais e-mail --------------------------------
UPDATE public.members SET email = 'atacante@example.com'
WHERE id = 'd0000000-0000-0000-0000-0000000000d1';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', true);
SELECT set_config('request.jwt.claims', '{"email":"atacante@example.com"}', true);
DO $$
BEGIN
  IF public.is_linked_member('d0000000-0000-0000-0000-0000000000d1') THEN
    RAISE EXCEPTION 'VULNERAVEL: e-mail igual ao do JWT vincula a membro alheio';
  END IF;
  IF NOT public.is_linked_member('d0000000-0000-0000-0000-0000000000d2') THEN
    RAISE EXCEPTION 'REGRESSAO: vínculo por user_id deixou de funcionar';
  END IF;
END $$;
RESET ROLE;

-- A2: user_id não pode ser gravado via PostgREST (mesmo com RLS permitindo) --
CREATE POLICY tmp_members_all ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.members SET user_id = 'b0000000-0000-0000-0000-00000000000b'
    WHERE id = 'd0000000-0000-0000-0000-0000000000d1';
    RAISE EXCEPTION 'VULNERAVEL: authenticated alterou members.user_id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.members (chapter_id, full_name, user_id)
    VALUES ('c0000000-0000-0000-0000-00000000000c', 'Fantasma', 'b0000000-0000-0000-0000-00000000000b');
    RAISE EXCEPTION 'VULNERAVEL: authenticated inseriu membro com user_id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Outras colunas continuam editáveis
  UPDATE public.members SET phone = '1' WHERE id = 'd0000000-0000-0000-0000-0000000000d1';
END $$;
RESET ROLE;
DROP POLICY tmp_members_all ON public.members;

-- M1: ata por membro exige login --------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.get_public_minute_by_member(repeat('t', 40), '157789');
    RAISE EXCEPTION 'VULNERAVEL: anon abriu ata só com ID DeMolay';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_public_minute_vote(repeat('t', 40), '', 'x@example.com', 'aprovada', NULL, '157789');
    RAISE EXCEPTION 'VULNERAVEL: anon votou como membro só com ID DeMolay';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- M1b: senha errada repetida bloqueia o link ---------------------------------
DO $$
DECLARE
  v jsonb;
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    v := public.get_public_minute(repeat('t', 40), 'chute-' || i);
    IF v ->> 'error' IS NULL THEN
      RAISE EXCEPTION 'VULNERAVEL: senha errada aceita';
    END IF;
  END LOOP;
  v := public.get_public_minute(repeat('t', 40), 'segredo-certo');
  IF v ->> 'error' NOT LIKE 'Muitas tentativas%' THEN
    RAISE EXCEPTION 'VULNERAVEL: sem bloqueio após 10 senhas erradas (%)', v;
  END IF;
END $$;
RESET ROLE;
DELETE FROM public.auth_login_throttle WHERE scope = 'minute_password';
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF public.get_public_minute(repeat('t', 40), 'segredo-certo') ? 'error' THEN
    RAISE EXCEPTION 'REGRESSAO: senha correta recusada';
  END IF;
END $$;

-- M2: senhas de ata não estão em chapters.settings nem na tabela para clientes --
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.chapter_minute_passwords;
    RAISE EXCEPTION 'VULNERAVEL: anon lê chapter_minute_passwords';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.chapters WHERE settings ? 'minute_passwords') THEN
    RAISE EXCEPTION 'VULNERAVEL: minute_passwords ainda em chapters.settings';
  END IF;
END $$;

-- M3: anon não executa funções SECURITY DEFINER fora da allowlist ----------
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname <> ALL (ARRAY[
      'get_public_attendance_overview', 'get_public_calendar', 'get_public_cash_flow',
      'get_public_lobby', 'get_public_member_portal', 'get_public_minute',
      'get_public_nominata', 'get_public_year_dues', 'list_investigation_signup_members',
      'list_org_join_catalog', 'normalize_demolay_id', 'peek_public_minute',
      'public_org_slug_for_token', 'resolve_investigation_signup_chapter',
      'resolve_public_org_path', 'resolve_sindicancia_participation',
      'save_sindicancia_participation_minute', 'submit_investigation_signup',
      'submit_org_join_request', 'submit_public_minute_vote'
    ]);
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'VULNERAVEL: anon executa SECURITY DEFINER: %', v_bad;
  END IF;
  IF has_function_privilege('authenticated',
       'public.set_platform_access_role_org_type(uuid,text,boolean,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'VULNERAVEL: authenticated altera a matriz platform_access';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.has_permission(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESSAO: authenticated perdeu has_permission';
  END IF;
END $$;

ROLLBACK;
\echo 'security_audit_regression: OK'
