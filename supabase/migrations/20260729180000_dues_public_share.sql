-- Link público compartilhável da visualização de mensalidades
-- Token em chapters.settings.dues_share_token

CREATE OR REPLACE FUNCTION public.can_manage_dues_share(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND (
      public.has_role(_chapter_id, 'admin_total')
      OR public.has_role(_chapter_id, 'mestre_conselheiro')
      OR public.has_role(_chapter_id, 'tesoureiro')
    );
$$;

CREATE OR REPLACE FUNCTION public.ensure_dues_share_token(
  _chapter_id uuid,
  _regenerate boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_settings jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_dues_share(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o link de mensalidades'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(settings, '{}'::jsonb) INTO v_settings
  FROM public.chapters
  WHERE id = _chapter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_token := nullif(v_settings->>'dues_share_token', '');

  IF v_token IS NULL OR _regenerate THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.chapters
    SET settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('dues_share_token', v_token)
    WHERE id = _chapter_id;
  END IF;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_dues_share_token(_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_dues_share(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar o link de mensalidades'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.chapters
  SET settings = coalesce(settings, '{}'::jsonb) - 'dues_share_token'
  WHERE id = _chapter_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dues_share_token(_chapter_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_dues_share(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT nullif(settings->>'dues_share_token', '') INTO v_token
  FROM public.chapters
  WHERE id = _chapter_id;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_year_dues(
  _token text,
  _year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_chapter public.chapters%ROWTYPE;
  v_members jsonb;
  v_dues jsonb;
  v_default numeric;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;
  IF _year IS NULL OR _year < 1900 OR _year > 2100 THEN
    RAISE EXCEPTION 'Ano inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter
  FROM public.chapters
  WHERE settings->>'dues_share_token' = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  v_default := coalesce(
    nullif(v_chapter.settings->>'default_dues_amount', '')::numeric,
    50
  );

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'full_name', m.full_name,
      'status', m.status,
      'kind', m.kind,
      'birth_date', m.birth_date,
      'iniciacao_ordem', m.iniciacao_ordem
    ) ORDER BY m.full_name
  ), '[]'::jsonb)
  INTO v_members
  FROM public.members m
  WHERE m.chapter_id = v_chapter.id
    AND m.status = 'regular'
    AND m.kind IN ('demolay_ativo', 'senior');

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'member_id', d.member_id,
      'amount', d.amount,
      'status', d.status,
      'paid_at', d.paid_at,
      'competence_year', d.competence_year,
      'competence_month', d.competence_month
    )
  ), '[]'::jsonb)
  INTO v_dues
  FROM public.member_dues d
  WHERE d.chapter_id = v_chapter.id
    AND d.competence_year = _year;

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color,
      'founded_at', nullif(v_chapter.settings->>'founded_at', '')
    ),
    'year', _year,
    'defaultAmount', v_default,
    'members', v_members,
    'dues', v_dues
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.can_manage_dues_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_dues_share_token(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_dues_share_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dues_share_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_year_dues(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_dues_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_dues_share_token(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_dues_share_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dues_share_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_year_dues(text, integer) TO anon, authenticated, service_role;
