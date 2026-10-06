-- Links públicos mascarados: /{organizacao}/{fluxo|mensalidades|frequencia|perfil}

CREATE OR REPLACE FUNCTION public.slugify_public_label(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    translate(
      lower(trim(coalesce(raw, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
    ),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.chapter_public_slug(_chapter_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH labeled AS (
    SELECT
      c.id,
      coalesce(
        nullif(public.slugify_public_label(c.name), ''),
        'organizacao'
      ) AS base,
      nullif(public.slugify_public_label(c.number), '') AS num
    FROM public.chapters c
  ),
  counted AS (
    SELECT
      labeled.*,
      count(*) OVER (PARTITION BY labeled.base) AS base_count
    FROM labeled
  )
  SELECT CASE
    WHEN counted.base_count > 1 AND counted.num IS NOT NULL
      THEN counted.base || '-' || counted.num
    ELSE counted.base
  END
  FROM counted
  WHERE counted.id = _chapter_id;
$$;

CREATE OR REPLACE FUNCTION public.public_org_slug_for_token(_token text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter public.chapters%ROWTYPE;
BEGIN
  v_chapter := public.resolve_public_chapter_by_token(_token);
  RETURN public.chapter_public_slug(v_chapter.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_public_org_path(_slug text, _section text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slug text := public.slugify_public_label(_slug);
  v_section text := lower(trim(coalesce(_section, 'index')));
  v_chapter public.chapters%ROWTYPE;
  v_lobby text;
  v_dues text;
  v_cash text;
  v_token text;
  v_dues_enabled boolean;
BEGIN
  IF v_slug IS NULL OR v_slug = '' THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;
  IF v_section NOT IN ('index', 'fluxo', 'mensalidades', 'frequencia', 'perfil') THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT c.* INTO v_chapter
  FROM public.chapters c
  WHERE public.chapter_public_slug(c.id) = v_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  v_lobby := nullif(v_chapter.settings->>'public_lobby_token', '');
  v_dues := nullif(v_chapter.settings->>'dues_share_token', '');
  v_cash := nullif(v_chapter.settings->>'cash_share_token', '');
  v_dues_enabled := coalesce((v_chapter.settings->>'dues_enabled')::boolean, true);

  IF v_lobby IS NULL AND v_dues IS NULL AND v_cash IS NULL THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  v_token := CASE v_section
    WHEN 'index' THEN v_lobby
    WHEN 'fluxo' THEN coalesce(v_cash, v_lobby)
    WHEN 'mensalidades' THEN CASE
      WHEN v_dues_enabled THEN coalesce(v_dues, v_lobby)
      ELSE NULL
    END
    WHEN 'frequencia' THEN v_lobby
    WHEN 'perfil' THEN v_lobby
    ELSE NULL
  END;

  IF v_section <> 'index' AND v_token IS NULL THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'slug', v_slug,
    'token', v_token,
    'sections', jsonb_build_object(
      'fluxo', coalesce(v_cash, v_lobby) IS NOT NULL,
      'mensalidades', v_dues_enabled AND coalesce(v_dues, v_lobby) IS NOT NULL,
      'frequencia', v_lobby IS NOT NULL,
      'perfil', v_lobby IS NOT NULL
    ),
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'logo_url', v_chapter.logo_url,
      'primary_color', v_chapter.primary_color,
      'dues_enabled', v_dues_enabled
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.slugify_public_label(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chapter_public_slug(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_org_slug_for_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_org_path(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.chapter_public_slug(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_org_slug_for_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_public_org_path(text, text) TO anon, authenticated, service_role;
