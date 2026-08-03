-- Forward: hardening de signup/upload, PII, storage, votos e busca de membros.

-- 1) Busca pública: mínimo 2 caracteres
CREATE OR REPLACE FUNCTION public.list_investigation_signup_members(
  _token text,
  _search text DEFAULT ''
)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_q text := lower(trim(coalesce(_search, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;
  IF v_chapter IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.full_name
  FROM public.members m
  WHERE m.chapter_id = v_chapter
    AND m.status = 'regular'
    AND lower(m.full_name) LIKE '%' || v_q || '%'
  ORDER BY m.full_name
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.list_investigation_signup_members(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_investigation_signup_members(text, text)
  TO anon, authenticated, service_role;

-- 2) Storage helper IMMUTABLE + can_write_member_documents
CREATE OR REPLACE FUNCTION public.storage_chapter_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_seg text;
BEGIN
  v_seg := (storage.foldername(object_name))[1];
  IF v_seg IS NULL OR v_seg !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;
  RETURN v_seg::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_member_documents(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_commission(_chapter_id, 'sindicancias')
      OR public.has_any_role(
        _chapter_id,
        ARRAY['mestre_conselheiro', 'admin_total', 'presidente_conselho']
      );
$$;

REVOKE ALL ON FUNCTION public.can_write_member_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_member_documents(uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS member_documents_insert ON storage.objects;
CREATE POLICY member_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_write_member_documents(public.storage_chapter_uuid(name))
  );

DROP POLICY IF EXISTS member_documents_update ON storage.objects;
CREATE POLICY member_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_write_member_documents(public.storage_chapter_uuid(name))
  )
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_write_member_documents(public.storage_chapter_uuid(name))
  );

DROP POLICY IF EXISTS member_documents_delete ON storage.objects;
CREATE POLICY member_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_write_member_documents(public.storage_chapter_uuid(name))
  );

-- 3) Colunas PII / LGPD em investigation_files
ALTER TABLE public.investigation_files
  ADD COLUMN IF NOT EXISTS cpf_encrypted bytea,
  ADD COLUMN IF NOT EXISTS rg_encrypted bytea,
  ADD COLUMN IF NOT EXISTS cpf_hash text,
  ADD COLUMN IF NOT EXISTS lgpd_consent_text_version text,
  ADD COLUMN IF NOT EXISTS lgpd_consented_at timestamptz;

UPDATE public.investigation_files f
SET
  cpf_hash = encode(extensions.digest(regexp_replace(f.cpf, '[^0-9]', '', 'g'), 'sha256'), 'hex'),
  cpf_encrypted = public.encrypt_pii(regexp_replace(f.cpf, '[^0-9]', '', 'g')),
  cpf_last2 = coalesce(f.cpf_last2, right(regexp_replace(f.cpf, '[^0-9]', '', 'g'), 2)),
  cpf = NULL
WHERE f.cpf IS NOT NULL
  AND length(regexp_replace(f.cpf, '[^0-9]', '', 'g')) = 11
  AND f.cpf_encrypted IS NULL;

UPDATE public.investigation_files f
SET
  rg_encrypted = public.encrypt_pii(trim(f.rg)),
  rg_last2 = coalesce(f.rg_last2, CASE WHEN length(trim(f.rg)) >= 2 THEN right(trim(f.rg), 2) ELSE NULL END),
  rg = NULL
WHERE f.rg IS NOT NULL
  AND nullif(trim(f.rg), '') IS NOT NULL
  AND f.rg_encrypted IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS investigation_files_chapter_cpf_hash_uidx
  ON public.investigation_files (chapter_id, cpf_hash)
  WHERE cpf_hash IS NOT NULL AND status IS DISTINCT FROM 'arquivada';

-- Trigger: encrypt plaintext on write
CREATE OR REPLACE FUNCTION public.tg_investigation_files_encrypt_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cpf text;
  v_rg text;
