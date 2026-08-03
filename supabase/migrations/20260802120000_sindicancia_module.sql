-- Módulo Sindicâncias: fichas expandidas, evento de calendário, detalhes, token público, seed comissão.

-- 1) Enum calendário
ALTER TYPE public.calendar_event_type ADD VALUE IF NOT EXISTS 'sindicancia';

-- 2) Colunas extras em investigation_files
ALTER TABLE public.investigation_files
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cpf_last2 text,
  ADD COLUMN IF NOT EXISTS rg_last2 text,
  ADD COLUMN IF NOT EXISTS celular text,
  ADD COLUMN IF NOT EXISTS address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS guardians jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sponsor_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sponsor_text text,
  ADD COLUMN IF NOT EXISTS has_demolay_relative boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demolay_relative_name text,
  ADD COLUMN IF NOT EXISTS demolay_relative_chapter text,
  ADD COLUMN IF NOT EXISTS has_mason_relative boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mason_relative_name text,
  ADD COLUMN IF NOT EXISTS mason_relative_lodge text,
  ADD COLUMN IF NOT EXISTS opinion text,
  ADD COLUMN IF NOT EXISTS signup_source text NOT NULL DEFAULT 'interno';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'investigation_files_signup_source_check'
  ) THEN
    ALTER TABLE public.investigation_files
      ADD CONSTRAINT investigation_files_signup_source_check
      CHECK (signup_source IN ('interno', 'publico'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS investigation_files_sponsor_member_idx
  ON public.investigation_files (sponsor_member_id)
  WHERE sponsor_member_id IS NOT NULL;

-- 3) Detalhes de sindicância (1:1 com calendar_events)
CREATE TABLE IF NOT EXISTS public.sindicancia_details (
  calendar_event_id uuid PRIMARY KEY REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.investigation_files(id) ON DELETE SET NULL,
  nominee_name text NOT NULL DEFAULT '',
  senior_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  senior_text text,
  investigator_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  investigator_text text,
  sponsor_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  sponsor_text text,
  opinion text,
  status public.investigation_status NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sindicancia_details_chapter_idx
  ON public.sindicancia_details (chapter_id);
CREATE INDEX IF NOT EXISTS sindicancia_details_file_idx
  ON public.sindicancia_details (file_id)
  WHERE file_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sindicancia_details TO authenticated;
GRANT ALL ON public.sindicancia_details TO service_role;
ALTER TABLE public.sindicancia_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sindicancia_details_select ON public.sindicancia_details;
CREATE POLICY sindicancia_details_select ON public.sindicancia_details
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS sindicancia_details_write ON public.sindicancia_details;
CREATE POLICY sindicancia_details_write ON public.sindicancia_details
  FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'sindicancias'))
  WITH CHECK (public.can_manage_commission(chapter_id, 'sindicancias'));

DROP TRIGGER IF EXISTS sindicancia_details_updated_at ON public.sindicancia_details;
CREATE TRIGGER sindicancia_details_updated_at
  BEFORE UPDATE ON public.sindicancia_details
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Seed comissão sindicancias no catálogo global + capítulos existentes sem ela
INSERT INTO public.commissions (code, label, sort_order, chapter_id)
VALUES ('sindicancias', 'Sindicâncias', 7, NULL)
ON CONFLICT (code) WHERE (chapter_id IS NULL)
DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

INSERT INTO public.commissions (code, label, sort_order, chapter_id)
SELECT 'sindicancias', 'Sindicâncias', 7, c.id
FROM public.chapters c
WHERE NOT EXISTS (
  SELECT 1 FROM public.commissions x
  WHERE x.chapter_id = c.id AND x.code = 'sindicancias'
);

SELECT setval(
  'public.commissions_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.commissions), 1), 1)
);

