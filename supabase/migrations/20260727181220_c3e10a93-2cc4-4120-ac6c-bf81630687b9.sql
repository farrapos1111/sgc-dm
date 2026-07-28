ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS exam_grau_iniciatico date,
  ADD COLUMN IF NOT EXISTS exam_grau_demolay date;

CREATE OR REPLACE FUNCTION public.create_member_with_pii(
  _chapter_id uuid, _full_name text, _birth_date date, _cpf text, _rg text,
  _phone text, _email text, _address jsonb, _status member_status, _guardian jsonb,
  _consent_text_version text,
  _exam_grau_iniciatico date DEFAULT NULL,
  _exam_grau_demolay date DEFAULT NULL
)
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
    exam_grau_iniciatico, exam_grau_demolay
  ) VALUES (
    _chapter_id, _full_name, _birth_date,
    CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) END,
    CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) END,
    CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) END,
    CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) END,
    _phone, _email, coalesce(_address, '{}'::jsonb),
    coalesce(_status, 'ativo'), auth.uid(),
    _exam_grau_iniciatico, _exam_grau_demolay
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

REVOKE ALL ON FUNCTION public.create_member_with_pii(uuid, text, date, text, text, text, text, jsonb, member_status, jsonb, text, date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_member_with_pii(uuid, text, date, text, text, text, text, jsonb, member_status, jsonb, text, date, date) TO authenticated;