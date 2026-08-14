-- Inbox de solicitações de organização para admin_total (sem depender de e-mail).

-- ----------------------------------------------------------------------------
-- 1. Colunas de workflow (open | archived)
-- ----------------------------------------------------------------------------

ALTER TABLE public.org_join_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_join_requests_status_ck'
  ) THEN
    ALTER TABLE public.org_join_requests
      ADD CONSTRAINT org_join_requests_status_ck
      CHECK (status IN ('open', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_join_requests_status_created_idx
  ON public.org_join_requests (status, created_at DESC);

COMMENT ON COLUMN public.org_join_requests.status IS
  'Inbox: open = pendente de atenção; archived = arquivada pelo admin total.';

-- ----------------------------------------------------------------------------
-- 2. Helper: usuário atual é admin_total em algum capítulo
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_total()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapter_members cm
    JOIN public.roles r ON r.id = cm.role_id
    WHERE cm.user_id = auth.uid()
      AND cm.active IS TRUE
      AND r.name = 'admin_total'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_total() TO authenticated;

COMMENT ON FUNCTION public.is_admin_total() IS
  'True se o auth.uid() tem membership ativo com role admin_total.';

-- ----------------------------------------------------------------------------
-- 3. RLS: admin_total lê e arquiva; insert continua só via RPC
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS org_join_requests_admin_total_select ON public.org_join_requests;
CREATE POLICY org_join_requests_admin_total_select
  ON public.org_join_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin_total());

DROP POLICY IF EXISTS org_join_requests_admin_total_update ON public.org_join_requests;
CREATE POLICY org_join_requests_admin_total_update
  ON public.org_join_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_total())
  WITH CHECK (public.is_admin_total());

-- Bloqueia alteração de campos do formulário; só status/arquivo.
CREATE OR REPLACE FUNCTION public.tg_org_join_requests_admin_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_admin_total() THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  IF NEW.org_type IS DISTINCT FROM OLD.org_type
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
    OR NEW.email_status IS DISTINCT FROM OLD.email_status
    OR NEW.email_error IS DISTINCT FROM OLD.email_error
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Campos do formulário são imutáveis'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('open', 'archived') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  IF NEW.status = 'archived' AND OLD.status = 'open' THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
    NEW.archived_by := coalesce(NEW.archived_by, auth.uid());
  ELSIF NEW.status = 'open' AND OLD.status = 'archived' THEN
    NEW.archived_at := NULL;
    NEW.archived_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_join_requests_admin_update_guard
  ON public.org_join_requests;
CREATE TRIGGER trg_org_join_requests_admin_update_guard
  BEFORE UPDATE ON public.org_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_org_join_requests_admin_update_guard();

-- ----------------------------------------------------------------------------
-- 4. Realtime (balão live)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      IF to_regclass('public.org_join_requests') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.org_join_requests;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime não existe; pulando ADD TABLE.';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.org_join_requests REPLICA IDENTITY FULL;
