-- Datas / prazos obrigatórios definidos por liderança regional ou estadual.

CREATE TABLE IF NOT EXISTS public.org_mandatory_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('region', 'state')),
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  state_id uuid REFERENCES public.states(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  prazo_kind text NOT NULL CHECK (prazo_kind IN ('until_day', 'within_month', 'until_month', 'date_range')),
  due_date date,
  due_year integer,
  due_month integer CHECK (due_month IS NULL OR (due_month >= 1 AND due_month <= 12)),
  due_day integer CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  start_month integer CHECK (start_month IS NULL OR (start_month >= 1 AND start_month <= 12)),
  start_day integer CHECK (start_day IS NULL OR (start_day >= 1 AND start_day <= 31)),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_mandatory_dates_scope_ck CHECK (
    (scope = 'region' AND region_id IS NOT NULL AND state_id IS NULL)
    OR (scope = 'state' AND state_id IS NOT NULL AND region_id IS NULL)
  ),
  CONSTRAINT org_mandatory_dates_fields_ck CHECK (
    (
      prazo_kind = 'until_day'
      AND due_month IS NOT NULL
      AND due_day IS NOT NULL
      AND start_month IS NULL
      AND start_day IS NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
    OR (
      prazo_kind IN ('within_month', 'until_month')
      AND due_month IS NOT NULL
      AND due_day IS NULL
      AND start_month IS NULL
      AND start_day IS NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
    OR (
      prazo_kind = 'date_range'
      AND start_month IS NOT NULL
      AND start_day IS NOT NULL
      AND due_month IS NOT NULL
      AND due_day IS NOT NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS org_mandatory_dates_region_idx
  ON public.org_mandatory_dates (region_id)
  WHERE region_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_mandatory_dates_state_idx
  ON public.org_mandatory_dates (state_id)
  WHERE state_id IS NOT NULL;

DROP TRIGGER IF EXISTS org_mandatory_dates_updated_at ON public.org_mandatory_dates;
CREATE TRIGGER org_mandatory_dates_updated_at
  BEFORE UPDATE ON public.org_mandatory_dates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_mandatory_dates TO authenticated;
GRANT ALL ON public.org_mandatory_dates TO service_role;
ALTER TABLE public.org_mandatory_dates ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_org_mandatory_dates(
  _scope text,
  _region_id uuid,
  _state_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _scope = 'state' AND _state_id IS NOT NULL THEN
      public.is_gme(_state_id)
    WHEN _scope = 'region' AND _region_id IS NOT NULL THEN
      public.can_write_chapter_in_scope(
        (SELECT r.state_id FROM public.regions r WHERE r.id = _region_id),
        _region_id
      )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_org_mandatory_dates(
  _scope text,
  _region_id uuid,
  _state_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.can_manage_org_mandatory_dates(_scope, _region_id, _state_id)
    OR EXISTS (
      SELECT 1
      FROM public.chapters c
      WHERE public.can_read_chapter(c.id)
        AND (
          (_scope = 'region' AND c.region_id = _region_id)
          OR (_scope = 'state' AND c.state_id = _state_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_org_mandatory_dates(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_mandatory_dates(text, uuid, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_read_org_mandatory_dates(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_org_mandatory_dates(text, uuid, uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS org_mandatory_dates_select ON public.org_mandatory_dates;
CREATE POLICY org_mandatory_dates_select ON public.org_mandatory_dates
  FOR SELECT TO authenticated
  USING (public.can_read_org_mandatory_dates(scope, region_id, state_id));

DROP POLICY IF EXISTS org_mandatory_dates_insert ON public.org_mandatory_dates;
CREATE POLICY org_mandatory_dates_insert ON public.org_mandatory_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_mandatory_dates(scope, region_id, state_id));

DROP POLICY IF EXISTS org_mandatory_dates_update ON public.org_mandatory_dates;
CREATE POLICY org_mandatory_dates_update ON public.org_mandatory_dates
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_mandatory_dates(scope, region_id, state_id))
  WITH CHECK (public.can_manage_org_mandatory_dates(scope, region_id, state_id));

DROP POLICY IF EXISTS org_mandatory_dates_delete ON public.org_mandatory_dates;
CREATE POLICY org_mandatory_dates_delete ON public.org_mandatory_dates
  FOR DELETE TO authenticated
  USING (public.can_manage_org_mandatory_dates(scope, region_id, state_id));
