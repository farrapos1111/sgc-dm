-- Ficha de iniciação: identidade frente/verso obrigatória; CPF mídia opcional (não coletada)

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
  v_lgpd text := nullif(trim(coalesce(_lgpd_consent_text_version, '')), '');
  v_cpf_front text := nullif(trim(coalesce(_doc_cpf_front_path, '')), '');
  v_cpf_back text := nullif(trim(coalesce(_doc_cpf_back_path, '')), '');
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

  IF nullif(trim(coalesce(_doc_rg_front_path, '')), '') IS NULL
     OR nullif(trim(coalesce(_doc_rg_back_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Envie as imagens de Identidade (frente e verso)';
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;

  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  v_temp := coalesce(
    _temp_id,
    NULLIF(split_part(_doc_rg_front_path, '/', 3), '')::uuid
  );
  IF v_temp IS NULL THEN
    RAISE EXCEPTION 'Identificador de inscrição inválido';
  END IF;

  v_prefix := v_chapter::text || '/investigation/' || v_temp::text;
  IF _doc_rg_front_path NOT LIKE v_prefix || '/%'
     OR _doc_rg_back_path NOT LIKE v_prefix || '/%'
     OR split_part(_doc_rg_front_path, '/', 3) <> v_temp::text
     OR split_part(_doc_rg_back_path, '/', 3) <> v_temp::text THEN
    RAISE EXCEPTION 'Documentos inválidos para esta inscrição';
  END IF;

  -- CPF mídia legado: se enviado, valida prefixo; senão permanece nulo
  IF v_cpf_front IS NOT NULL AND (
       v_cpf_front NOT LIKE v_prefix || '/%'
       OR split_part(v_cpf_front, '/', 3) <> v_temp::text
     ) THEN
    RAISE EXCEPTION 'Documentos inválidos para esta inscrição';
  END IF;
  IF v_cpf_back IS NOT NULL AND (
       v_cpf_back NOT LIKE v_prefix || '/%'
       OR split_part(v_cpf_back, '/', 3) <> v_temp::text
     ) THEN
    RAISE EXCEPTION 'Documentos inválidos para esta inscrição';
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
    trim(_doc_rg_front_path),
    trim(_doc_rg_back_path),
    v_cpf_front,
    v_cpf_back,
    trim(v_g1->>'full_name'),
    v_lgpd,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
