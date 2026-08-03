-- Documentos RG/CPF, Escrivão de Parecer, ata formulário, PII restrito + audit.

-- 1) Colunas de documentos na ficha e no membro
ALTER TABLE public.investigation_files
  ADD COLUMN IF NOT EXISTS doc_rg_front_path text,
  ADD COLUMN IF NOT EXISTS doc_rg_back_path text,
  ADD COLUMN IF NOT EXISTS doc_cpf_front_path text,
  ADD COLUMN IF NOT EXISTS doc_cpf_back_path text,
  ADD COLUMN IF NOT EXISTS sponsor_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS doc_rg_front_path text,
  ADD COLUMN IF NOT EXISTS doc_rg_back_path text,
  ADD COLUMN IF NOT EXISTS doc_cpf_front_path text,
  ADD COLUMN IF NOT EXISTS doc_cpf_back_path text;

-- 2) Renomear padrinho da sindicância → Escrivão de Parecer (clerk_*)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sindicancia_details'
      AND column_name = 'sponsor_member_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sindicancia_details'
      AND column_name = 'clerk_member_id'
  ) THEN
    ALTER TABLE public.sindicancia_details
      RENAME COLUMN sponsor_member_id TO clerk_member_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sindicancia_details'
      AND column_name = 'sponsor_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sindicancia_details'
      AND column_name = 'clerk_text'
  ) THEN
    ALTER TABLE public.sindicancia_details
      RENAME COLUMN sponsor_text TO clerk_text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sindicancia_details_sponsor_member_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sindicancia_details_clerk_member_id_fkey'
  ) THEN
    ALTER TABLE public.sindicancia_details
      RENAME CONSTRAINT sindicancia_details_sponsor_member_id_fkey
      TO sindicancia_details_clerk_member_id_fkey;
  END IF;
END $$;

-- 3) Ata de sindicância (formulário por faixa etária + assinaturas)
CREATE TABLE IF NOT EXISTS public.sindicancia_minutes (
  calendar_event_id uuid PRIMARY KEY
    REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  age_band text NOT NULL
    CHECK (age_band IN ('ate_14', '15_17', '18_mais')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  signatures jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sindicancia_minutes_chapter_idx
  ON public.sindicancia_minutes (chapter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sindicancia_minutes TO authenticated;
GRANT ALL ON public.sindicancia_minutes TO service_role;
ALTER TABLE public.sindicancia_minutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sindicancia_minutes_select ON public.sindicancia_minutes;
CREATE POLICY sindicancia_minutes_select ON public.sindicancia_minutes
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS sindicancia_minutes_write ON public.sindicancia_minutes;
CREATE POLICY sindicancia_minutes_write ON public.sindicancia_minutes
  FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'sindicancias'))
  WITH CHECK (public.can_manage_commission(chapter_id, 'sindicancias'));

DROP TRIGGER IF EXISTS sindicancia_minutes_updated_at ON public.sindicancia_minutes;
CREATE TRIGGER sindicancia_minutes_updated_at
  BEFORE UPDATE ON public.sindicancia_minutes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Templates vazios de ata por faixa etária em settings dos capítulos
UPDATE public.chapters
SET settings = coalesce(settings, '{}'::jsonb)
  || jsonb_build_object(
    'sindicancia_ata_templates',
    coalesce(
      settings->'sindicancia_ata_templates',
      jsonb_build_object(
        'ate_14', jsonb_build_object('blocks', '[]'::jsonb),
        '15_17', jsonb_build_object('blocks', '[]'::jsonb),
        '18_mais', jsonb_build_object('blocks', '[]'::jsonb)
      )
    )
  )
WHERE settings->'sindicancia_ata_templates' IS NULL;

-- 5) Quem pode revelar RG/CPF/documentos (antes das policies de storage)
CREATE OR REPLACE FUNCTION public.can_reveal_id_documents(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(
           _chapter_id,
           ARRAY['mestre_conselheiro', 'admin_total', 'presidente_conselho']
         )
      OR public.is_commission_president(_chapter_id, 'sindicancias');
$$;

REVOKE ALL ON FUNCTION public.can_reveal_id_documents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_reveal_id_documents(uuid) TO authenticated, service_role;

-- 6) Bucket privado de documentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-documents',
  'member-documents',
  false,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS member_documents_select ON storage.objects;
CREATE POLICY member_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.can_reveal_id_documents(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS member_documents_insert ON storage.objects;
CREATE POLICY member_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-documents'
    AND (
      public.can_manage_commission(((storage.foldername(name))[1])::uuid, 'sindicancias')
      OR public.has_any_role(
        ((storage.foldername(name))[1])::uuid,
        ARRAY['mestre_conselheiro', 'admin_total', 'presidente_conselho']
      )
    )
  );

DROP POLICY IF EXISTS member_documents_update ON storage.objects;
CREATE POLICY member_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.can_manage_commission(((storage.foldername(name))[1])::uuid, 'sindicancias')
  )
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.can_manage_commission(((storage.foldername(name))[1])::uuid, 'sindicancias')
  );

DROP POLICY IF EXISTS member_documents_delete ON storage.objects;
CREATE POLICY member_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.can_manage_commission(((storage.foldername(name))[1])::uuid, 'sindicancias')
  );

