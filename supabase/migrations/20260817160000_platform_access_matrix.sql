-- Matriz global de permissões por cargo × tipo de instituição × tela.

CREATE TABLE IF NOT EXISTS public.platform_access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  match_kind text NOT NULL
    CHECK (match_kind IN ('position', 'role_fallback', 'commission_president', 'account_role')),
  match_code text NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_access_screens (
  id text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.platform_access_grants (
  role_id uuid NOT NULL REFERENCES public.platform_access_roles(id) ON DELETE CASCADE,
  org_type text NOT NULL
    CHECK (org_type IN ('capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro')),
  screen_id text NOT NULL REFERENCES public.platform_access_screens(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, org_type, screen_id)
);

CREATE INDEX IF NOT EXISTS platform_access_grants_org_type_idx
  ON public.platform_access_grants (org_type);
CREATE INDEX IF NOT EXISTS platform_access_grants_role_id_idx
  ON public.platform_access_grants (role_id);

ALTER TABLE public.platform_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_access_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_access_roles_select ON public.platform_access_roles;
CREATE POLICY platform_access_roles_select ON public.platform_access_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS platform_access_screens_select ON public.platform_access_screens;
CREATE POLICY platform_access_screens_select ON public.platform_access_screens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS platform_access_grants_select ON public.platform_access_grants;
CREATE POLICY platform_access_grants_select ON public.platform_access_grants
  FOR SELECT TO authenticated USING (true);

-- Escrita apenas via service role / server functions (sem policies de write para authenticated).

INSERT INTO public.platform_access_screens (id, label, sort_order) VALUES
  ('inicio', 'Início', 10),
  ('perfil', 'Perfil', 20),
  ('membros', 'Membros', 30),
  ('atas', 'Atas', 40),
  ('oficios', 'Ofícios', 50),
  ('presencas', 'Presenças', 60),
  ('caixa', 'Fluxo de Caixa', 70),
  ('mensalidades', 'Mensalidades', 80),
  ('cobrancas', 'Cobranças', 90),
  ('calendario', 'Calendário', 100),
  ('gestao', 'Cargos e Comissões', 110),
  ('configuracoes', 'Configurações', 120),
  ('eventos', 'Eventos', 130),
  ('eventos_checkins', 'Check-ins de Eventos', 140),
  ('sindicancias_fichas', 'Fichas de Sindicância', 150),
  ('sindicancias', 'Sindicâncias', 160),
  ('sindicancias_config', 'Config. Sindicâncias', 170),
  ('permissoes', 'Permissões', 180)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

INSERT INTO public.platform_access_roles (key, label, is_system, match_kind, match_code, sort_order) VALUES
  ('membro', 'Membros Comuns', true, 'role_fallback', 'membro', 10),
  ('pcc', 'Presidente do Conselho Consultivo', true, 'position', 'presidente_conselho_consultivo', 20),
  ('mc', 'Mestre Conselheiro', true, 'position', 'mestre_conselheiro', 30),
  ('1c', 'Primeiro Conselheiro', true, 'position', 'primeiro_conselheiro', 40),
  ('2c', 'Segundo Conselheiro', true, 'position', 'segundo_conselheiro', 50),
  ('tes', 'Tesoureiro', true, 'position', 'tesoureiro', 60),
  ('esc', 'Escrivão', true, 'position', 'escrivao', 70),
  ('cc', 'Conselheiro Consultor', true, 'position', 'conselheiro_consultor', 80),
  ('presidente_comissao', 'Presidentes de Comissão', true, 'commission_president', NULL, 90)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  is_system = EXCLUDED.is_system,
  match_kind = EXCLUDED.match_kind,
  match_code = EXCLUDED.match_code,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Também mapear roles de conta legados (além de cargos do termo).
INSERT INTO public.platform_access_roles (key, label, is_system, match_kind, match_code, sort_order) VALUES
  ('account_mc', 'MC (conta)', true, 'account_role', 'mestre_conselheiro', 1000),
  ('account_esc', 'Esc (conta)', true, 'account_role', 'escrivao', 1010),
  ('account_tes', 'Tes (conta)', true, 'account_role', 'tesoureiro', 1020),
  ('account_cc', 'CC (conta)', true, 'account_role', 'consultor', 1030),
  ('account_pcc', 'PCC (conta)', true, 'account_role', 'presidente_conselho', 1040),
  ('account_pres_com', 'Pres. Comissão (conta)', true, 'account_role', 'presidente_comissao', 1050)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_org text;
  v_role_key text;
  v_role_id uuid;
  v_screens text[];
  v_s text;
  -- flags: view, edit, create, delete as bit pattern via variables
BEGIN
  -- Helper: apply template per role key for all org types
  FOREACH v_org IN ARRAY ARRAY['capitulo','bethel','loja','priorado','castelo','apj','outro']
  LOOP
    -- membro: básicos
    SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = 'membro';
    FOREACH v_s IN ARRAY ARRAY['inicio','perfil','calendario','gestao']
    LOOP
      INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
      VALUES (v_role_id, v_org, v_s, true, false, false, false)
      ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
    END LOOP;

    -- 1c / 2c: view total (sem CUD, sem permissoes)
    FOREACH v_role_key IN ARRAY ARRAY['1c','2c']
    LOOP
      SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = v_role_key;
      FOR v_s IN
        SELECT id FROM public.platform_access_screens WHERE id <> 'permissoes'
      LOOP
        INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
        VALUES (v_role_id, v_org, v_s, true, false, false, false)
        ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- esc + account_esc: secretaria CUD + view amplo
    FOREACH v_role_key IN ARRAY ARRAY['esc','account_esc']
    LOOP
      SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = v_role_key;
      FOR v_s IN SELECT id FROM public.platform_access_screens WHERE id <> 'permissoes'
      LOOP
        INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
        VALUES (
          v_role_id, v_org, v_s, true,
          v_s IN ('membros','atas','oficios','presencas','calendario','gestao','configuracoes','sindicancias_fichas','sindicancias','sindicancias_config'),
          v_s IN ('membros','atas','oficios','presencas','calendario'),
          v_s IN ('membros','atas','oficios','calendario')
        )
        ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- tes + account_tes
    FOREACH v_role_key IN ARRAY ARRAY['tes','account_tes']
    LOOP
      SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = v_role_key;
      FOR v_s IN SELECT id FROM public.platform_access_screens WHERE id <> 'permissoes'
      LOOP
        INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
        VALUES (
          v_role_id, v_org, v_s, true,
          v_s IN ('caixa','mensalidades','cobrancas','eventos'),
          v_s IN ('caixa','mensalidades','cobrancas'),
          v_s IN ('caixa','mensalidades','cobrancas')
        )
        ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- presidente comissão
    FOREACH v_role_key IN ARRAY ARRAY['presidente_comissao','account_pres_com']
    LOOP
      SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = v_role_key;
      FOREACH v_s IN ARRAY ARRAY[
        'inicio','perfil','calendario','gestao',
        'eventos','eventos_checkins',
        'sindicancias_fichas','sindicancias','sindicancias_config'
      ]
      LOOP
        INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
        VALUES (
          v_role_id, v_org, v_s, true,
          v_s IN ('eventos','eventos_checkins','sindicancias_fichas','sindicancias','sindicancias_config','gestao'),
          v_s IN ('eventos','sindicancias_fichas','sindicancias'),
          v_s IN ('eventos','sindicancias')
        )
        ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
      END LOOP;
    END LOOP;

    -- mc / pcc / cc (+ account aliases): full minus permissoes
    FOREACH v_role_key IN ARRAY ARRAY['mc','pcc','cc','account_mc','account_pcc','account_cc']
    LOOP
      SELECT id INTO v_role_id FROM public.platform_access_roles WHERE key = v_role_key;
      FOR v_s IN SELECT id FROM public.platform_access_screens WHERE id <> 'permissoes'
      LOOP
        INSERT INTO public.platform_access_grants (role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete)
        VALUES (v_role_id, v_org, v_s, true, true, true, true)
        ON CONFLICT (role_id, org_type, screen_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Copia grants de cargos “visíveis” para aliases de conta a partir dos cargos canônicos (já feitos acima).
-- Roles account_* hidden from UI via sort_order >= 1000.

CREATE OR REPLACE FUNCTION public.platform_matching_role_ids(_chapter_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[] := ARRAY[]::uuid[];
  v_role_name text;
  v_year int;
  v_semester int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN v_ids;
  END IF;

  -- Termo atual (mesmo critério aproximado do app: ano civil + semestre por mês)
  v_year := EXTRACT(YEAR FROM now())::int;
  v_semester := CASE WHEN EXTRACT(MONTH FROM now())::int <= 6 THEN 1 ELSE 2 END;

  SELECT r.name INTO v_role_name
  FROM public.chapter_members cm
  JOIN public.roles r ON r.id = cm.role_id
  WHERE cm.user_id = v_uid
    AND cm.chapter_id = _chapter_id
    AND cm.active IS TRUE
  LIMIT 1;

  IF v_role_name = 'admin_total' THEN
    RETURN v_ids; -- bypass no has_permission
  END IF;

  -- Fallback membro
  v_ids := v_ids || ARRAY(
    SELECT id FROM public.platform_access_roles
    WHERE match_kind = 'role_fallback' AND match_code = 'membro'
  );

  -- Role de conta
  IF v_role_name IS NOT NULL THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles
      WHERE match_kind = 'account_role' AND match_code = v_role_name
    );
  END IF;

  -- Cargos do termo
  v_ids := v_ids || ARRAY(
    SELECT DISTINCT par.id
    FROM public.platform_access_roles par
    JOIN public.positions p ON p.code = par.match_code
    JOIN public.member_positions mp ON mp.position_id = p.id
    JOIN public.members m ON m.id = mp.member_id
    WHERE par.match_kind = 'position'
      AND mp.chapter_id = _chapter_id
      AND mp.term_year = v_year
      AND mp.term_semester = v_semester
      AND mp.ended_at IS NULL
      AND m.user_id = v_uid
  );

  -- Presidente de comissão no termo
  IF EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.term_year = v_year
      AND cm.term_semester = v_semester
      AND cm.role = 'presidente'
      AND m.user_id = v_uid
  ) THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles
      WHERE match_kind = 'commission_president'
    );
  END IF;

  RETURN (SELECT ARRAY(SELECT DISTINCT unnest(v_ids)));
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_has_screen_action(
  _chapter_id uuid,
  _screen_id text,
  _action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org text;
  v_ids uuid[];
BEGIN
  IF public.has_any_role(_chapter_id, ARRAY['admin_total']) THEN
    RETURN true;
  END IF;

  SELECT coalesce(c.org_type, 'capitulo') INTO v_org
  FROM public.chapters c WHERE c.id = _chapter_id;

  IF v_org IS NULL THEN
    RETURN false;
  END IF;

  v_ids := public.platform_matching_role_ids(_chapter_id);
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.platform_access_grants g
    WHERE g.role_id = ANY (v_ids)
      AND g.org_type = v_org
      AND g.screen_id = _screen_id
      AND CASE _action
        WHEN 'view' THEN g.can_view
        WHEN 'edit' THEN g.can_edit
        WHEN 'create' THEN g.can_create
        WHEN 'delete' THEN g.can_delete
        ELSE false
      END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_org_type_has_any_view(_org_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_year int;
  v_semester int;
  v_role_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Qualquer membership admin_total
  IF EXISTS (
    SELECT 1
    FROM public.chapter_members cm
    JOIN public.roles r ON r.id = cm.role_id
    WHERE cm.user_id = v_uid AND cm.active IS TRUE AND r.name = 'admin_total'
  ) THEN
    RETURN true;
  END IF;

  v_year := EXTRACT(YEAR FROM now())::int;
  v_semester := CASE WHEN EXTRACT(MONTH FROM now())::int <= 6 THEN 1 ELSE 2 END;

  -- Agregar roles potenciais do usuário em qualquer capítulo (aprox. para filtro de lista)
  v_ids := ARRAY(
    SELECT id FROM public.platform_access_roles
    WHERE match_kind = 'role_fallback' AND match_code = 'membro'
  );

  v_ids := v_ids || ARRAY(
    SELECT DISTINCT par.id
    FROM public.platform_access_roles par
    JOIN public.roles r ON par.match_kind = 'account_role' AND par.match_code = r.name
    JOIN public.chapter_members cm ON cm.role_id = r.id
    WHERE cm.user_id = v_uid AND cm.active IS TRUE
  );

  v_ids := v_ids || ARRAY(
    SELECT DISTINCT par.id
    FROM public.platform_access_roles par
    JOIN public.positions p ON p.code = par.match_code
    JOIN public.member_positions mp ON mp.position_id = p.id
    JOIN public.members m ON m.id = mp.member_id
    WHERE par.match_kind = 'position'
      AND mp.term_year = v_year
      AND mp.term_semester = v_semester
      AND mp.ended_at IS NULL
      AND m.user_id = v_uid
  );

  IF EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.term_year = v_year
      AND cm.term_semester = v_semester
      AND cm.role = 'presidente'
      AND m.user_id = v_uid
  ) THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles WHERE match_kind = 'commission_president'
    );
  END IF;

  v_ids := (SELECT ARRAY(SELECT DISTINCT unnest(v_ids)));

  RETURN EXISTS (
    SELECT 1
    FROM public.platform_access_grants g
    WHERE g.role_id = ANY (v_ids)
      AND g.org_type = _org_type
      AND g.can_view IS TRUE
  );
