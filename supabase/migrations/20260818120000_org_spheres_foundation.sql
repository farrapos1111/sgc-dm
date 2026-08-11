-- =========================================================
-- Fundação multi-esfera (opção 1A / Fase 1)
-- - org_type_defs (billing_model + rollout_scope + form_schema)
-- - potencias + cargo_presets + potencia_org_types
-- - chapters.potencia_id + parent_chapter_id
-- - alumni; remove abelhinhas como org_type
-- - bethel_abelhinhas (sub-registro)
-- - seeds de cargos não-DeMolay (placeholders onde indicado)
-- - org_join_requests + RPC com potencia_id
-- DeMolay (capitulo): intocado em cargos/permissões existentes.
-- =========================================================

-- ---------- 0) Tipos canônicos (sem abelhinhas; + alumni) ----------
CREATE OR REPLACE FUNCTION public._org_type_values()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ARRAY[
    'capitulo', 'priorado', 'castelo', 'bethel',
    'arco_iris', 'apj', 'loja', 'alumni', 'outro'
  ]::text[];
$$;

-- Migrar abelhinhas → bethel antes de apertar CHECKs
UPDATE public.chapters SET org_type = 'bethel' WHERE org_type = 'abelhinhas';
UPDATE public.org_join_requests SET org_type = 'bethel' WHERE org_type = 'abelhinhas';

DELETE FROM public.position_org_types WHERE org_type = 'abelhinhas';
DELETE FROM public.platform_access_role_org_types WHERE org_type = 'abelhinhas';
DELETE FROM public.platform_access_grants WHERE org_type = 'abelhinhas';

-- ---------- 1) org_type_defs ----------
CREATE TABLE IF NOT EXISTS public.org_type_defs (
  org_type text PRIMARY KEY,
  label text NOT NULL,
  unit_label text NOT NULL,
  billing_model text NOT NULL
    CHECK (billing_model IN ('pago', 'gratuito')),
  rollout_scope text NOT NULL DEFAULT 'RS',
  form_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  join_enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_type_defs IS
  'Metadados por tipo de instituição (billing, rollout, labels). Equivalente leve a organization_types.';
COMMENT ON COLUMN public.org_type_defs.billing_model IS
  'pago = Loja Maçônica; gratuito = paramaçônicas.';
COMMENT ON COLUMN public.org_type_defs.rollout_scope IS
  'Região liberada para cadastro (ex.: RS, BR) sem deploy.';
COMMENT ON COLUMN public.org_type_defs.form_schema IS
  'Labels/campos da esfera (unit, admin máximo, ID, grau, sponsor_kind).';

INSERT INTO public.org_type_defs (
  org_type, label, unit_label, billing_model, rollout_scope, form_schema, join_enabled, sort_order
) VALUES
  ('capitulo', 'Capítulo', 'Capítulo', 'gratuito', 'RS',
   '{"admin_max_label":"Mestre Conselheiro","id_field_label":"ID DeMolay","uses_grau":false,"sponsor_kind":"loja","uses_demolay_id":true}'::jsonb,
   true, 10),
  ('loja', 'Loja', 'Loja', 'pago', 'RS',
   '{"admin_max_label":"Venerável Mestre","id_field_label":"Número da Loja","uses_grau":true,"sponsor_kind":null,"uses_demolay_id":false}'::jsonb,
   true, 20),
  ('bethel', 'Bethel', 'Bethel', 'gratuito', 'RS',
   '{"admin_max_label":"Honorável Rainha","id_field_label":"ID FDJ","uses_grau":false,"sponsor_kind":"loja","uses_demolay_id":false}'::jsonb,
   true, 30),
  ('arco_iris', 'Arco Íris', 'Assembleia', 'gratuito', 'RS',
   '{"admin_max_label":"Ilustre Preceptora","id_field_label":"ID Arco-Íris","uses_grau":false,"sponsor_kind":"loja","uses_demolay_id":false}'::jsonb,
   true, 40),
  ('apj', 'APJ', 'Núcleo', 'gratuito', 'RS',
   '{"admin_max_label":"Preceptor","id_field_label":"ID Apejotista","uses_grau":false,"sponsor_kind":"loja","uses_demolay_id":false,"cargos_juvenis":"placeholder"}'::jsonb,
   true, 50),
  ('castelo', 'Castelo', 'Castelo', 'gratuito', 'RS',
   '{"admin_max_label":"Mestre Escudeiro","id_field_label":"ID Escudeiro","uses_grau":false,"sponsor_kind":"capitulo","uses_demolay_id":false}'::jsonb,
   true, 60),
  ('priorado', 'Priorado', 'Priorado', 'gratuito', 'RS',
   '{"admin_max_label":"Ilustre Comendador Cavaleiro","id_field_label":"ID DeMolay","uses_grau":false,"sponsor_kind":"capitulo","uses_demolay_id":true,"reuses_demolay_membership":true}'::jsonb,
   true, 70),
  ('alumni', 'Colégio Alumni', 'Associação', 'gratuito', 'RS',
   '{"admin_max_label":"Presidente","id_field_label":"ID DeMolay (referência)","uses_grau":false,"sponsor_kind":null,"uses_demolay_id":true,"membership_kind":"socio"}'::jsonb,
   true, 80),
  ('outro', 'Outro', 'Organização', 'gratuito', 'RS',
   '{"admin_max_label":"Responsável","id_field_label":"Identificação","uses_grau":false,"sponsor_kind":"loja","uses_demolay_id":false}'::jsonb,
   true, 90)
ON CONFLICT (org_type) DO UPDATE SET
  label = EXCLUDED.label,
  unit_label = EXCLUDED.unit_label,
  billing_model = EXCLUDED.billing_model,
  rollout_scope = EXCLUDED.rollout_scope,
  form_schema = EXCLUDED.form_schema,
  join_enabled = EXCLUDED.join_enabled,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.org_type_defs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_type_defs_select ON public.org_type_defs;
CREATE POLICY org_type_defs_select ON public.org_type_defs
  FOR SELECT TO anon, authenticated USING (true);

-- ---------- 2) potencias ----------
CREATE TABLE IF NOT EXISTS public.potencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sigla text NOT NULL UNIQUE,
  abrangencia text NOT NULL DEFAULT 'nacional'
    CHECK (abrangencia IN ('estadual', 'nacional')),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.potencias IS
  'Potências maçônicas (GOB, GLMEES, etc.). Presets de cargos por potência × tipo.';

