-- Corrige guard de UPDATE: service role pode gravar email_*; admin_total só status/arquivo.

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

  -- Sem JWT (service role / pipeline de e-mail): só email_status / email_error.
  IF auth.uid() IS NULL THEN
    IF form_changed OR inbox_changed THEN
      RAISE EXCEPTION 'Campos do formulário/inbox são imutáveis sem autenticação'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_admin_total() THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  -- Admin total: só status / arquivamento; formulário e e-mail imutáveis.
  IF form_changed OR email_changed THEN
    RAISE EXCEPTION 'Campos do formulário e do e-mail são imutáveis'
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
