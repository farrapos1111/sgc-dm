ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS iniciacao_ordem date,
  ADD COLUMN IF NOT EXISTS iniciacao_grau_demolay date;

CREATE OR REPLACE FUNCTION public.create_member_with_pii(
  _chapter_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status, _guardian jsonb, _consent_text_version text,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_guardian_id uuid;
  v_cpf_clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_rg_clean  text := regexp_replace(coalesce(_rg,''),  '\D', '', 'g');
  v_g_cpf_clean text;
BEGIN
  IF NOT public.is_chapter_member(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.members(
    chapter_id, full_name, birth_date,
    cpf_encrypted, cpf_last2, rg_encrypted, rg_last2,
    phone, email, address, status, created_by,
    exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay
  ) VALUES (
    _chapter_id, _full_name, _birth_date,
    CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) END,
    CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) END,
    CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) END,
    CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) END,
    _phone, _email, coalesce(_address, '{}'::jsonb),
    coalesce(_status, 'ativo'), auth.uid(),
    _exam_grau_iniciatico, _exam_grau_demolay, _iniciacao_ordem, _iniciacao_grau_demolay
  ) RETURNING id INTO v_member_id;

  IF _guardian IS NOT NULL AND (_guardian ? 'full_name') AND length(coalesce(_guardian->>'full_name','')) > 0 THEN
    v_g_cpf_clean := regexp_replace(coalesce(_guardian->>'cpf',''), '\D', '', 'g');
    INSERT INTO public.guardians(
      member_id, full_name, relationship,
      cpf_encrypted, cpf_last2, phone, email, is_primary
    ) VALUES (
      v_member_id,
      _guardian->>'full_name',
      _guardian->>'relationship',
      CASE WHEN length(v_g_cpf_clean) > 0 THEN public.encrypt_pii(v_g_cpf_clean) END,
      CASE WHEN length(v_g_cpf_clean) >= 2 THEN right(v_g_cpf_clean, 2) END,
      _guardian->>'phone',
      _guardian->>'email',
      true
    ) RETURNING id INTO v_guardian_id;
  END IF;

  IF _consent_text_version IS NOT NULL AND length(_consent_text_version) > 0 THEN
    INSERT INTO public.lgpd_consents(
      member_id, guardian_id, consent_text_version, signed_by_user_id
    ) VALUES (
      v_member_id, v_guardian_id, _consent_text_version, auth.uid()
    );
  END IF;

  RETURN v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_with_pii(
  _member_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _guardians jsonb DEFAULT NULL::jsonb,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    iniciacao_ordem = _iniciacao_ordem,
    iniciacao_grau_demolay = _iniciacao_grau_demolay,
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
$function$;