INSERT INTO public.potencias (nome, sigla, abrangencia, sort_order) VALUES
  ('Grande Oriente do Brasil', 'GOB', 'nacional', 10),
  ('Grande Loja Maçônica do Estado do Espírito Santo', 'GLMEES', 'estadual', 20),
  ('Grande Loja Maçônica do Estado de São Paulo', 'GLESP', 'estadual', 30)
ON CONFLICT (sigla) DO UPDATE SET
  nome = EXCLUDED.nome,
  abrangencia = EXCLUDED.abrangencia,
  sort_order = EXCLUDED.sort_order,
  active = true;

ALTER TABLE public.potencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS potencias_select ON public.potencias;
CREATE POLICY potencias_select ON public.potencias
  FOR SELECT TO anon, authenticated USING (active);

-- Quais tipos cada potência oferece (APJ só GOB)
CREATE TABLE IF NOT EXISTS public.potencia_org_types (
  potencia_id uuid NOT NULL REFERENCES public.potencias(id) ON DELETE CASCADE,
  org_type text NOT NULL REFERENCES public.org_type_defs(org_type) ON DELETE CASCADE,
  PRIMARY KEY (potencia_id, org_type)
);

INSERT INTO public.potencia_org_types (potencia_id, org_type)
SELECT p.id, t.org_type
FROM public.potencias p
CROSS JOIN (
  VALUES
    ('capitulo'), ('loja'), ('bethel'), ('arco_iris'),
    ('castelo'), ('priorado'), ('alumni'), ('outro')
) AS t(org_type)
ON CONFLICT DO NOTHING;

