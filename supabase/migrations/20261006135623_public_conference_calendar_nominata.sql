-- Calendário e nominata no link público de conferência.

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
  IF v_section NOT IN (
    'index', 'fluxo', 'mensalidades', 'frequencia', 'perfil', 'calendario', 'nominata'
  ) THEN
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
    WHEN 'calendario' THEN v_lobby
    WHEN 'nominata' THEN v_lobby
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
      'perfil', v_lobby IS NOT NULL,
      'calendario', v_lobby IS NOT NULL,
      'nominata', v_lobby IS NOT NULL
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

CREATE OR REPLACE FUNCTION public.get_public_calendar(
  _token text,
  _from timestamptz,
  _to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_labels jsonb;
  v_founded text;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  IF _from IS NULL OR _to IS NULL OR _to <= _from OR _to > _from + interval '4 years' THEN
    RAISE EXCEPTION 'Período inválido' USING ERRCODE = '22023';
  END IF;

  v_founded := v_chapter.settings->>'founded_at';
  IF v_founded IS NULL OR v_founded !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_founded := NULL;
  END IF;

  v_labels := v_chapter.settings->'calendar_type_labels';
  IF v_labels IS NULL OR jsonb_typeof(v_labels) <> 'object' THEN
    v_labels := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color,
      'founded_at', v_founded,
      'calendar_type_labels', v_labels
    ),
    'categories', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color)
        ORDER BY c.name
      )
      FROM public.chapter_calendar_categories c
      WHERE c.chapter_id = v_chapter.id
        AND c.active
    ), '[]'::jsonb),
    'mandatory_dates', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'prazo_kind', d.prazo_kind,
        'due_date', d.due_date,
        'due_year', d.due_year,
        'due_month', d.due_month,
        'due_day', d.due_day,
        'start_month', d.start_month,
        'start_day', d.start_day
      ))
      FROM public.org_mandatory_dates d
      WHERE (
        d.scope = 'region'
        AND v_chapter.region_id IS NOT NULL
        AND d.region_id = v_chapter.region_id
      ) OR (
        d.scope = 'state'
        AND v_chapter.state_id IS NOT NULL
        AND d.state_id = v_chapter.state_id
      )
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'event_type', e.event_type::text,
        'mandatory', e.mandatory,
        'public_open', e.public_open,
        'start_at', e.start_at,
        'end_at', e.end_at,
        'location', e.location,
        'address', e.address,
        'dress_code', e.dress_code,
        'description', e.description,
        'custom_category_id', e.custom_category_id,
        'org_mandatory_date_id', e.org_mandatory_date_id
      ) ORDER BY e.start_at)
      FROM public.calendar_events e
      WHERE e.chapter_id = v_chapter.id
        AND e.start_at <= _to
        AND coalesce(e.end_at, e.start_at) >= _from
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_nominata(
  _token text,
  _year integer,
  _semester integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_org text;
  v_founded text;
  v_positions jsonb;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);
  v_org := coalesce(nullif(v_chapter.org_type, ''), 'capitulo');

  IF _year IS NULL OR _year < 1900 OR _year > 2200
     OR _semester IS NULL OR _semester NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Vigência inválida' USING ERRCODE = '22023';
  END IF;

  v_founded := v_chapter.settings->>'founded_at';
  IF v_founded IS NULL OR v_founded !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_founded := NULL;
  END IF;

  SELECT coalesce(jsonb_agg(x.obj ORDER BY x.sort_order, x.label), '[]'::jsonb)
  INTO v_positions
  FROM (
    SELECT
      s.sort_order,
      p.label,
      jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'label', p.label,
        'scope', p.scope,
        'sort_order', s.sort_order,
        'role_group', s.role_group
      ) AS obj
    FROM public.position_org_types s
    JOIN public.positions p ON p.id = s.position_id
    WHERE s.org_type = v_org
      AND p.scope IS DISTINCT FROM 'regional'
  ) x;

  IF v_positions = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(x.obj ORDER BY x.sort_order, x.label), '[]'::jsonb)
    INTO v_positions
    FROM (
      SELECT
        p.sort_order,
        p.label,
        jsonb_build_object(
          'id', p.id,
          'code', p.code,
          'label', p.label,
          'scope', p.scope,
          'sort_order', p.sort_order,
          'role_group', CASE
            WHEN p.scope = 'consultivo' THEN 'conselho'
            WHEN p.scope = 'comissao' THEN 'comissoes'
            ELSE 'ritualisticos'
          END
        ) AS obj
      FROM public.positions p
      WHERE p.scope IS DISTINCT FROM 'regional'
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color,
      'founded_at', v_founded,
      'org_type', v_org
    ),
    'positions', v_positions,
    'assignments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', mp.id,
        'position_id', mp.position_id,
        'member_name', m.full_name
      ) ORDER BY m.full_name)
      FROM public.member_positions mp
      JOIN public.members m ON m.id = mp.member_id
      WHERE mp.chapter_id = v_chapter.id
        AND mp.term_year = _year
        AND mp.term_semester = _semester
    ), '[]'::jsonb),
    'commission_roles', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cm.id,
        'role', cm.role::text,
        'member_name', m.full_name,
        'commission_label', c.label
      ) ORDER BY c.sort_order, m.full_name)
      FROM public.commission_members cm
      JOIN public.members m ON m.id = cm.member_id
      JOIN public.commissions c ON c.id = cm.commission_id
      WHERE cm.chapter_id = v_chapter.id
        AND cm.term_year = _year
        AND cm.term_semester = _semester
        AND cm.role::text IN ('presidente', 'vice', 'membro', 'auxiliar_senior')
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_calendar(text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_nominata(text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_calendar(text, timestamptz, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_nominata(text, integer, integer) TO anon, authenticated, service_role;
