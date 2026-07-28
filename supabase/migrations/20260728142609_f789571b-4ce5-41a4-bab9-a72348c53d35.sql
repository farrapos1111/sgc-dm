-- Lideranças que podem gerir agenda supra-capitular
CREATE OR REPLACE FUNCTION public.can_lead_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_state_leader(_chapter_id) OR public.is_region_leader(_chapter_id);
$$;

-- ===== Leitura ampliada para lideranças =====
DROP POLICY IF EXISTS cash_select ON public.cash_entries;
CREATE POLICY cash_select ON public.cash_entries FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS dues_select ON public.member_dues;
CREATE POLICY dues_select ON public.member_dues FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS hosp_duty_select ON public.hospitality_duties;
CREATE POLICY hosp_duty_select ON public.hospitality_duties FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS hosp_menu_select ON public.hospitality_menus;
CREATE POLICY hosp_menu_select ON public.hospitality_menus FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS inv_files_select ON public.investigation_files;
CREATE POLICY inv_files_select ON public.investigation_files FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS inv_proc_select ON public.investigation_processes;
CREATE POLICY inv_proc_select ON public.investigation_processes FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS templates_select ON public.minute_templates;
CREATE POLICY templates_select ON public.minute_templates FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS guardians_select ON public.guardians;
CREATE POLICY guardians_select ON public.guardians FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = guardians.member_id AND public.can_read_chapter(m.chapter_id)
  ));

DROP POLICY IF EXISTS lgpd_consents_select ON public.lgpd_consents;
CREATE POLICY lgpd_consents_select ON public.lgpd_consents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = lgpd_consents.member_id AND public.can_read_chapter(m.chapter_id)
  ));

-- Eventos e derivados: escrita segue restrita a membros (policies "*_all"),
-- adiciona-se apenas leitura para lideranças.
CREATE POLICY events_select_leaders ON public.events FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

CREATE POLICY ticket_types_select_leaders ON public.ticket_types FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND public.can_read_chapter(e.chapter_id)));

CREATE POLICY tickets_select_leaders ON public.tickets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND public.can_read_chapter(e.chapter_id)));

CREATE POLICY event_tables_select_leaders ON public.event_tables FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tables.event_id AND public.can_read_chapter(e.chapter_id)));

CREATE POLICY seats_select_leaders ON public.seats FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_tables t
    JOIN public.events e ON e.id = t.event_id
    WHERE t.id = seats.table_id AND public.can_read_chapter(e.chapter_id)
  ));

CREATE POLICY checkins_select_leaders ON public.checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = checkins.event_id AND public.can_read_chapter(e.chapter_id)));

-- ===== Lideranças podem criar/editar atividades no calendário =====
DROP POLICY IF EXISTS calendar_events_insert ON public.calendar_events;
CREATE POLICY calendar_events_insert ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.is_chapter_member(chapter_id) OR public.can_lead_chapter(chapter_id));

DROP POLICY IF EXISTS calendar_events_update ON public.calendar_events;
CREATE POLICY calendar_events_update ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total'])
         OR public.can_lead_chapter(chapter_id))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total'])
         OR public.can_lead_chapter(chapter_id));

DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events FOR DELETE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total'])
         OR public.can_lead_chapter(chapter_id));