INSERT INTO public.potencia_org_types (potencia_id, org_type)
SELECT p.id, 'apj'
FROM public.potencias p
WHERE p.sigla = 'GOB'
ON CONFLICT DO NOTHING;

ALTER TABLE public.potencia_org_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS potencia_org_types_select ON public.potencia_org_types;
CREATE POLICY potencia_org_types_select ON public.potencia_org_types
  FOR SELECT TO anon, authenticated USING (true);

-- ---------- 3) cargo_presets (template JSON) ----------
CREATE TABLE IF NOT EXISTS public.cargo_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  potencia_id uuid NOT NULL REFERENCES public.potencias(id) ON DELETE CASCADE,
  org_type text NOT NULL REFERENCES public.org_type_defs(org_type) ON DELETE CASCADE,
  cargos jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (potencia_id, org_type)
);

COMMENT ON TABLE public.cargo_presets IS
  'Template de cargos por potência × tipo. Clone ao criar org; edição local não altera o preset.';

ALTER TABLE public.cargo_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_presets_select ON public.cargo_presets;
CREATE POLICY cargo_presets_select ON public.cargo_presets
  FOR SELECT TO anon, authenticated USING (true);

-- ---------- 4) chapters: potencia + parent ----------
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS potencia_id uuid REFERENCES public.potencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chapters_potencia_id_idx ON public.chapters (potencia_id);
CREATE INDEX IF NOT EXISTS chapters_parent_chapter_id_idx ON public.chapters (parent_chapter_id);

COMMENT ON COLUMN public.chapters.potencia_id IS
  'Potência da organização (Loja/APJ/etc.).';
COMMENT ON COLUMN public.chapters.parent_chapter_id IS
  'Patrocinador: Castelo/Priorado → Capítulo; Bethel/Arco-Íris/APJ → Loja quando houver.';

-- ---------- 5) Ajustar CHECKs de org_type ----------
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_org_type_check;
ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_org_type_check
  CHECK (org_type = ANY (public._org_type_values()));

COMMENT ON COLUMN public.chapters.org_type IS
  'Tipo: capitulo, priorado, castelo, bethel, arco_iris, apj, loja, alumni, outro.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_access_grants'
  ) THEN
    ALTER TABLE public.platform_access_grants
      DROP CONSTRAINT IF EXISTS platform_access_grants_org_type_check;
    ALTER TABLE public.platform_access_grants
      ADD CONSTRAINT platform_access_grants_org_type_check
      CHECK (org_type = ANY (public._org_type_values()));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_access_role_org_types'
  ) THEN
    ALTER TABLE public.platform_access_role_org_types
      DROP CONSTRAINT IF EXISTS platform_access_role_org_types_org_type_check;
    ALTER TABLE public.platform_access_role_org_types
      ADD CONSTRAINT platform_access_role_org_types_org_type_check
      CHECK (org_type = ANY (public._org_type_values()));
  END IF;
END $$;

ALTER TABLE public.position_org_types
  DROP CONSTRAINT IF EXISTS position_org_types_org_type_check;
ALTER TABLE public.position_org_types
  ADD CONSTRAINT position_org_types_org_type_check
  CHECK (org_type = ANY (public._org_type_values()));

-- ---------- 6) bethel_abelhinhas ----------
CREATE TABLE IF NOT EXISTS public.bethel_abelhinhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bethel_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date NULL,
  guardian_name text NULL,
  guardian_phone text NULL,
  notes text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.tg_bethel_abelhinhas_bethel_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = NEW.bethel_id AND c.org_type = 'bethel'
  ) THEN
    RAISE EXCEPTION 'Abelhinhas só podem vincular-se a um Bethel';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bethel_abelhinhas_bethel ON public.bethel_abelhinhas;
CREATE TRIGGER trg_bethel_abelhinhas_bethel
  BEFORE INSERT OR UPDATE OF bethel_id ON public.bethel_abelhinhas
  FOR EACH ROW EXECUTE PROCEDURE public.tg_bethel_abelhinhas_bethel_only();

CREATE INDEX IF NOT EXISTS bethel_abelhinhas_bethel_idx
  ON public.bethel_abelhinhas (bethel_id) WHERE active;