-- 5) Token público de inscrição em ficha
CREATE OR REPLACE FUNCTION public.can_manage_investigation_signup(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(_chapter_id, 'admin')
      OR public.is_commission_president(_chapter_id, 'sindicancias')
      OR EXISTS (
        SELECT 1 FROM public.chapter_members cm
        JOIN public.roles r ON r.id = cm.role_id
        WHERE cm.chapter_id = _chapter_id
          AND cm.user_id = auth.uid()
          AND cm.active = true
          AND r.name = 'mestre_conselheiro'
      );
$$;

CREATE OR REPLACE FUNCTION public.ensure_investigation_signup_token(
  _chapter_id uuid,
  _rotate boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.can_manage_investigation_signup(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT nullif(settings->>'investigation_signup_token', '') INTO v_token
  FROM public.chapters WHERE id = _chapter_id;

  IF v_token IS NULL OR _rotate THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.chapters
    SET settings = coalesce(settings, '{}'::jsonb)
      || jsonb_build_object('investigation_signup_token', v_token)
    WHERE id = _chapter_id;
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_investigation_signup_token(_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_investigation_signup(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.chapters
  SET settings = coalesce(settings, '{}'::jsonb) - 'investigation_signup_token'
  WHERE id = _chapter_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_investigation_signup_token(_chapter_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.can_manage_investigation_signup(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT nullif(settings->>'investigation_signup_token', '') INTO v_token
  FROM public.chapters WHERE id = _chapter_id;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_investigation_signup_chapter(_token text)
RETURNS TABLE (
  id uuid,
  name text,
  number text,
  city text,
  primary_color text,
  logo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := nullif(trim(_token), '');
BEGIN
  IF v_token IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.id, c.name, c.number, c.city, c.primary_color, c.logo_url
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = v_token
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_investigation_signup(
  _token text,
  _candidate_name text,
  _candidate_birth_date date DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _rg text DEFAULT NULL,
  _candidate_email text DEFAULT NULL,
  _candidate_phone text DEFAULT NULL,
  _celular text DEFAULT NULL,
  _address jsonb DEFAULT '{}'::jsonb,
  _guardians jsonb DEFAULT '[]'::jsonb,
  _sponsor_member_id uuid DEFAULT NULL,
  _sponsor_text text DEFAULT NULL,
  _has_demolay_relative boolean DEFAULT false,
  _demolay_relative_name text DEFAULT NULL,
  _demolay_relative_chapter text DEFAULT NULL,
  _has_mason_relative boolean DEFAULT false,
  _mason_relative_name text DEFAULT NULL,
  _mason_relative_lodge text DEFAULT NULL,
  _notes text DEFAULT NULL
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
BEGIN
  IF nullif(trim(_candidate_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do candidato';
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;

  IF v_chapter IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  INSERT INTO public.investigation_files (
    chapter_id, candidate_name, candidate_birth_date,
    cpf, rg, cpf_last2, rg_last2,
    candidate_email, candidate_phone, celular,
    address, guardians,
    sponsor_member_id, sponsor_text,
    has_demolay_relative, demolay_relative_name, demolay_relative_chapter,
    has_mason_relative, mason_relative_name, mason_relative_lodge,
    notes, status, signup_source
  ) VALUES (
    v_chapter,
    trim(_candidate_name),
    _candidate_birth_date,
    v_cpf,
    v_rg,
    CASE WHEN v_cpf IS NOT NULL AND length(v_cpf) >= 2 THEN right(v_cpf, 2) ELSE NULL END,
    CASE WHEN v_rg IS NOT NULL AND length(v_rg) >= 2 THEN right(v_rg, 2) ELSE NULL END,
    nullif(trim(coalesce(_candidate_email, '')), ''),
    nullif(trim(coalesce(_candidate_phone, '')), ''),
    nullif(trim(coalesce(_celular, '')), ''),
    coalesce(_address, '{}'::jsonb),
    coalesce(_guardians, '[]'::jsonb),
    _sponsor_member_id,
    nullif(trim(coalesce(_sponsor_text, '')), ''),
    coalesce(_has_demolay_relative, false),
    nullif(trim(coalesce(_demolay_relative_name, '')), ''),
    nullif(trim(coalesce(_demolay_relative_chapter, '')), ''),
    coalesce(_has_mason_relative, false),
    nullif(trim(coalesce(_mason_relative_name, '')), ''),
    nullif(trim(coalesce(_mason_relative_lodge, '')), ''),
    nullif(trim(coalesce(_notes, '')), ''),
    'aberta',
    'publico'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Listar membros públicos (só id/nome) para autocomplete do padrinho no form
CREATE OR REPLACE FUNCTION public.list_investigation_signup_members(_token text)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
BEGIN
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
  ORDER BY m.full_name;
END;
$$;

CREATE INDEX IF NOT EXISTS chapters_settings_investigation_signup_token_idx
  ON public.chapters ((settings->>'investigation_signup_token'));

REVOKE ALL ON FUNCTION public.can_manage_investigation_signup(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_investigation_signup_token(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_investigation_signup_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_investigation_signup_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_investigation_signup_chapter(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb,
  uuid, text, boolean, text, text, boolean, text, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_investigation_signup_members(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_investigation_signup(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_investigation_signup_token(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_investigation_signup_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_investigation_signup_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_investigation_signup_chapter(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_investigation_signup(
  text, text, date, text, text, text, text, text, jsonb, jsonb,
  uuid, text, boolean, text, text, boolean, text, text, text
) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_investigation_signup_members(text) TO anon, authenticated, service_role;
