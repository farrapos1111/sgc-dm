CREATE OR REPLACE FUNCTION public.update_member_with_pii(
  _member_id uuid,
  _full_name text,
  _birth_date date,
  _cpf text,
  _rg text,
  _phone text,
  _email text,
  _address jsonb,
  _status member_status,
  _exam_grau_iniciatico date DEFAULT NULL,
  _exam_grau_demolay date DEFAULT NULL,
  _guardians jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_cpf_clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_rg_clean  text := regexp_replace(coalesce(_rg,''),  '\D', '', 'g');
  v_g jsonb;
  v_g_cpf text;
  v_is_primary boolean := true;
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;
  IF NOT public.is_chapter_member(v_member.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;

  UPDATE public.members SET
    full_name = _full_name,
    birth_date = _birth_date,
    phone = _phone,
    email = _email,
    address = coalesce(_address, '{}'::jsonb),
    status = coalesce(_status, v_member.status),
    exam_grau_iniciatico = _exam_grau_iniciatico,
    exam_grau_demolay = _exam_grau_demolay,
    cpf_encrypted = CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) ELSE cpf_encrypted END,
    cpf_last2 = CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) ELSE cpf_last2 END,
    rg_encrypted = CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) ELSE rg_encrypted END,
    rg_last2 = CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) ELSE rg_last2 END,
    updated_at = now()
  WHERE id = _member_id;

  IF _guardians IS NOT NULL AND jsonb_typeof(_guardians) = 'array' THEN
    DELETE FROM public.guardians WHERE member_id = _member_id;
    FOR v_g IN SELECT * FROM jsonb_array_elements(_guardians)
    LOOP
      IF length(coalesce(v_g->>'full_name','')) > 0 THEN
        v_g_cpf := regexp_replace(coalesce(v_g->>'cpf',''), '\D', '', 'g');
        INSERT INTO public.guardians(member_id, full_name, relationship, cpf_encrypted, cpf_last2, phone, email, is_primary)
        VALUES (
          _member_id,
          v_g->>'full_name',
          v_g->>'relationship',
          CASE WHEN length(v_g_cpf) > 0 THEN public.encrypt_pii(v_g_cpf) END,
          CASE WHEN length(v_g_cpf) >= 2 THEN right(v_g_cpf, 2) END,
          v_g->>'phone',
          v_g->>'email',
          v_is_primary
        );
        v_is_primary := false;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (v_member.chapter_id, auth.uid(), 'member_update', 'members', _member_id,
          jsonb_build_object('full_name', _full_name, 'status', _status));

  RETURN _member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_member_with_pii(uuid, text, date, text, text, text, text, jsonb, member_status, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_with_pii(uuid, text, date, text, text, text, text, jsonb, member_status, date, date, jsonb) TO authenticated, service_role;

-- allow adding a second guardian at creation time
CREATE OR REPLACE FUNCTION public.add_member_guardian(_member_id uuid, _guardian jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter uuid;
  v_cpf text := regexp_replace(coalesce(_guardian->>'cpf',''), '\D', '', 'g');
  v_id uuid;
BEGIN
  SELECT chapter_id INTO v_chapter FROM public.members WHERE id = _member_id;
  IF v_chapter IS NULL OR NOT public.is_chapter_member(v_chapter) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(_guardian->>'full_name','')) = 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.guardians(member_id, full_name, relationship, cpf_encrypted, cpf_last2, phone, email, is_primary)
  VALUES (
    _member_id,
    _guardian->>'full_name',
    _guardian->>'relationship',
    CASE WHEN length(v_cpf) > 0 THEN public.encrypt_pii(v_cpf) END,
    CASE WHEN length(v_cpf) >= 2 THEN right(v_cpf, 2) END,
    _guardian->>'phone',
    _guardian->>'email',
    false
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_member_guardian(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_member_guardian(uuid, jsonb) TO authenticated, service_role;