ALTER TABLE public.bethel_abelhinhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bethel_abelhinhas_select ON public.bethel_abelhinhas;
CREATE POLICY bethel_abelhinhas_select ON public.bethel_abelhinhas
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(bethel_id));

DROP POLICY IF EXISTS bethel_abelhinhas_write ON public.bethel_abelhinhas;
CREATE POLICY bethel_abelhinhas_write ON public.bethel_abelhinhas
  FOR ALL TO authenticated
  USING (public.has_permission(bethel_id, 'secretaria'))
  WITH CHECK (public.has_permission(bethel_id, 'secretaria'));

COMMENT ON TABLE public.bethel_abelhinhas IS
  'Sub-programa Abelhinhas vinculado a um Bethel — sem cargo formal/membership.';

-- ---------- 7) Seeds de cargos (IDs >= 100; codes prefixados por esfera) ----------
SELECT setval(
  'public.positions_id_seq',
  greatest(coalesce((SELECT max(id) FROM public.positions), 0), 99)
);

-- Helper: upsert position by code
CREATE OR REPLACE FUNCTION public._upsert_position(
  _code text, _label text, _scope text, _sort int
) RETURNS smallint
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_id smallint;
BEGIN
  SELECT id INTO v_id FROM public.positions WHERE code = _code;
  IF FOUND THEN
    UPDATE public.positions
       SET label = _label, scope = _scope, sort_order = _sort
     WHERE id = v_id;
    RETURN v_id;
  END IF;
  INSERT INTO public.positions (code, label, scope, sort_order, is_system)
  VALUES (_code, _label, _scope, _sort, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._link_position_org(
  _code text, _org_type text, _role_group text, _sort int
) RETURNS void
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_id smallint;
BEGIN
  SELECT id INTO v_id FROM public.positions WHERE code = _code;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.position_org_types (position_id, org_type, role_group, sort_order)
  VALUES (v_id, _org_type, _role_group, _sort)
  ON CONFLICT (position_id, org_type) DO UPDATE
  SET role_group = EXCLUDED.role_group, sort_order = EXCLUDED.sort_order;
END;
$$;

-- LOJA (pago) — VM + cargos típicos; lista além do VM a validar
SELECT public._upsert_position('loja_veneravel_mestre', 'Venerável Mestre', 'capitulo', 1);
SELECT public._upsert_position('loja_primeiro_vigilante', '1º Vigilante', 'capitulo', 2);
SELECT public._upsert_position('loja_segundo_vigilante', '2º Vigilante', 'capitulo', 3);
SELECT public._upsert_position('loja_orador', 'Orador', 'capitulo', 4);
SELECT public._upsert_position('loja_secretario', 'Secretário', 'capitulo', 5);
SELECT public._upsert_position('loja_tesoureiro', 'Tesoureiro', 'capitulo', 6);
SELECT public._upsert_position('loja_chanceler', 'Chanceler', 'capitulo', 7);
SELECT public._upsert_position('loja_mestre_cerimonias', 'Mestre de Cerimônias', 'capitulo', 8);
SELECT public._upsert_position('loja_guarda_templo', 'Guarda do Templo', 'capitulo', 9);
SELECT public._upsert_position('loja_hospitaleiro', 'Hospitaleiro', 'capitulo', 10);

SELECT public._link_position_org('loja_veneravel_mestre', 'loja', NULL, 1);
SELECT public._link_position_org('loja_primeiro_vigilante', 'loja', NULL, 2);
SELECT public._link_position_org('loja_segundo_vigilante', 'loja', NULL, 3);
SELECT public._link_position_org('loja_orador', 'loja', NULL, 4);
SELECT public._link_position_org('loja_secretario', 'loja', NULL, 5);
SELECT public._link_position_org('loja_tesoureiro', 'loja', NULL, 6);
SELECT public._link_position_org('loja_chanceler', 'loja', NULL, 7);
SELECT public._link_position_org('loja_mestre_cerimonias', 'loja', NULL, 8);
SELECT public._link_position_org('loja_guarda_templo', 'loja', NULL, 9);
SELECT public._link_position_org('loja_hospitaleiro', 'loja', NULL, 10);

-- BETHEL FDJ
SELECT public._upsert_position('fdj_honoravel_rainha', 'Honorável Rainha', 'capitulo', 1);
SELECT public._upsert_position('fdj_primeira_princesa', '1ª Princesa', 'capitulo', 2);
SELECT public._upsert_position('fdj_segunda_princesa', '2ª Princesa', 'capitulo', 3);
SELECT public._upsert_position('fdj_guia', 'Guia', 'capitulo', 4);
SELECT public._upsert_position('fdj_dirigente_cerimonias', 'Dirigente de Cerimônias', 'capitulo', 5);
SELECT public._upsert_position('fdj_capela', 'Capelã', 'capitulo', 6);
SELECT public._upsert_position('fdj_secretaria', 'Secretária', 'capitulo', 7);
SELECT public._upsert_position('fdj_tesoureira', 'Tesoureira', 'capitulo', 8);
SELECT public._upsert_position('fdj_musicista', 'Musicista', 'capitulo', 9);
SELECT public._upsert_position('fdj_bibliotecaria', 'Bibliotecária', 'capitulo', 10);
SELECT public._upsert_position('fdj_primeira_mensageira', '1ª Mensageira', 'capitulo', 11);
SELECT public._upsert_position('fdj_segunda_mensageira', '2ª Mensageira', 'capitulo', 12);
SELECT public._upsert_position('fdj_terceira_mensageira', '3ª Mensageira', 'capitulo', 13);
SELECT public._upsert_position('fdj_quarta_mensageira', '4ª Mensageira', 'capitulo', 14);
SELECT public._upsert_position('fdj_quinta_mensageira', '5ª Mensageira', 'capitulo', 15);
SELECT public._upsert_position('fdj_primeira_zeladora', '1ª Zeladora', 'capitulo', 16);
SELECT public._upsert_position('fdj_segunda_zeladora', '2ª Zeladora', 'capitulo', 17);
SELECT public._upsert_position('fdj_guarda_interna', 'Guarda Interna', 'capitulo', 18);
SELECT public._upsert_position('fdj_guarda_externa', 'Guarda Externa', 'capitulo', 19);
SELECT public._upsert_position('fdj_porta_bandeira', 'Porta-Bandeira', 'capitulo', 20);
SELECT public._upsert_position('fdj_conselho_guardiao', 'Conselho Guardião', 'consultivo', 30);

SELECT public._link_position_org(c, 'bethel', g, s)
FROM (VALUES
  ('fdj_honoravel_rainha', 'ritualisticos', 1),
  ('fdj_primeira_princesa', 'ritualisticos', 2),
  ('fdj_segunda_princesa', 'ritualisticos', 3),
  ('fdj_guia', 'ritualisticos', 4),
  ('fdj_dirigente_cerimonias', 'ritualisticos', 5),
  ('fdj_capela', 'ritualisticos', 6),
  ('fdj_secretaria', 'ritualisticos', 7),
  ('fdj_tesoureira', 'ritualisticos', 8),
  ('fdj_musicista', 'ritualisticos', 9),
  ('fdj_bibliotecaria', 'ritualisticos', 10),
  ('fdj_primeira_mensageira', 'ritualisticos', 11),
  ('fdj_segunda_mensageira', 'ritualisticos', 12),
  ('fdj_terceira_mensageira', 'ritualisticos', 13),
  ('fdj_quarta_mensageira', 'ritualisticos', 14),
  ('fdj_quinta_mensageira', 'ritualisticos', 15),
  ('fdj_primeira_zeladora', 'ritualisticos', 16),
  ('fdj_segunda_zeladora', 'ritualisticos', 17),
  ('fdj_guarda_interna', 'ritualisticos', 18),
  ('fdj_guarda_externa', 'ritualisticos', 19),
  ('fdj_porta_bandeira', 'ritualisticos', 20),
  ('fdj_conselho_guardiao', 'conselho', 30)
) AS t(c, g, s);

-- ARCO-ÍRIS
SELECT public._upsert_position('arco_ilustre_preceptora', 'Ilustre Preceptora', 'capitulo', 1);
SELECT public._upsert_position('arco_preceptora_adjunta', 'Preceptora Adjunta', 'capitulo', 2);
SELECT public._upsert_position('arco_caridade', 'Caridade', 'capitulo', 3);
SELECT public._upsert_position('arco_esperanca', 'Esperança', 'capitulo', 4);
SELECT public._upsert_position('arco_fe', 'Fé', 'capitulo', 5);
SELECT public._upsert_position('arco_arquivista', 'Arquivista', 'capitulo', 6);
SELECT public._upsert_position('arco_tesoureira', 'Tesoureira', 'capitulo', 7);
SELECT public._upsert_position('arco_mae_conselheira', 'Mãe Conselheira', 'consultivo', 20);

SELECT public._link_position_org(c, 'arco_iris', NULL, s)
FROM (VALUES
  ('arco_ilustre_preceptora', 1),
  ('arco_preceptora_adjunta', 2),
  ('arco_caridade', 3),
  ('arco_esperanca', 4),
  ('arco_fe', 5),
  ('arco_arquivista', 6),
  ('arco_tesoureira', 7),
  ('arco_mae_conselheira', 20)
) AS t(c, s);

-- APJ (placeholder adulto; juvenis a validar)
SELECT public._upsert_position('apj_preceptor', 'Preceptor', 'consultivo', 1);
SELECT public._upsert_position('apj_cargo_juvenil_placeholder', 'Cargo juvenil (a validar)', 'capitulo', 10);
SELECT public._link_position_org('apj_preceptor', 'apj', NULL, 1);
SELECT public._link_position_org('apj_cargo_juvenil_placeholder', 'apj', NULL, 10);

-- CASTELO
SELECT public._upsert_position('castelo_mestre_escudeiro', 'Mestre Escudeiro', 'capitulo', 1);
SELECT public._upsert_position('castelo_primeiro_escudeiro', '1º Escudeiro', 'capitulo', 2);
SELECT public._upsert_position('castelo_segundo_escudeiro', '2º Escudeiro', 'capitulo', 3);
SELECT public._upsert_position('castelo_capelao_escudeiro', 'Capelão Escudeiro', 'capitulo', 4);
SELECT public._upsert_position('castelo_mestre_cerimonias', 'Mestre de Cerimônias Escudeiro', 'capitulo', 5);
SELECT public._upsert_position('castelo_escrivao', 'Escrivão Escudeiro', 'capitulo', 6);
SELECT public._upsert_position('castelo_tesoureiro', 'Tesoureiro Escudeiro', 'capitulo', 7);
SELECT public._upsert_position('castelo_preceptor', 'Preceptor', 'consultivo', 20);
SELECT public._upsert_position('castelo_consultor', 'Consultor', 'consultivo', 21);
SELECT public._upsert_position('castelo_nobre_cavaleiro', 'Nobre Cavaleiro do Castelo', 'capitulo', 22);

SELECT public._link_position_org(c, 'castelo', g, s)
FROM (VALUES
  ('castelo_mestre_escudeiro', 'ritualisticos', 1),
  ('castelo_primeiro_escudeiro', 'ritualisticos', 2),
  ('castelo_segundo_escudeiro', 'ritualisticos', 3),
  ('castelo_capelao_escudeiro', 'ritualisticos', 4),
  ('castelo_mestre_cerimonias', 'ritualisticos', 5),
  ('castelo_escrivao', 'ritualisticos', 6),
  ('castelo_tesoureiro', 'ritualisticos', 7),
  ('castelo_preceptor', 'conselho', 20),
  ('castelo_consultor', 'conselho', 21),
  ('castelo_nobre_cavaleiro', 'ritualisticos', 22)
) AS t(c, g, s);

-- PRIORADO
SELECT public._upsert_position('priorado_ilustre_comendador', 'Ilustre Comendador Cavaleiro', 'capitulo', 1);
SELECT public._upsert_position('priorado_comendador_escudeiro', 'Comendador Escudeiro', 'capitulo', 2);
SELECT public._upsert_position('priorado_comendador_pajem', 'Comendador Pajem', 'capitulo', 3);
SELECT public._upsert_position('priorado_protocolista', 'Protocolista', 'capitulo', 4);
SELECT public._upsert_position('priorado_sir_organista', 'Sir Organista', 'capitulo', 5);

SELECT public._link_position_org(c, 'priorado', 'ritualisticos', s)
FROM (VALUES
  ('priorado_ilustre_comendador', 1),
  ('priorado_comendador_escudeiro', 2),
  ('priorado_comendador_pajem', 3),
  ('priorado_protocolista', 4),
  ('priorado_sir_organista', 5)
) AS t(c, s);

-- ALUMNI (associação civil)
SELECT public._upsert_position('alumni_presidente', 'Presidente', 'capitulo', 1);
SELECT public._upsert_position('alumni_vice_presidente', 'Vice-Presidente', 'capitulo', 2);
SELECT public._upsert_position('alumni_secretario', 'Secretário', 'capitulo', 3);
SELECT public._upsert_position('alumni_tesoureiro', 'Tesoureiro', 'capitulo', 4);

SELECT public._link_position_org(c, 'alumni', NULL, s)
FROM (VALUES
  ('alumni_presidente', 1),
  ('alumni_vice_presidente', 2),
  ('alumni_secretario', 3),
  ('alumni_tesoureiro', 4)
) AS t(c, s);

-- ---------- 8) Preencher cargo_presets a partir de position_org_types ----------
INSERT INTO public.cargo_presets (potencia_id, org_type, cargos)
SELECT
  pot.id,
  pot_ot.org_type,
  coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', p.code,
        'label', p.label,
        'role_group', pot_link.role_group,
        'sort_order', pot_link.sort_order,
        'is_admin_maximo', (
          pot_link.sort_order = 1
          AND pot_link.role_group IS DISTINCT FROM 'conselho'
        )
      )
      ORDER BY pot_link.sort_order, p.label
    )
    FROM public.position_org_types pot_link
    JOIN public.positions p ON p.id = pot_link.position_id
    WHERE pot_link.org_type = pot_ot.org_type
  ), '[]'::jsonb)