BEGIN
  v_cpf := nullif(regexp_replace(coalesce(NEW.cpf, ''), '[^0-9]', '', 'g'), '');
  IF v_cpf IS NOT NULL THEN
    IF length(v_cpf) <> 11 THEN
      RAISE EXCEPTION 'Informe o CPF com 11 dígitos';
    END IF;
    NEW.cpf_hash := encode(digest(v_cpf, 'sha256'), 'hex');
    NEW.cpf_encrypted := public.encrypt_pii(v_cpf);
    NEW.cpf_last2 := right(v_cpf, 2);
    NEW.cpf := NULL;
  END IF;

  v_rg := nullif(trim(coalesce(NEW.rg, '')), '');
  IF v_rg IS NOT NULL THEN
    NEW.rg_encrypted := public.encrypt_pii(v_rg);
    NEW.rg_last2 := CASE WHEN length(v_rg) >= 2 THEN right(v_rg, 2) ELSE NULL END;
    NEW.rg := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigation_files_encrypt_pii ON public.investigation_files;
CREATE TRIGGER investigation_files_encrypt_pii
  BEFORE INSERT OR UPDATE OF cpf, rg ON public.investigation_files
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_investigation_files_encrypt_pii();

CREATE OR REPLACE FUNCTION public.reveal_investigation_pii(_file_id uuid, _field text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.investigation_files%ROWTYPE;
  v_plain text;
BEGIN
  IF _field NOT IN ('cpf', 'rg') THEN
    RAISE EXCEPTION 'Campo inválido: %', _field;
  END IF;

  SELECT * INTO v_file FROM public.investigation_files WHERE id = _file_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha não encontrada';
  END IF;

  IF NOT public.can_reveal_id_documents(v_file.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para revelar PII' USING ERRCODE = '42501';
  END IF;

  IF _field = 'cpf' THEN
    v_plain := coalesce(public.decrypt_pii(v_file.cpf_encrypted), v_file.cpf);
  ELSE
    v_plain := coalesce(public.decrypt_pii(v_file.rg_encrypted), v_file.rg);
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (
    v_file.chapter_id,
    auth.uid(),
    'pii_reveal',
    'investigation_files',
    v_file.id,
    jsonb_build_object('field', _field)
  );

  RETURN coalesce(v_plain, '');
END;
$$;

-- 4) Tentativas públicas (rate limit persistente)
CREATE TABLE IF NOT EXISTS public.investigation_public_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('signup', 'upload')),
  sender_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_public_attempts_lookup_idx
  ON public.investigation_public_attempts (chapter_id, kind, sender_key, created_at DESC);

CREATE INDEX IF NOT EXISTS investigation_public_attempts_created_idx
  ON public.investigation_public_attempts (created_at);

ALTER TABLE public.investigation_public_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_investigation_public_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.investigation_public_attempts
  WHERE created_at < now() - interval '2 days';
$$;

CREATE OR REPLACE FUNCTION public.record_investigation_public_attempt(
  _token text,
  _kind text,
  _sender_key text,
  _chapter_limit integer DEFAULT 20,
  _sender_limit integer DEFAULT 5,
  _window_minutes integer DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_sender text := nullif(trim(coalesce(_sender_key, '')), '');
  v_chapter_count integer;
  v_sender_count integer;
BEGIN
  IF _kind NOT IN ('signup', 'upload') THEN
    RAISE EXCEPTION 'Tipo de tentativa inválido';
  END IF;
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Identificador de envio inválido';
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;
  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  PERFORM public.cleanup_investigation_public_attempts();

  INSERT INTO public.investigation_public_attempts (chapter_id, kind, sender_key)
  VALUES (v_chapter, _kind, v_sender);

  SELECT count(*)::integer INTO v_sender_count
  FROM public.investigation_public_attempts a
  WHERE a.chapter_id = v_chapter
    AND a.kind = _kind
    AND a.sender_key = v_sender
    AND a.created_at > now() - make_interval(mins => _window_minutes);

  IF v_sender_count > _sender_limit THEN
    RAISE EXCEPTION 'Limite de envios atingido. Tente novamente mais tarde.';
  END IF;

  SELECT count(*)::integer INTO v_chapter_count
  FROM public.investigation_public_attempts a
  WHERE a.chapter_id = v_chapter
    AND a.kind = _kind
    AND a.created_at > now() - make_interval(mins => _window_minutes);

  IF v_chapter_count > _chapter_limit THEN
    RAISE EXCEPTION 'Limite de envios públicos atingido. Tente novamente mais tarde.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_investigation_public_attempt(text, text, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_investigation_public_attempt(text, text, text, integer, integer, integer)
  TO anon, authenticated, service_role;

-- 5) submit_investigation_signup reforçado
DROP FUNCTION IF EXISTS public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb, uuid, text,
  boolean, text, text, boolean, text, text, text, text, text, text, text, jsonb
);

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
     OR _doc_cpf_front_path NOT LIKE v_prefix || '/%'
     OR _doc_cpf_back_path NOT LIKE v_prefix || '/%'
     OR split_part(_doc_rg_front_path, '/', 3) <> v_temp::text
     OR split_part(_doc_rg_back_path, '/', 3) <> v_temp::text
     OR split_part(_doc_cpf_front_path, '/', 3) <> v_temp::text
     OR split_part(_doc_cpf_back_path, '/', 3) <> v_temp::text THEN
    RAISE EXCEPTION 'Documentos inválidos para esta inscrição';
  END IF;

  PERFORM public.record_investigation_public_attempt(
    _token, 'signup', v_temp::text, 20, 5, 60
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
    trim(_doc_cpf_front_path),
    trim(_doc_cpf_back_path),
    trim(v_g1->>'full_name'),
    v_lgpd,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb, uuid, text,
  boolean, text, text, boolean, text, text, text, text, text, text, text, jsonb, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb, uuid, text,
  boolean, text, text, boolean, text, text, text, text, text, text, text, jsonb, uuid, text
) TO anon, authenticated, service_role;

