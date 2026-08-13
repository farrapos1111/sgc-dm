-- Multi-realm: chapters.realm gerado, people (identidade), fichas FDJ/Loja.
-- members permanece a ficha ODM; FKs existentes não são reescritas.

-- ----------------------------------------------------------------------------
-- 1. Realm derivado de org_type
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_realm_for_org_type(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('capitulo', 'alumni', 'castelo', 'priorado') THEN 'odm'
    WHEN p_type = 'bethel' THEN 'fdj'
    WHEN p_type = 'loja' THEN 'lodge'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.get_realm_for_org_type(text) IS
  'Mapeia chapters.org_type → odm|fdj|lodge. arco_iris/apj/outro ficam NULL até haver subdomínio.';

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS realm text
  GENERATED ALWAYS AS (public.get_realm_for_org_type(org_type)) STORED;

CREATE INDEX IF NOT EXISTS idx_chapters_realm ON public.chapters (realm);

COMMENT ON COLUMN public.chapters.realm IS
  'Gerado de org_type. Nunca setar manualmente.';

CREATE OR REPLACE VIEW public.organizations
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  number,
  org_type,
  realm,
  city,
  state_id,
  region_id,
  active,
  primary_color,
  logo_url,
  settings,
  created_at
FROM public.chapters;

COMMENT ON VIEW public.organizations IS
  'Alias de leitura de chapters (vocabulário canônico). RLS via security_invoker.';

GRANT SELECT ON public.organizations TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. Helper: org deve pertencer ao realm
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_chapter_realm(_chapter_id uuid, _realm text)
RETURNS void
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF _chapter_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = _chapter_id AND c.realm = _realm
  ) THEN
    RAISE EXCEPTION 'Organização não pertence ao realm %', _realm
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_members_odm_realm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_chapter_realm(NEW.chapter_id, 'odm');
  IF NEW.initiation_chapter_id IS NOT NULL THEN
    PERFORM public.assert_chapter_realm(NEW.initiation_chapter_id, 'odm');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_odm_realm ON public.members;
CREATE TRIGGER trg_members_odm_realm
  BEFORE INSERT OR UPDATE OF chapter_id, initiation_chapter_id
  ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.tg_members_odm_realm();

CREATE OR REPLACE FUNCTION public.tg_member_affiliations_odm_realm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_chapter_realm(NEW.chapter_id, 'odm');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_affiliations_odm_realm ON public.member_chapter_affiliations;
CREATE TRIGGER trg_member_affiliations_odm_realm
  BEFORE INSERT OR UPDATE OF chapter_id
  ON public.member_chapter_affiliations
  FOR EACH ROW EXECUTE FUNCTION public.tg_member_affiliations_odm_realm();

-- ----------------------------------------------------------------------------
-- 3. people — identidade curta (sem cargo/grau/org)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles (id) ON DELETE SET NULL,
  cpf_encrypted bytea,
  cpf_last2 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.people IS
  'Identidade compartilhada entre esferas. Não guarda cargo, grau nem chapter_id.';

CREATE INDEX IF NOT EXISTS idx_people_user_id ON public.people (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;

DROP POLICY IF EXISTS people_select_self ON public.people;
CREATE POLICY people_select_self ON public.people
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS people_updated ON public.people;
CREATE TRIGGER people_updated
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_person_id ON public.profiles (person_id)
  WHERE person_id IS NOT NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_person_id ON public.members (person_id)
  WHERE person_id IS NOT NULL;

-- Backfill: uma people por conta já ligada a ficha ODM
INSERT INTO public.people (user_id)
SELECT DISTINCT m.user_id
FROM public.members m
WHERE m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.people p WHERE p.user_id = m.user_id
  );

UPDATE public.members m
SET person_id = p.id
FROM public.people p
WHERE p.user_id = m.user_id
  AND m.person_id IS NULL;

UPDATE public.profiles pr
SET person_id = p.id
FROM public.people p
WHERE p.user_id = pr.id
  AND pr.person_id IS NULL;

-- ----------------------------------------------------------------------------
-- 4. fdj_members / loja_members
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fdj_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  birth_date date,
  fdj_id text,
  status text NOT NULL DEFAULT 'regular'
    CHECK (status IN ('regular', 'irregular')),
  cpf_encrypted bytea,
  cpf_last2 text,
  rg_encrypted bytea,
  rg_last2 text,
  phone text,
  email text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fdj_members IS
  'Ficha de membro da esfera FDJ (Bethel). Não misturar com members (ODM).';

CREATE INDEX IF NOT EXISTS idx_fdj_members_chapter ON public.fdj_members (chapter_id);
CREATE INDEX IF NOT EXISTS idx_fdj_members_person ON public.fdj_members (person_id);
CREATE UNIQUE INDEX IF NOT EXISTS fdj_members_user_id_unique
  ON public.fdj_members (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.loja_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  birth_date date,
  masonic_id text,
  grau text,
  status text NOT NULL DEFAULT 'regular'
    CHECK (status IN ('regular', 'irregular')),
  cpf_encrypted bytea,
  cpf_last2 text,
  rg_encrypted bytea,
  rg_last2 text,
  phone text,
  email text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.loja_members IS
  'Ficha de membro da esfera Loja. Não misturar com members (ODM).';

CREATE INDEX IF NOT EXISTS idx_loja_members_chapter ON public.loja_members (chapter_id);
CREATE INDEX IF NOT EXISTS idx_loja_members_person ON public.loja_members (person_id);
CREATE UNIQUE INDEX IF NOT EXISTS loja_members_user_id_unique
  ON public.loja_members (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_fdj_members_realm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_chapter_realm(NEW.chapter_id, 'fdj');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fdj_members_realm ON public.fdj_members;
CREATE TRIGGER trg_fdj_members_realm
  BEFORE INSERT OR UPDATE OF chapter_id
  ON public.fdj_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_fdj_members_realm();

CREATE OR REPLACE FUNCTION public.tg_loja_members_realm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_chapter_realm(NEW.chapter_id, 'lodge');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loja_members_realm ON public.loja_members;
CREATE TRIGGER trg_loja_members_realm
  BEFORE INSERT OR UPDATE OF chapter_id
  ON public.loja_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_loja_members_realm();

DROP TRIGGER IF EXISTS fdj_members_updated ON public.fdj_members;
CREATE TRIGGER fdj_members_updated
  BEFORE UPDATE ON public.fdj_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS loja_members_updated ON public.loja_members;
CREATE TRIGGER loja_members_updated
  BEFORE UPDATE ON public.loja_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.fdj_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.fdj_members TO authenticated;
GRANT SELECT ON public.loja_members TO authenticated;
GRANT ALL ON public.fdj_members TO service_role;
GRANT ALL ON public.loja_members TO service_role;

-- SELECT: membro da org ou dono da ficha. Sem INSERT/UPDATE genérico nesta fase.
DROP POLICY IF EXISTS fdj_members_select ON public.fdj_members;
CREATE POLICY fdj_members_select ON public.fdj_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_chapter_member(chapter_id)
  );

DROP POLICY IF EXISTS loja_members_select ON public.loja_members;
CREATE POLICY loja_members_select ON public.loja_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_chapter_member(chapter_id)
  );
