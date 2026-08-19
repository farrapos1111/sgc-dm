-- Alinha escrita de cargos, lojas e configurações a has_permission.
-- Políticas antigas usavam has_any_role (só role de sistema), então MC/VM/escrivão
-- pelo cargo do termo (ex.: loja_veneravel_mestre) falhavam no RLS.

DROP POLICY IF EXISTS member_positions_write ON public.member_positions;
CREATE POLICY member_positions_write ON public.member_positions
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

DROP POLICY IF EXISTS commission_members_write ON public.commission_members;
CREATE POLICY commission_members_write ON public.commission_members
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'comissoes')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'comissoes')
    OR public.has_permission(chapter_id, 'admin')
  );

DROP POLICY IF EXISTS chapter_lodges_write ON public.chapter_lodges;
CREATE POLICY chapter_lodges_write ON public.chapter_lodges
  FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

DROP POLICY IF EXISTS chapters_update_admins ON public.chapters;
CREATE POLICY chapters_update_admins ON public.chapters
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(id, 'secretaria')
    OR public.has_permission(id, 'admin')
  )
  WITH CHECK (
    public.has_permission(id, 'secretaria')
    OR public.has_permission(id, 'admin')
  );

DROP POLICY IF EXISTS calendar_events_update ON public.calendar_events;
CREATE POLICY calendar_events_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );

DROP POLICY IF EXISTS chapter_logos_insert ON storage.objects;
CREATE POLICY chapter_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'secretaria')
      OR public.has_permission(((storage.foldername(name))[1])::uuid, 'admin')
    )
  );

DROP POLICY IF EXISTS chapter_logos_update ON storage.objects;
CREATE POLICY chapter_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'secretaria')
      OR public.has_permission(((storage.foldername(name))[1])::uuid, 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'secretaria')
      OR public.has_permission(((storage.foldername(name))[1])::uuid, 'admin')
    )
  );

DROP POLICY IF EXISTS chapter_logos_delete ON storage.objects;
CREATE POLICY chapter_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'secretaria')
      OR public.has_permission(((storage.foldername(name))[1])::uuid, 'admin')
    )
  );
