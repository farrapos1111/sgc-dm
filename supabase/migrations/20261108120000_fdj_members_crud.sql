-- =========================================================
-- Bethel (FDJ): cadastro de fichas em fdj_members.
-- - Campos de Bethel: iniciação, responsável (menores), observações,
--   consentimento LGPD e auditoria mínima (created_by).
-- - RPCs SECURITY DEFINER: criar, editar, ver CPF/RG, excluir.
-- - Permissão: mesma regra do ODM (secretaria/admin do Bethel ou
--   gestão regional), via can_manage_fdj_members().
-- members (ODM) continua intocado.
-- =========================================================

-- ---------- 1) Colunas ----------
ALTER TABLE public.fdj_members
  ADD COLUMN IF NOT EXISTS initiation_date date,
  ADD COLUMN IF NOT EXISTS guardian jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS consent_text_version text,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_signed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.fdj_members.guardian IS
  'Responsável legal (menores): {full_name, relationship, phone, email}.';

-- ID FDJ único quando informado (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS fdj_members_fdj_id_unique
  ON public.fdj_members (lower(trim(fdj_id)))
  WHERE fdj_id IS NOT NULL AND trim(fdj_id) <> '';

-- ---------- 2) Permissão ----------
CREATE OR REPLACE FUNCTION public.can_manage_fdj_members(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = _chapter_id AND c.realm = 'fdj'
    )
    AND (
      public.can_manage_region_chapter(_chapter_id)
      OR (
        public.is_chapter_member(_chapter_id)
        AND (
          public.has_permission(_chapter_id, 'secretaria')
          OR public.has_permission(_chapter_id, 'admin')
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_fdj_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fdj_members(uuid) TO authenticated, service_role;

-- ---------- 3) Criar ----------
CREATE OR REPLACE FUNCTION public.create_fdj_member(
  _chapter_id uuid,
  _full_name text,
  _birth_date date DEFAULT NULL,
  _fdj_id text DEFAULT NULL,
  _status text DEFAULT 'regular',
  _initiation_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _rg text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address jsonb DEFAULT '{}'::jsonb,
  _guardian jsonb DEFAULT NULL,
  _notes text DEFAULT NULL,
  _consent_text_version text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_person uuid;
  v_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_rg text := regexp_replace(coalesce(_rg, ''), '\D', '', 'g');
  v_fdj text := nullif(trim(coalesce(_fdj_id, '')), '');
  v_consent text := nullif(trim(coalesce(_consent_text_version, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _chapter_id IS NULL OR nullif(trim(coalesce(_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes';
  END IF;
  IF NOT public.can_manage_fdj_members(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar membros neste Bethel' USING ERRCODE = '42501';
  END IF;
  IF coalesce(_status, 'regular') NOT IN ('regular', 'irregular') THEN
    RAISE EXCEPTION 'Situação inválida';
  END IF;

  INSERT INTO public.people (cpf_encrypted, cpf_last2)
  VALUES (
    CASE WHEN length(v_cpf) > 0 THEN public.encrypt_pii(v_cpf) END,
    CASE WHEN length(v_cpf) >= 2 THEN right(v_cpf, 2) END
  )
  RETURNING id INTO v_person;

  BEGIN
    INSERT INTO public.fdj_members (
      chapter_id, person_id, full_name, birth_date, fdj_id, status,
      initiation_date,
      cpf_encrypted, cpf_last2, rg_encrypted, rg_last2,
      phone, email, address, guardian, notes,
      consent_text_version, consent_signed_at, consent_signed_by,
      created_by
    ) VALUES (
      _chapter_id, v_person, trim(_full_name), _birth_date, v_fdj,
      coalesce(_status, 'regular'),
      _initiation_date,
      CASE WHEN length(v_cpf) > 0 THEN public.encrypt_pii(v_cpf) END,
      CASE WHEN length(v_cpf) >= 2 THEN right(v_cpf, 2) END,
      CASE WHEN length(v_rg) > 0 THEN public.encrypt_pii(v_rg) END,
      CASE WHEN length(v_rg) >= 2 THEN right(v_rg, 2) END,
      nullif(trim(coalesce(_phone, '')), ''),
      nullif(trim(coalesce(_email, '')), ''),
      coalesce(_address, '{}'::jsonb),
      CASE
        WHEN _guardian IS NOT NULL AND length(trim(coalesce(_guardian->>'full_name', ''))) > 0
        THEN _guardian
      END,
      nullif(trim(coalesce(_notes, '')), ''),
      v_consent,
      CASE WHEN v_consent IS NOT NULL THEN now() END,
      CASE WHEN v_consent IS NOT NULL THEN auth.uid() END,
      auth.uid()
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'ID FDJ já cadastrado em outra ficha';
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_fdj_member(
  uuid, text, date, text, text, date, text, text, text, text, jsonb, jsonb, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_fdj_member(
  uuid, text, date, text, text, date, text, text, text, text, jsonb, jsonb, text, text
) TO authenticated;

-- ---------- 4) Editar ----------
-- _cpf/_rg NULL = mantém; '' = apaga; valor = substitui.
CREATE OR REPLACE FUNCTION public.update_fdj_member(
  _id uuid,
  _full_name text,
  _birth_date date DEFAULT NULL,
  _fdj_id text DEFAULT NULL,
  _status text DEFAULT 'regular',
  _initiation_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _rg text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address jsonb DEFAULT '{}'::jsonb,
  _guardian jsonb DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.fdj_members%ROWTYPE;
  v_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_rg text := regexp_replace(coalesce(_rg, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_row FROM public.fdj_members WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha não encontrada';
  END IF;
  IF NOT public.can_manage_fdj_members(v_row.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para editar esta ficha' USING ERRCODE = '42501';
  END IF;
  IF nullif(trim(coalesce(_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;
  IF coalesce(_status, 'regular') NOT IN ('regular', 'irregular') THEN
    RAISE EXCEPTION 'Situação inválida';
  END IF;

  BEGIN
    UPDATE public.fdj_members SET
      full_name = trim(_full_name),
      birth_date = _birth_date,
      fdj_id = nullif(trim(coalesce(_fdj_id, '')), ''),
      status = coalesce(_status, 'regular'),
      initiation_date = _initiation_date,
      cpf_encrypted = CASE
        WHEN _cpf IS NULL THEN cpf_encrypted
        WHEN length(v_cpf) > 0 THEN public.encrypt_pii(v_cpf)
      END,
      cpf_last2 = CASE
        WHEN _cpf IS NULL THEN cpf_last2
        WHEN length(v_cpf) >= 2 THEN right(v_cpf, 2)
      END,
      rg_encrypted = CASE
        WHEN _rg IS NULL THEN rg_encrypted
        WHEN length(v_rg) > 0 THEN public.encrypt_pii(v_rg)
      END,
      rg_last2 = CASE
        WHEN _rg IS NULL THEN rg_last2
        WHEN length(v_rg) >= 2 THEN right(v_rg, 2)
      END,
      phone = nullif(trim(coalesce(_phone, '')), ''),
      email = nullif(trim(coalesce(_email, '')), ''),
      address = coalesce(_address, '{}'::jsonb),
      guardian = CASE
        WHEN _guardian IS NOT NULL AND length(trim(coalesce(_guardian->>'full_name', ''))) > 0
        THEN _guardian
      END,
      notes = nullif(trim(coalesce(_notes, '')), '')
    WHERE id = _id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'ID FDJ já cadastrado em outra ficha';
  END;

  IF _cpf IS NOT NULL THEN
    UPDATE public.people SET
      cpf_encrypted = CASE WHEN length(v_cpf) > 0 THEN public.encrypt_pii(v_cpf) END,
      cpf_last2 = CASE WHEN length(v_cpf) >= 2 THEN right(v_cpf, 2) END
    WHERE id = v_row.person_id AND user_id IS NULL;
  END IF;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_fdj_member(
  uuid, text, date, text, text, date, text, text, text, text, jsonb, jsonb, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_fdj_member(
  uuid, text, date, text, text, date, text, text, text, text, jsonb, jsonb, text
) TO authenticated;

-- ---------- 5) Ver CPF/RG ----------
CREATE OR REPLACE FUNCTION public.get_fdj_member_pii(_id uuid)
RETURNS TABLE (cpf text, rg text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.fdj_members%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.fdj_members WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha não encontrada';
  END IF;
  IF NOT (v_row.user_id = auth.uid() OR public.can_manage_fdj_members(v_row.chapter_id)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT public.decrypt_pii(v_row.cpf_encrypted), public.decrypt_pii(v_row.rg_encrypted);
END;
$$;

REVOKE ALL ON FUNCTION public.get_fdj_member_pii(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fdj_member_pii(uuid) TO authenticated;

-- ---------- 6) Excluir (fichas criadas por engano) ----------
CREATE OR REPLACE FUNCTION public.delete_fdj_member(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.fdj_members%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.fdj_members WHERE id = _id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF NOT public.can_manage_fdj_members(v_row.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta ficha' USING ERRCODE = '42501';
  END IF;
  IF v_row.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ficha vinculada a uma conta; marque como irregular em vez de excluir';
  END IF;

  DELETE FROM public.fdj_members WHERE id = _id;
  -- people sem conta e sem outras fichas: remove junto
  DELETE FROM public.people p
  WHERE p.id = v_row.person_id
    AND p.user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.fdj_members f WHERE f.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.loja_members l WHERE l.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.person_id = p.id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_fdj_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_fdj_member(uuid) TO authenticated;

-- ---------- 7) Leitura: colunas cifradas não saem pelo PostgREST ----------
REVOKE SELECT ON public.fdj_members FROM authenticated;
GRANT SELECT (
  id, chapter_id, person_id, user_id, full_name, birth_date, fdj_id, status,
  cpf_last2, rg_last2, phone, email, address,
  initiation_date, guardian, notes,
  consent_text_version, consent_signed_at, consent_signed_by,
  created_by, created_at, updated_at
) ON public.fdj_members TO authenticated;