-- 6) Votos: elegibilidade + FK composta + DROP policies reexecutáveis
CREATE OR REPLACE FUNCTION public.can_cast_sindicancia_vote(_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := public.auth_member_id_in_chapter(_chapter_id);
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_semester integer := CASE WHEN EXTRACT(MONTH FROM now()) <= 6 THEN 1 ELSE 2 END;
BEGIN
  IF v_member IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_commission_member(_chapter_id, 'sindicancias') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.member_positions mp
    JOIN public.positions p ON p.id = mp.position_id
    WHERE mp.chapter_id = _chapter_id
      AND mp.member_id = v_member
      AND mp.term_year = v_year
      AND mp.term_semester = v_semester
      AND p.code = ANY (ARRAY[
        'mestre_conselheiro',
        'primeiro_conselheiro',
        'segundo_conselheiro',
        'presidente_conselho_consultivo',
        'conselheiro_consultor'
      ])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_cast_sindicancia_vote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_cast_sindicancia_vote(uuid)
  TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sindicancia_details_event_chapter_uid'
  ) THEN
    ALTER TABLE public.sindicancia_details
      ADD CONSTRAINT sindicancia_details_event_chapter_uid
      UNIQUE (calendar_event_id, chapter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sindicancia_votes_event_chapter_fkey'
  ) THEN
    ALTER TABLE public.sindicancia_votes
      ADD CONSTRAINT sindicancia_votes_event_chapter_fkey
      FOREIGN KEY (calendar_event_id, chapter_id)
      REFERENCES public.sindicancia_details (calendar_event_id, chapter_id);
  END IF;
END $$;

DROP POLICY IF EXISTS sindicancia_votes_select ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_write ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_insert ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_update ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_delete ON public.sindicancia_votes;

CREATE POLICY sindicancia_votes_select ON public.sindicancia_votes
  FOR SELECT TO authenticated
  USING (public.can_read_sindicancia_votes(chapter_id));

CREATE POLICY sindicancia_votes_insert ON public.sindicancia_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
    AND EXISTS (
      SELECT 1 FROM public.sindicancia_details d
      WHERE d.calendar_event_id = sindicancia_votes.calendar_event_id
        AND d.chapter_id = sindicancia_votes.chapter_id
    )
  );

CREATE POLICY sindicancia_votes_update ON public.sindicancia_votes
  FOR UPDATE TO authenticated
  USING (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  )
  WITH CHECK (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
    AND EXISTS (
      SELECT 1 FROM public.sindicancia_details d
      WHERE d.calendar_event_id = sindicancia_votes.calendar_event_id
        AND d.chapter_id = sindicancia_votes.chapter_id
    )
  );

CREATE POLICY sindicancia_votes_delete ON public.sindicancia_votes
  FOR DELETE TO authenticated
  USING (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  );
