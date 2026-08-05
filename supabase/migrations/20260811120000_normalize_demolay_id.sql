-- Canonical demolay_id normalization (trim + lower + strip non-alphanumeric).
CREATE OR REPLACE FUNCTION public.normalize_demolay_id(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(coalesce(trim(raw), ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

REVOKE ALL ON FUNCTION public.normalize_demolay_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_demolay_id(text) TO authenticated, service_role, anon;

-- Align secretaria lookup with the same canonical form (both sides).
CREATE OR REPLACE FUNCTION public.lookup_member_by_demolay_id(_demolay_id text, _for_chapter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := nullif(public.normalize_demolay_id(_demolay_id), '');
  v_member public.members%ROWTYPE;
  v_affiliated boolean;
  v_positions jsonb;
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.is_chapter_member(_for_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(_for_chapter_id, 'secretaria')
     AND NOT public.has_permission(_for_chapter_id, 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para buscar membros' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE demolay_id IS NOT NULL
    AND public.normalize_demolay_id(demolay_id) = v_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.member_chapter_affiliations a
    WHERE a.member_id = v_member.id
      AND a.chapter_id = _for_chapter_id
      AND a.active
  ) INTO v_affiliated;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'label', p.label,
      'term_year', mp.term_year,
      'term_semester', mp.term_semester,
      'chapter_name', ch.name,
      'chapter_number', ch.number
    )
    ORDER BY mp.term_year DESC, mp.term_semester DESC
  ), '[]'::jsonb)
  INTO v_positions
  FROM public.member_positions mp
  JOIN public.positions p ON p.id = mp.position_id
  JOIN public.chapters ch ON ch.id = mp.chapter_id
  WHERE mp.member_id = v_member.id;

  RETURN jsonb_build_object(
    'id', v_member.id,
    'chapter_id', v_member.chapter_id,
    'initiation_chapter_id', v_member.initiation_chapter_id,
    'full_name', v_member.full_name,
    'birth_date', v_member.birth_date,
    'status', v_member.status,
    'kind', v_member.kind,
    'phone', v_member.phone,
    'email', v_member.email,
    'address', v_member.address,
    'demolay_id', v_member.demolay_id,
    'masonic_id', v_member.masonic_id,
    'exam_grau_iniciatico', v_member.exam_grau_iniciatico,
    'exam_grau_demolay', v_member.exam_grau_demolay,
    'iniciacao_ordem', v_member.iniciacao_ordem,
    'iniciacao_grau_demolay', v_member.iniciacao_grau_demolay,
    'already_affiliated', v_affiliated,
    'position_history', v_positions
  );
END;
$$;

-- Login by demolay_id without loading the full members table.
CREATE OR REPLACE FUNCTION public.find_member_auth_by_demolay_id(_demolay_id text)
RETURNS TABLE(user_id uuid, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := nullif(public.normalize_demolay_id(_demolay_id), '');
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.status::text
  FROM public.members m
  WHERE m.user_id IS NOT NULL
    AND m.demolay_id IS NOT NULL
    AND public.normalize_demolay_id(m.demolay_id) = v_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_member_auth_by_demolay_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_member_auth_by_demolay_id(text) TO service_role;
