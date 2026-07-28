DROP POLICY IF EXISTS member_positions_write ON public.member_positions;
CREATE POLICY member_positions_write ON public.member_positions
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','consultor','presidente_conselho']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','consultor','presidente_conselho']));

DROP POLICY IF EXISTS commission_members_write ON public.commission_members;
CREATE POLICY commission_members_write ON public.commission_members
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','consultor','presidente_conselho','presidente_comissao']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','consultor','presidente_conselho','presidente_comissao']));