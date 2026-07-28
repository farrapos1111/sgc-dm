CREATE POLICY "chapter_logos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "chapter_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND public.has_any_role(((storage.foldername(name))[1])::uuid, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor'])
  );

CREATE POLICY "chapter_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND public.has_any_role(((storage.foldername(name))[1])::uuid, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor'])
  )
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND public.has_any_role(((storage.foldername(name))[1])::uuid, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor'])
  );

CREATE POLICY "chapter_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND public.has_any_role(((storage.foldername(name))[1])::uuid, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor'])
  );