-- Atualiza reveal_member_pii (remove escrivão/tesoureiro; inclui presidente conselho + comissão)
CREATE OR REPLACE FUNCTION public.reveal_member_pii(_member_id uuid, _field text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_plain text;
BEGIN
  IF _field NOT IN ('cpf', 'rg') THEN
    RAISE EXCEPTION 'Campo inválido: %', _field;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF NOT public.can_reveal_id_documents(v_member.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para revelar PII' USING ERRCODE = '42501';
  END IF;

  IF _field = 'cpf' THEN
    v_plain := public.decrypt_pii(v_member.cpf_encrypted);
  ELSE
    v_plain := public.decrypt_pii(v_member.rg_encrypted);
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (
    v_member.chapter_id,
    auth.uid(),
    'pii_reveal',
    'members',
    v_member.id,
    jsonb_build_object('field', _field)
  );

  RETURN v_plain;
END;
$$;

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
    v_plain := v_file.cpf;
  ELSE
    v_plain := v_file.rg;
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

CREATE OR REPLACE FUNCTION public.get_id_document_path(
  _entity text,
  _id uuid,
  _doc_kind text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_path text;
BEGIN
  IF _doc_kind NOT IN ('rg_front', 'rg_back', 'cpf_front', 'cpf_back') THEN
    RAISE EXCEPTION 'Documento inválido: %', _doc_kind;
  END IF;

  IF _entity = 'investigation' THEN
    SELECT chapter_id,
      CASE _doc_kind
        WHEN 'rg_front' THEN doc_rg_front_path
        WHEN 'rg_back' THEN doc_rg_back_path
        WHEN 'cpf_front' THEN doc_cpf_front_path
        WHEN 'cpf_back' THEN doc_cpf_back_path
      END
    INTO v_chapter, v_path
    FROM public.investigation_files
    WHERE id = _id;
  ELSIF _entity = 'member' THEN
    SELECT chapter_id,
      CASE _doc_kind
        WHEN 'rg_front' THEN doc_rg_front_path
        WHEN 'rg_back' THEN doc_rg_back_path
        WHEN 'cpf_front' THEN doc_cpf_front_path
        WHEN 'cpf_back' THEN doc_cpf_back_path
      END
    INTO v_chapter, v_path
    FROM public.members
    WHERE id = _id;
  ELSE
    RAISE EXCEPTION 'Entidade inválida: %', _entity;
  END IF;

  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  IF NOT public.can_reveal_id_documents(v_chapter) THEN
    RAISE EXCEPTION 'Sem permissão para ver documentos' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (
    v_chapter,
    auth.uid(),
    'document_view',
    CASE WHEN _entity = 'member' THEN 'members' ELSE 'investigation_files' END,
    _id,
    jsonb_build_object('doc_kind', _doc_kind)
  );

  RETURN v_path;
END;
$$;

-- Migra documentos da ficha para o membro (após iniciação)
CREATE OR REPLACE FUNCTION public.migrate_investigation_docs_to_member(
  _file_id uuid,
  _member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_file public.investigation_files%ROWTYPE;
  v_member public.members%ROWTYPE;
BEGIN
  SELECT * INTO v_file FROM public.investigation_files WHERE id = _file_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha não encontrada';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_file.chapter_id <> v_member.chapter_id THEN
    RAISE EXCEPTION 'Capítulo incompatível';
  END IF;

  IF NOT (
    public.can_manage_commission(v_file.chapter_id, 'sindicancias')
    OR public.has_any_role(
      v_file.chapter_id,
      ARRAY['mestre_conselheiro', 'admin_total', 'presidente_conselho']
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.members
  SET
    doc_rg_front_path = coalesce(doc_rg_front_path, v_file.doc_rg_front_path),
    doc_rg_back_path = coalesce(doc_rg_back_path, v_file.doc_rg_back_path),
    doc_cpf_front_path = coalesce(doc_cpf_front_path, v_file.doc_cpf_front_path),
    doc_cpf_back_path = coalesce(doc_cpf_back_path, v_file.doc_cpf_back_path)
  WHERE id = _member_id;

  UPDATE public.investigation_files
  SET
    doc_rg_front_path = NULL,
    doc_rg_back_path = NULL,
    doc_cpf_front_path = NULL,
    doc_cpf_back_path = NULL
  WHERE id = _file_id;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (
    v_file.chapter_id,
    auth.uid(),
    'docs_migrate',
    'investigation_files',
    _file_id,
    jsonb_build_object('member_id', _member_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_investigation_pii(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_id_document_path(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrate_investigation_docs_to_member(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reveal_investigation_pii(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_id_document_path(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.migrate_investigation_docs_to_member(uuid, uuid) TO authenticated, service_role;

-- 7) Signup público: exigir campos + docs + padrinho; espelhar referred_by
DROP FUNCTION IF EXISTS public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb,
  uuid, text, boolean, text, text, boolean, text, text, text
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

  -- Paths devem pertencer ao capítulo do token
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

REVOKE ALL ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb,
  uuid, text, boolean, text, text, boolean, text, text, text,
  text, text, text, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb,
  uuid, text, boolean, text, text, boolean, text, text, text,
  text, text, text, text, jsonb
) TO anon, authenticated, service_role;
