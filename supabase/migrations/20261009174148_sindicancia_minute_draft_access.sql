-- Rascunhos de ata de sindicância: visíveis à comissão;
-- editáveis pelo escrivão da ata e pelo gestor da comissão.

CREATE OR REPLACE FUNCTION public.is_sindicancia_ata_clerk(
  _chapter_id uuid,
  _calendar_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sindicancia_details d
    WHERE d.chapter_id = _chapter_id
      AND d.calendar_event_id = _calendar_event_id
      AND d.clerk_member_id IS NOT NULL
      AND public.is_linked_member(d.clerk_member_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_sindicancia_minute(
  _chapter_id uuid,
  _calendar_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can_manage_commission(_chapter_id, 'sindicancias')
      OR public.is_sindicancia_ata_clerk(_chapter_id, _calendar_event_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_sindicancia_minute(
  _chapter_id uuid,
  _calendar_event_id uuid,
  _completed_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    -- Ata concluída: leitura do capítulo (como antes).
    (_completed_at IS NOT NULL AND public.can_read_chapter(_chapter_id))
    -- Rascunho: comissão + gestores + escrivão da ata.
    OR (
      _completed_at IS NULL
      AND (
        public.is_commission_member(_chapter_id, 'sindicancias')
        OR public.can_manage_commission(_chapter_id, 'sindicancias')
        OR public.is_sindicancia_ata_clerk(_chapter_id, _calendar_event_id)
      )
    )
    -- Concluída também segue disponível à comissão / escrivão.
    OR public.is_commission_member(_chapter_id, 'sindicancias')
    OR public.can_manage_commission(_chapter_id, 'sindicancias')
    OR public.is_sindicancia_ata_clerk(_chapter_id, _calendar_event_id);
$$;

REVOKE ALL ON FUNCTION public.is_sindicancia_ata_clerk(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_sindicancia_minute(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_sindicancia_minute(uuid, uuid, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_sindicancia_ata_clerk(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_sindicancia_minute(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_sindicancia_minute(uuid, uuid, timestamptz)
  TO authenticated, service_role;

DROP POLICY IF EXISTS sindicancia_minutes_select ON public.sindicancia_minutes;
CREATE POLICY sindicancia_minutes_select ON public.sindicancia_minutes
  FOR SELECT TO authenticated
  USING (
    public.can_view_sindicancia_minute(chapter_id, calendar_event_id, completed_at)
  );

DROP POLICY IF EXISTS sindicancia_minutes_write ON public.sindicancia_minutes;
CREATE POLICY sindicancia_minutes_insert ON public.sindicancia_minutes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_sindicancia_minute(chapter_id, calendar_event_id)
  );

CREATE POLICY sindicancia_minutes_update ON public.sindicancia_minutes
  FOR UPDATE TO authenticated
  USING (
    public.can_edit_sindicancia_minute(chapter_id, calendar_event_id)
  )
  WITH CHECK (
    public.can_edit_sindicancia_minute(chapter_id, calendar_event_id)
  );

CREATE POLICY sindicancia_minutes_delete ON public.sindicancia_minutes
  FOR DELETE TO authenticated
  USING (
    public.can_manage_commission(chapter_id, 'sindicancias')
  );
