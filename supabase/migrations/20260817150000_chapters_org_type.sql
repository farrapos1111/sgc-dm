-- Tipo de instituição (Capítulo, Bethel, Loja, …) + lista ordenada por número

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS org_type text;

ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_org_type_check;

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_org_type_check
  CHECK (
    org_type IS NULL
    OR org_type IN (
      'capitulo',
      'bethel',
      'loja',
      'priorado',
      'castelo',
      'apj',
      'outro'
    )
  );

COMMENT ON COLUMN public.chapters.org_type IS
  'Tipo da organização: capitulo, bethel, loja, priorado, castelo, apj, outro.';

-- Backfill: inferência simples pelo nome; default capítulo
UPDATE public.chapters
SET org_type = CASE
  WHEN org_type IS NOT NULL THEN org_type
  WHEN name ~* '\ybethel\y' THEN 'bethel'
  WHEN name ~* '\ypriorado\y' THEN 'priorado'
  WHEN name ~* '\ycastelo\y' THEN 'castelo'
  WHEN name ~* '\yapj\y' OR name ~* '\yassembleia\y' OR name ~* '\yassembl[eé]ia\y' THEN 'apj'
  WHEN name ~* '\yloja\y' THEN 'loja'
  ELSE 'capitulo'
END
WHERE org_type IS NULL;

ALTER TABLE public.chapters
  ALTER COLUMN org_type SET DEFAULT 'capitulo';

UPDATE public.chapters SET org_type = 'capitulo' WHERE org_type IS NULL;

ALTER TABLE public.chapters
  ALTER COLUMN org_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS chapters_org_type_idx ON public.chapters (org_type);

DROP FUNCTION IF EXISTS public.list_chapters_for_select();

CREATE FUNCTION public.list_chapters_for_select()
RETURNS TABLE (id uuid, name text, number text, city text, org_type text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.number, c.city, c.org_type
  FROM public.chapters c
  WHERE c.active = true
    AND auth.uid() IS NOT NULL
  ORDER BY
    CASE c.org_type
      WHEN 'capitulo' THEN 0
      WHEN 'bethel' THEN 1
      WHEN 'priorado' THEN 2
      WHEN 'castelo' THEN 3
      WHEN 'apj' THEN 4
      WHEN 'loja' THEN 5
      ELSE 6
    END,
    NULLIF(regexp_replace(c.number, '\D', '', 'g'), '')::bigint NULLS LAST,
    c.number,
    c.name;
$$;

REVOKE ALL ON FUNCTION public.list_chapters_for_select() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chapters_for_select() TO authenticated, service_role;
