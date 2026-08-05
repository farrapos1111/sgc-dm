-- Follow-ups de review: UUID seguro no signup, unique_violation demolay_id,
-- e proteção de profiles.is_super_admin

-- 1) Proteção is_super_admin (só postgres / service_role alteram)
CREATE OR REPLACE FUNCTION public.tg_protect_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF current_user IN ('postgres', 'supabase_admin')
       OR v_role = 'service_role' THEN
      RETURN NEW;
    END IF;
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_super_admin ON public.profiles;
CREATE TRIGGER profiles_protect_super_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_super_admin();

-- 2) create_member_with_pii: mensagem amigável também no unique_violation
CREATE OR REPLACE FUNCTION public.create_member_with_pii(
  _chapter_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status, _kind member_kind,
  _guardian jsonb, _consent_text_version text,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date,
  _demolay_id text DEFAULT NULL, _masonic_id text DEFAULT NULL,
  _initiation_chapter_id uuid DEFAULT NULL)
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
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_init uuid := coalesce(_initiation_chapter_id, _chapter_id);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _chapter_id IS NULL OR nullif(trim(coalesce(_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes';
  END IF;
  IF NOT public.is_chapter_member(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(_chapter_id, 'secretaria')
     AND NOT public.has_permission(_chapter_id, 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para criar membros' USING ERRCODE = '42501';
  END IF;

  IF v_demolay IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE demolay_id IS NOT NULL AND lower(trim(demolay_id)) = lower(v_demolay)
  ) THEN
    RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
  END IF;

  BEGIN
    INSERT INTO public.members(
      chapter_id, initiation_chapter_id, full_name, birth_date,
      cpf_encrypted, cpf_last2, rg_encrypted, rg_last2,
      phone, email, address, status, kind, created_by,
      exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay,
      demolay_id, masonic_id
    ) VALUES (
      _chapter_id, v_init, _full_name, _birth_date,
      CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) END,
      CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) END,
      CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) END,
      CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) END,
      _phone, _email, coalesce(_address, '{}'::jsonb),
      coalesce(_status, 'regular'), coalesce(_kind, 'demolay_ativo'), auth.uid(),
      _exam_grau_iniciatico, _exam_grau_demolay, _iniciacao_ordem, _iniciacao_grau_demolay,
      v_demolay,
      nullif(trim(coalesce(_masonic_id, '')), '')
    ) RETURNING id INTO v_member_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF v_demolay IS NOT NULL THEN
        RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
      END IF;
      RAISE;
  END;

  INSERT INTO public.member_chapter_affiliations (member_id, chapter_id, active, created_by)
  VALUES (v_member_id, _chapter_id, true, auth.uid())
  ON CONFLICT (member_id, chapter_id) DO NOTHING;

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