FROM public.potencias pot
JOIN public.potencia_org_types pot_ot ON pot_ot.potencia_id = pot.id
WHERE pot_ot.org_type <> 'outro'
ON CONFLICT (potencia_id, org_type) DO UPDATE
SET cargos = EXCLUDED.cargos, updated_at = now();

-- Clone helper (para aprovação futura de org)
CREATE OR REPLACE FUNCTION public.apply_cargo_preset(
  _potencia_id uuid,
  _org_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_cargos jsonb;
  v_item jsonb;
  v_n int := 0;
  v_code text;
  v_label text;
  v_group text;
  v_sort int;
BEGIN
  IF _org_type IS NULL OR _org_type <> ALL (public._org_type_values()) THEN
    RAISE EXCEPTION 'org_type inválido';
  END IF;

  SELECT cargos INTO v_cargos
  FROM public.cargo_presets
  WHERE potencia_id = _potencia_id AND org_type = _org_type;

  IF v_cargos IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_cargos)
  LOOP
    v_code := v_item->>'code';
    v_label := coalesce(v_item->>'label', v_code);
    v_group := nullif(v_item->>'role_group', '');
    v_sort := coalesce((v_item->>'sort_order')::int, 0);
    PERFORM public._upsert_position(
      v_code,
      v_label,
      CASE WHEN v_group = 'conselho' THEN 'consultivo'
           WHEN v_group = 'comissoes' THEN 'comissao'
           ELSE 'capitulo' END,
      v_sort
    );
    PERFORM public._link_position_org(v_code, _org_type, v_group, v_sort);
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_cargo_preset(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_cargo_preset(uuid, text)
  TO authenticated, service_role;

-- ---------- 9) org_join_requests: alumni + potencia; CHECK patrocínio ----------
ALTER TABLE public.org_join_requests
  ADD COLUMN IF NOT EXISTS potencia_id uuid REFERENCES public.potencias(id) ON DELETE SET NULL;

