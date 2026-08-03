-- Relaxar signup: 1 responsável obrigatório; observações opcionais.
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
  _doc_cpf_front_path text,
  _doc_cpf_back_path text,
  _sponsor_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_id uuid;
  v_cpf text := nullif(regexp_replace(coalesce(_cpf, ''), '\D', '', 'g'), '');
  v_rg text := nullif(trim(coalesce(_rg, '')), '');
  v_addr jsonb := coalesce(_address, '{}'::jsonb);
  v_guardians jsonb := coalesce(_guardians, '[]'::jsonb);
  v_sponsor text := nullif(trim(coalesce(_sponsor_text, '')), '');
  v_g1 jsonb;
BEGIN
  IF nullif(trim(_candidate_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do candidato';
  END IF;
  IF _candidate_birth_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data de nascimento';
  END IF;
  IF v_cpf IS NULL OR length(v_cpf) < 11 THEN
    RAISE EXCEPTION 'Informe o CPF';
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
     OR nullif(trim(coalesce(_doc_rg_back_path, '')), '') IS NULL
     OR nullif(trim(coalesce(_doc_cpf_front_path, '')), '') IS NULL
     OR nullif(trim(coalesce(_doc_cpf_back_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Envie as imagens de RG e CPF (frente e verso)';
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;

  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  IF split_part(_doc_rg_front_path, '/', 1) <> v_chapter::text
     OR split_part(_doc_rg_back_path, '/', 1) <> v_chapter::text
     OR split_part(_doc_cpf_front_path, '/', 1) <> v_chapter::text
     OR split_part(_doc_cpf_back_path, '/', 1) <> v_chapter::text THEN
    RAISE EXCEPTION 'Documentos inválidos para este capítulo';
  END IF;

  INSERT INTO public.investigation_files (
    chapter_id, candidate_name, candidate_birth_date,
    cpf, rg, cpf_last2, rg_last2,
    candidate_email, candidate_phone, celular,
    address, guardians,
    sponsor_member_id, sponsor_text, sponsor_meta, referred_by,
    has_demolay_relative, demolay_relative_name, demolay_relative_chapter,
    has_mason_relative, mason_relative_name, mason_relative_lodge,
    notes, status, signup_source,
    doc_rg_front_path, doc_rg_back_path, doc_cpf_front_path, doc_cpf_back_path,
    guardian_name
  ) VALUES (
    v_chapter,
    trim(_candidate_name),
    _candidate_birth_date,
    v_cpf,
    v_rg,
    right(v_cpf, 2),
    CASE WHEN length(v_rg) >= 2 THEN right(v_rg, 2) ELSE NULL END,
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
    trim(_doc_cpf_front_path),
    trim(_doc_cpf_back_path),
    trim(v_g1->>'full_name')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