END;
$$;

-- has_permission passa a derivar buckets da matriz (com bypass admin_total).
CREATE OR REPLACE FUNCTION public.has_permission(_chapter_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_any_role(_chapter_id, ARRAY['admin_total']) THEN
    RETURN true;
  END IF;

  IF NOT public.is_chapter_member(_chapter_id) THEN
    RETURN false;
  END IF;

  CASE _perm
    WHEN 'admin' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'configuracoes', 'edit')
        AND public.platform_has_screen_action(_chapter_id, 'gestao', 'edit');
    WHEN 'secretaria' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'membros', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'atas', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'oficios', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'presencas', 'edit');
    WHEN 'tesouraria' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'caixa', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'mensalidades', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'cobrancas', 'edit');
    WHEN 'comissoes' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'eventos', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'sindicancias', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'sindicancias_fichas', 'edit');
    WHEN 'conselho' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'configuracoes', 'edit')
        OR public.platform_has_screen_action(_chapter_id, 'gestao', 'edit');
    WHEN 'visualizar' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'inicio', 'view')
        OR public.platform_has_screen_action(_chapter_id, 'perfil', 'view')
        OR public.is_chapter_member(_chapter_id);
    WHEN 'visualizar_total' THEN
      RETURN public.platform_has_screen_action(_chapter_id, 'membros', 'view')
        AND public.platform_has_screen_action(_chapter_id, 'caixa', 'view');
    ELSE
      RETURN public.is_chapter_member(_chapter_id);
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_matching_role_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_has_screen_action(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_org_type_has_any_view(text) TO authenticated;