ALTER TABLE public.org_join_requests
  DROP CONSTRAINT IF EXISTS org_join_requests_org_type_check;
ALTER TABLE public.org_join_requests
  ADD CONSTRAINT org_join_requests_org_type_check
  CHECK (org_type = ANY (public._org_type_values()));

ALTER TABLE public.org_join_requests
  DROP CONSTRAINT IF EXISTS org_join_requests_lodge_ck;
ALTER TABLE public.org_join_requests
  ADD CONSTRAINT org_join_requests_lodge_ck CHECK (
    (
      org_type IN ('loja', 'alumni')
      AND sponsoring_lodge IS NULL
    )
    OR (
      org_type NOT IN ('loja', 'alumni')
      AND nullif(trim(sponsoring_lodge), '') IS NOT NULL
    )
  );

-- RPC catálogo público para o formulário
CREATE OR REPLACE FUNCTION public.list_org_join_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT jsonb_build_object(
    'potencias', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nome', p.nome,
          'sigla', p.sigla,
          'abrangencia', p.abrangencia,
          'org_types', (
            SELECT coalesce(jsonb_agg(pot.org_type ORDER BY d.sort_order), '[]'::jsonb)
            FROM public.potencia_org_types pot
            JOIN public.org_type_defs d ON d.org_type = pot.org_type
            WHERE pot.potencia_id = p.id AND d.join_enabled
          )
        )
        ORDER BY p.sort_order, p.sigla
      )
      FROM public.potencias p
      WHERE p.active
    ), '[]'::jsonb),
    'org_types', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'org_type', d.org_type,
          'label', d.label,
          'unit_label', d.unit_label,
          'billing_model', d.billing_model,
          'rollout_scope', d.rollout_scope,
          'form_schema', d.form_schema
        )
        ORDER BY d.sort_order
      )
      FROM public.org_type_defs d
      WHERE d.join_enabled
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.list_org_join_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_org_join_catalog() TO anon, authenticated;

