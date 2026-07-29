-- Separa status (regular/irregular) do tipo/kind (demolay_ativo/senior/macom)
-- Migração de dados:
--   ativo|senior|macom → status regular; inativo → irregular
--   ativo → demolay_ativo; senior → senior; macom → macom; inativo → demolay_ativo

CREATE TYPE public.member_kind AS ENUM ('demolay_ativo', 'senior', 'macom');
CREATE TYPE public.member_status_v2 AS ENUM ('regular', 'irregular');

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS kind public.member_kind;

UPDATE public.members
SET kind = CASE status::text
  WHEN 'senior' THEN 'senior'::public.member_kind
  WHEN 'macom' THEN 'macom'::public.member_kind
  ELSE 'demolay_ativo'::public.member_kind
END
WHERE kind IS NULL;

ALTER TABLE public.members
  ALTER COLUMN kind SET DEFAULT 'demolay_ativo'::public.member_kind,
  ALTER COLUMN kind SET NOT NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS status_v2 public.member_status_v2;

UPDATE public.members
SET status_v2 = CASE
  WHEN status::text IN ('ativo', 'senior', 'macom') THEN 'regular'::public.member_status_v2
  ELSE 'irregular'::public.member_status_v2
END
WHERE status_v2 IS NULL;

-- Remove todas as overloads que dependem do enum antigo
DO $drop$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_member_with_pii', 'update_member_with_pii', 'recalc_member_status')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END
$drop$;

ALTER TABLE public.members DROP COLUMN status;
ALTER TABLE public.members RENAME COLUMN status_v2 TO status;
ALTER TABLE public.members
  ALTER COLUMN status SET DEFAULT 'regular'::public.member_status_v2,
  ALTER COLUMN status SET NOT NULL;

DROP TYPE public.member_status;
ALTER TYPE public.member_status_v2 RENAME TO member_status;

CREATE OR REPLACE FUNCTION public.create_member_with_pii(
  _chapter_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status, _kind member_kind,
  _guardian jsonb, _consent_text_version text,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date,
  _demolay_id text DEFAULT NULL, _masonic_id text DEFAULT NULL)
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
    phone, email, address, status, kind, created_by,
    exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay,
    demolay_id, masonic_id
  ) VALUES (
    _chapter_id, _full_name, _birth_date,
    CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) END,
    CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) END,
    CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) END,
    CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) END,
    _phone, _email, coalesce(_address, '{}'::jsonb),
    coalesce(_status, 'regular'), coalesce(_kind, 'demolay_ativo'), auth.uid(),
    _exam_grau_iniciatico, _exam_grau_demolay, _iniciacao_ordem, _iniciacao_grau_demolay,
    nullif(trim(coalesce(_demolay_id, '')), ''),
    nullif(trim(coalesce(_masonic_id, '')), '')
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
  _email text, _address jsonb, _status member_status, _kind member_kind,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _guardians jsonb DEFAULT NULL::jsonb,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date,
  _demolay_id text DEFAULT NULL, _masonic_id text DEFAULT NULL)
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
    kind = coalesce(_kind, v_member.kind),
    exam_grau_iniciatico = _exam_grau_iniciatico,
    exam_grau_demolay = _exam_grau_demolay,
    iniciacao_ordem = _iniciacao_ordem,
    iniciacao_grau_demolay = _iniciacao_grau_demolay,
    demolay_id = nullif(trim(coalesce(_demolay_id, '')), ''),
    masonic_id = nullif(trim(coalesce(_masonic_id, '')), ''),
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
          jsonb_build_object('full_name', _full_name, 'status', _status, 'kind', _kind));

  RETURN _member_id;
END;
$function$;

-- Aos 21 anos, Demolay Ativo passa a Senior DeMolay (tipo), sem mudar status
CREATE OR REPLACE FUNCTION public.recalc_member_status(_chapter_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.members
     SET kind = 'senior'
   WHERE kind = 'demolay_ativo'
     AND birth_date IS NOT NULL
     AND birth_date <= (current_date - interval '21 years')
     AND (_chapter_id IS NULL OR chapter_id = _chapter_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  jsonb, text, date, date, date, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  jsonb, text, date, date, date, date, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  date, date, jsonb, date, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  date, date, jsonb, date, date, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.recalc_member_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_member_status(uuid) TO authenticated, service_role;
