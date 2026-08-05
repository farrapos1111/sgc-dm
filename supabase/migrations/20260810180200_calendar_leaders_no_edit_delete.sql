-- Lideranças regionais/estaduais veem e podem criar no calendário unificado,
-- mas não editam/excluem eventos dos capítulos (só oficiais do capítulo).

DROP POLICY IF EXISTS calendar_events_update ON public.calendar_events;
CREATE POLICY calendar_events_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(
      chapter_id,
      ARRAY['mestre_conselheiro', 'escrivao', 'admin_total']
    )
  )
  WITH CHECK (
    public.has_any_role(
      chapter_id,
      ARRAY['mestre_conselheiro', 'escrivao', 'admin_total']
    )
  );

DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(
      chapter_id,
      ARRAY['mestre_conselheiro', 'escrivao', 'admin_total']
    )
  );
