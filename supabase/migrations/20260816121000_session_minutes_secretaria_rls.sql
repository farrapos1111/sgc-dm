-- Alinha INSERT/UPDATE/DELETE de session_minutes a has_permission('secretaria'),
-- cobrindo cargo ritualístico escrivao (não só role de sistema).

DROP POLICY IF EXISTS "minutes_write" ON public.session_minutes;
DROP POLICY IF EXISTS minutes_write ON public.session_minutes;

CREATE POLICY minutes_write ON public.session_minutes
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );
