-- Tesouraria também pode registrar períodos de afastamento (inclusão manual de irregulares)
DROP POLICY IF EXISTS member_away_write ON public.member_away_periods;
CREATE POLICY member_away_write ON public.member_away_periods
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'tesouraria')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'tesouraria')
  );
