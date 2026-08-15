-- Alinha INSERT/UPDATE/DELETE de attendance_records a has_permission('secretaria'),
-- cobrindo cargo ritualístico (escrivao, MC, VM) — não só role de sistema.
-- A política antiga usava has_any_role(...), então quem escrevia ata pela
-- posição do termo falhava ao marcar presença (chamada da sessão).

DROP POLICY IF EXISTS "attendance_write" ON public.attendance_records;
DROP POLICY IF EXISTS attendance_write ON public.attendance_records;

CREATE POLICY attendance_write ON public.attendance_records
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );
