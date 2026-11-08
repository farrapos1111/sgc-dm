-- =========================================================
-- Console do Templo (console.templovirtual.app) — base
-- - platform_admins: quem administra a plataforma (Lucas, Pedro).
--   Só muda via SQL/service_role; nenhuma tela grava aqui.
-- - is_console_admin(): admin de plataforma COM 2FA (aal2) na sessão.
-- - platform_audit_log: toda ação feita no Console.
-- - org_join_requests: etapas do funil, responsável, notas, vínculo
--   com a instituição criada.
-- - can_manage_region_chapter(): console admin passa a gerir qualquer
--   instituição (reaproveita as RPCs de cadastro já existentes).
-- Nada é apagado.
-- =========================================================

-- ---------- 1) platform_admins ----------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_admins IS
  'Administradores da plataforma (Console). Alterar só via SQL/service_role.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_admins TO service_role;

-- Seed: contas existentes dos dois admins (ignora se ainda não existirem).
INSERT INTO public.platform_admins (user_id, label)
SELECT u.id, split_part(u.email, '@', 1)
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) IN ('lucasboeiraborges@gmail.com', 'pedro.bossle.s@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins a
    WHERE a.user_id = auth.uid() AND a.active
  );
$$;

-- Admin de plataforma com sessão verificada em 2 etapas.
CREATE OR REPLACE FUNCTION public.is_console_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_console_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_console_admin() TO authenticated, service_role;

-- ---------- 2) Auditoria ----------
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_log_created_idx
  ON public.platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_log_target_idx
  ON public.platform_audit_log (target_type, target_id);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;

-- ---------- 3) Funil de pedidos ----------
ALTER TABLE public.org_join_requests
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_chapter_id uuid REFERENCES public.chapters (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_join_requests_stage_ck'
  ) THEN
    ALTER TABLE public.org_join_requests
      ADD CONSTRAINT org_join_requests_stage_ck
      CHECK (stage IN ('novo', 'em_contato', 'aprovado', 'recusado'));
  END IF;
END $$;

-- Pedidos já arquivados entram como recusados no funil.
UPDATE public.org_join_requests
SET stage = 'recusado'
WHERE status = 'archived' AND stage = 'novo';

CREATE INDEX IF NOT EXISTS org_join_requests_stage_idx
  ON public.org_join_requests (stage, created_at DESC);

CREATE TABLE IF NOT EXISTS public.org_join_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.org_join_requests (id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'stage', 'system')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_join_request_notes_request_idx
  ON public.org_join_request_notes (request_id, created_at);

ALTER TABLE public.org_join_request_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_join_request_notes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_join_request_notes TO service_role;

-- ---------- 4) Console gere qualquer instituição ----------
-- Mesma definição de 20260810160000_mcr_oe_region_access + is_console_admin().
CREATE OR REPLACE FUNCTION public.can_manage_region_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_console_admin()
    OR EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = _chapter_id
        AND (
          public.is_gme(c.state_id)
          OR (
            c.region_id IS NOT NULL
            AND public.is_active_region_office(c.region_id, ARRAY['mcr', 'oe']::public.org_role[])
          )
        )
    );
$$;

-- ---------- 5) Pedidos: só o Console lê/gerencia ----------
-- Antes: qualquer admin_total de qualquer instituição lia todos os pedidos.
DROP POLICY IF EXISTS org_join_requests_admin_total_select ON public.org_join_requests;
CREATE POLICY org_join_requests_admin_total_select
  ON public.org_join_requests
  FOR SELECT
  TO authenticated
  USING (public.is_console_admin());

DROP POLICY IF EXISTS org_join_requests_admin_total_update ON public.org_join_requests;
CREATE POLICY org_join_requests_admin_total_update
  ON public.org_join_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

-- Guard de UPDATE (20260821141000) com duas mudanças:
-- - service_role (server functions do Console, já checadas) pode mudar
--   status/arquivamento e as colunas do funil; formulário segue imutável;
-- - usuário autenticado precisa ser console admin (não mais admin_total).
CREATE OR REPLACE FUNCTION public.tg_org_join_requests_admin_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  form_changed boolean;
  inbox_changed boolean;
  email_changed boolean;
BEGIN
  form_changed :=
    NEW.org_type IS DISTINCT FROM OLD.org_type
    OR NEW.org_type_other IS DISTINCT FROM OLD.org_type_other
    OR NEW.name_number IS DISTINCT FROM OLD.name_number
    OR NEW.full_address IS DISTINCT FROM OLD.full_address
    OR NEW.founded_on IS DISTINCT FROM OLD.founded_on
    OR NEW.active_members_band IS DISTINCT FROM OLD.active_members_band
    OR NEW.sponsoring_lodge IS DISTINCT FROM OLD.sponsoring_lodge
    OR NEW.responsible_name IS DISTINCT FROM OLD.responsible_name
    OR NEW.responsible_phone IS DISTINCT FROM OLD.responsible_phone
    OR NEW.responsible_email IS DISTINCT FROM OLD.responsible_email
    OR NEW.responsible_role IS DISTINCT FROM OLD.responsible_role
    OR NEW.potencia_id IS DISTINCT FROM OLD.potencia_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at;

  inbox_changed :=
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
    OR NEW.archived_by IS DISTINCT FROM OLD.archived_by;

  email_changed :=
    NEW.email_status IS DISTINCT FROM OLD.email_status
    OR NEW.email_error IS DISTINCT FROM OLD.email_error;

  IF form_changed THEN
    RAISE EXCEPTION 'Campos do formulário são imutáveis' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    IF inbox_changed AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Campos da inbox são imutáveis sem autenticação'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.is_console_admin() THEN
      RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
    END IF;
    IF email_changed THEN
      RAISE EXCEPTION 'Campos do e-mail são imutáveis' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status NOT IN ('open', 'archived') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  IF NEW.status = 'archived' AND OLD.status = 'open' THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
    NEW.archived_by := coalesce(NEW.archived_by, auth.uid(), NEW.decided_by);
  ELSIF NEW.status = 'open' AND OLD.status = 'archived' THEN
    NEW.archived_at := NULL;
    NEW.archived_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;
