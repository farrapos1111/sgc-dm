-- DELETE próprio + INSERT/UPDATE exigem afiliação visível no capítulo.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_office_signatures TO authenticated;

DROP POLICY IF EXISTS mos_delete_own ON public.member_office_signatures;
CREATE POLICY mos_delete_own ON public.member_office_signatures
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mos_insert_own ON public.member_office_signatures;
CREATE POLICY mos_insert_own ON public.member_office_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
    AND public.member_visible_in_chapter(member_id, chapter_id)
    AND length(trim(signature_data_url)) > 0
  );

DROP POLICY IF EXISTS mos_update_own ON public.member_office_signatures;
CREATE POLICY mos_update_own ON public.member_office_signatures
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = member_id AND m.user_id = auth.uid()
    )
    AND public.member_visible_in_chapter(member_id, chapter_id)
    AND length(trim(signature_data_url)) > 0
  );