-- 3) Signup: validar UUID do path sem erro 22P02
CREATE OR REPLACE FUNCTION public.submit_investigation_signup(
  _token text,
  _candidate_name text,
  _candidate_birth_date date,
  _cpf text,
  _rg text,
  _candidate_email text,
  _candidate_phone text,
  _celular text,
  _address jsonb,
  _guardians jsonb,
  _sponsor_member_id uuid,
  _sponsor_text text,
  _has_demolay_relative boolean,
  _demolay_relative_name text,
  _demolay_relative_chapter text,
  _has_mason_relative boolean,
  _mason_relative_name text,
  _mason_relative_lodge text,
  _notes text,
  _doc_rg_front_path text,
  _doc_rg_back_path text,
  _doc_cpf_front_path text DEFAULT NULL,
  _doc_cpf_back_path text DEFAULT NULL,
  _sponsor_meta jsonb DEFAULT '{}'::jsonb,
  _temp_id uuid DEFAULT NULL,
  _lgpd_consent_text_version text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_chapter uuid;
  v_id uuid;
  v_cpf text := nullif(regexp_replace(coalesce(_cpf, ''), '[^0-9]', '', 'g'), '');
  v_rg text := nullif(trim(coalesce(_rg, '')), '');
  v_addr jsonb := coalesce(_address, '{}'::jsonb);
  v_guardians jsonb := coalesce(_guardians, '[]'::jsonb);
  v_sponsor text := nullif(trim(coalesce(_sponsor_text, '')), '');
  v_g1 jsonb;
  v_cpf_hash text;
  v_prefix text;
  v_temp uuid;
  v_seg text;
  v_lgpd text := nullif(trim(coalesce(_lgpd_consent_text_version, '')), '');
  v_rg_front text := nullif(trim(coalesce(_doc_rg_front_path, '')), '');
  v_rg_back text := nullif(trim(coalesce(_doc_rg_back_path, '')), '');
BEGIN
  IF nullif(trim(_candidate_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do candidato';
  END IF;
  IF _candidate_birth_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data de nascimento';
  END IF;
  IF v_cpf IS NULL OR length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'Informe o CPF com 11 dígitos';
  END IF;
  IF v_rg IS NULL THEN
    RAISE EXCEPTION 'Informe o RG';
  END IF;
  IF nullif(trim(coalesce(_candidate_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o e-mail';
  END IF;
  IF nullif(trim(coalesce(_candidate_phone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o telefone';
  END IF;
  IF nullif(trim(coalesce(_celular, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o celular';
  END IF;
  IF v_lgpd IS NULL THEN
    RAISE EXCEPTION 'Consentimento LGPD obrigatório';
  END IF;
  IF nullif(trim(coalesce(v_addr->>'zip', '')), '') IS NULL
     OR nullif(trim(coalesce(v_addr->>'street', '')), '') IS NULL
     OR nullif(trim(coalesce(v_addr->>'number', '')), '') IS NULL
     OR nullif(trim(coalesce(v_addr->>'neighborhood', '')), '') IS NULL
     OR nullif(trim(coalesce(v_addr->>'city', '')), '') IS NULL
     OR nullif(trim(coalesce(v_addr->>'state', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Preencha o endereço completo';
  END IF;

  IF jsonb_typeof(v_guardians) <> 'array' OR jsonb_array_length(v_guardians) < 1 THEN
    RAISE EXCEPTION 'Informe o responsável';
  END IF;
  v_g1 := v_guardians->0;
  IF nullif(trim(coalesce(v_g1->>'full_name', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do responsável';
  END IF;

  SELECT coalesce(jsonb_agg(g.obj), '[]'::jsonb)
  INTO v_guardians
  FROM (
    SELECT jsonb_build_object(
      'full_name', left(trim(coalesce(e.elem->>'full_name', '')), 120),
      'relationship', left(trim(coalesce(e.elem->>'relationship', '')), 60),
      'cpf', left(regexp_replace(coalesce(e.elem->>'cpf', ''), '[^0-9]', '', 'g'), 11),
      'phone', left(trim(coalesce(e.elem->>'phone', '')), 30),
      'email', left(trim(coalesce(e.elem->>'email', '')), 120)
    ) AS obj
    FROM jsonb_array_elements(v_guardians) WITH ORDINALITY AS e(elem, ord)
    WHERE nullif(trim(coalesce(e.elem->>'full_name', '')), '') IS NOT NULL
    ORDER BY e.ord
    LIMIT 2
  ) g;

  IF jsonb_array_length(v_guardians) < 1 THEN
    RAISE EXCEPTION 'Informe o responsável';
  END IF;
  v_g1 := v_guardians->0;

  IF _sponsor_member_id IS NULL AND v_sponsor IS NULL THEN
    RAISE EXCEPTION 'Informe o padrinho / indicado por';
  END IF;

  IF coalesce(_has_demolay_relative, false)
     AND (
       nullif(trim(coalesce(_demolay_relative_name, '')), '') IS NULL
       OR nullif(trim(coalesce(_demolay_relative_chapter, '')), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Preencha o parentesco DeMolay';
  END IF;
  IF coalesce(_has_mason_relative, false)
     AND (
       nullif(trim(coalesce(_mason_relative_name, '')), '') IS NULL
       OR nullif(trim(coalesce(_mason_relative_lodge, '')), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'Preencha o parentesco maçônico';
  END IF;

  IF nullif(trim(coalesce(_doc_cpf_front_path, '')), '') IS NOT NULL
     OR nullif(trim(coalesce(_doc_cpf_back_path, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Envio de imagem de CPF não é mais aceito; use Identidade (frente e verso)';
  END IF;

  IF v_rg_front IS NULL OR v_rg_back IS NULL THEN
    RAISE EXCEPTION 'Envie as imagens de Identidade (frente e verso)';
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;

  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  IF _temp_id IS NOT NULL THEN
    v_temp := _temp_id;
  ELSE
    v_seg := NULLIF(split_part(v_rg_front, '/', 3), '');
    IF v_seg IS NOT NULL
       AND v_seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_temp := v_seg::uuid;
    ELSE
      v_temp := NULL;
    END IF;
  END IF;

  IF v_temp IS NULL THEN
    RAISE EXCEPTION 'Identificador de inscrição inválido';
  END IF;

  v_prefix := v_chapter::text || '/investigation/' || v_temp::text;

  IF v_rg_front NOT LIKE v_prefix || '/%'
     OR v_rg_back NOT LIKE v_prefix || '/%'
     OR split_part(v_rg_front, '/', 3) <> v_temp::text
     OR split_part(v_rg_back, '/', 3) <> v_temp::text THEN
    RAISE EXCEPTION 'Documentos inválidos para esta inscrição';
  END IF;

  IF split_part(v_rg_front, '/', 4) NOT LIKE 'rg_front.%'
     OR split_part(v_rg_back, '/', 4) NOT LIKE 'rg_back.%' THEN
    RAISE EXCEPTION 'Documentos de identidade inválidos (RG frente/verso)';
  END IF;

  IF v_rg_front !~* '\.(jpe?g|png|webp|pdf)$'
     OR v_rg_back !~* '\.(jpe?g|png|webp|pdf)$' THEN
    RAISE EXCEPTION 'Formato de documento de identidade inválido';
  END IF;

  PERFORM public.record_investigation_public_attempt(
    _token, 'signup', NULL, v_cpf, 20, 5, 60
  );

  v_cpf_hash := encode(digest(v_cpf, 'sha256'), 'hex');

  IF EXISTS (
    SELECT 1
    FROM public.investigation_files f
    WHERE f.chapter_id = v_chapter
      AND f.cpf_hash = v_cpf_hash
      AND f.status IS DISTINCT FROM 'arquivada'
  ) THEN
    RAISE EXCEPTION 'Já existe uma ficha com este CPF neste capítulo';
  END IF;

  INSERT INTO public.investigation_files (
    chapter_id, candidate_name, candidate_birth_date,
    cpf, rg, cpf_last2, rg_last2, cpf_hash, cpf_encrypted, rg_encrypted,
    candidate_email, candidate_phone, celular,
    address, guardians,
    sponsor_member_id, sponsor_text, sponsor_meta, referred_by,
    has_demolay_relative, demolay_relative_name, demolay_relative_chapter,
    has_mason_relative, mason_relative_name, mason_relative_lodge,
    notes, status, signup_source,
    doc_rg_front_path, doc_rg_back_path, doc_cpf_front_path, doc_cpf_back_path,
    guardian_name, lgpd_consent_text_version, lgpd_consented_at
  ) VALUES (
    v_chapter,
    trim(_candidate_name),
    _candidate_birth_date,
    v_cpf,
    v_rg,
    right(v_cpf, 2),
    CASE WHEN length(v_rg) >= 2 THEN right(v_rg, 2) ELSE NULL END,
    v_cpf_hash,
    public.encrypt_pii(v_cpf),
    public.encrypt_pii(v_rg),
    trim(_candidate_email),
    trim(_candidate_phone),
    trim(_celular),
    v_addr,
    v_guardians,
    _sponsor_member_id,
    CASE WHEN _sponsor_member_id IS NOT NULL THEN NULL ELSE v_sponsor END,
    coalesce(_sponsor_meta, '{}'::jsonb),
    coalesce(
      (SELECT m.full_name FROM public.members m WHERE m.id = _sponsor_member_id),
      v_sponsor
    ),
    coalesce(_has_demolay_relative, false),
    nullif(trim(coalesce(_demolay_relative_name, '')), ''),
    nullif(trim(coalesce(_demolay_relative_chapter, '')), ''),
    coalesce(_has_mason_relative, false),
    nullif(trim(coalesce(_mason_relative_name, '')), ''),
    nullif(trim(coalesce(_mason_relative_lodge, '')), ''),
    nullif(trim(coalesce(_notes, '')), ''),
    'aberta',
    'publico',
    v_rg_front,
    v_rg_back,
    NULL,
    NULL,
    trim(v_g1->>'full_name'),
    v_lgpd,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
