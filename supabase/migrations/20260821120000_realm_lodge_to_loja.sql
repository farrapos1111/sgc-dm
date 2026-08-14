-- Realm lodge → loja (subdomínio e chapters.realm gerado).

CREATE OR REPLACE FUNCTION public.get_realm_for_org_type(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type IN ('capitulo', 'alumni', 'castelo', 'priorado') THEN 'odm'
    WHEN p_type = 'bethel' THEN 'fdj'
    WHEN p_type = 'loja' THEN 'loja'
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.get_realm_for_org_type(text) IS
  'Mapeia chapters.org_type → odm|fdj|loja. arco_iris/apj/outro ficam NULL até haver subdomínio.';

-- Coluna gerada STORED não recalcula sozinha ao trocar a função IMMUTABLE.
DROP VIEW IF EXISTS public.organizations;

ALTER TABLE public.chapters DROP COLUMN IF EXISTS realm;

ALTER TABLE public.chapters
  ADD COLUMN realm text
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

CREATE OR REPLACE FUNCTION public.tg_loja_members_realm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.assert_chapter_realm(NEW.chapter_id, 'loja');
  RETURN NEW;
END;
$$;