-- Atualiza RPC de submit (assinatura nova com potencia)
DROP FUNCTION IF EXISTS public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text
);

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
  _responsible_role text DEFAULT NULL,
  _potencia_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
  v_sponsor_kind text;
BEGIN
  IF v_type IS NULL OR v_type <> ALL (public._org_type_values()) THEN
    RAISE EXCEPTION 'Tipo de organização inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_type_defs d
    WHERE d.org_type = v_type AND d.join_enabled
  ) THEN
    RAISE EXCEPTION 'Tipo de organização não liberado para cadastro' USING ERRCODE = '22023';
  END IF;

  IF _potencia_id IS NULL THEN
    RAISE EXCEPTION 'Informe a potência' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.potencias p WHERE p.id = _potencia_id AND p.active) THEN
    RAISE EXCEPTION 'Potência inválida' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.potencia_org_types pot
    WHERE pot.potencia_id = _potencia_id AND pot.org_type = v_type
  ) THEN
    RAISE EXCEPTION 'Este tipo não é suportado pela potência escolhida' USING ERRCODE = '22023';
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

  SELECT d.form_schema->>'sponsor_kind' INTO v_sponsor_kind
  FROM public.org_type_defs d WHERE d.org_type = v_type;

  IF v_sponsor_kind IS NULL OR v_type IN ('loja', 'alumni') THEN
    v_lodge := NULL;
  ELSIF v_lodge IS NULL THEN
    IF v_sponsor_kind = 'capitulo' THEN
      RAISE EXCEPTION 'Informe o capítulo patrocinador' USING ERRCODE = '22023';
    ELSE
      RAISE EXCEPTION 'Informe a loja patrocinadora' USING ERRCODE = '22023';
    END IF;
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
    responsible_role,
    potencia_id
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
    v_rrole,
    _potencia_id
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text, uuid
) TO anon, authenticated;

-- Seed platform_access_role_org_types para alumni
INSERT INTO public.platform_access_role_org_types (role_id, org_type)
SELECT r.id, 'alumni'
FROM public.platform_access_roles r
WHERE r.key = 'membro'
ON CONFLICT DO NOTHING;
