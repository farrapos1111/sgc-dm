-- Evita erro de cast ::uuid em paths cujo 1º segmento não é UUID.

DROP POLICY IF EXISTS chapter_logos_select ON storage.objects;
CREATE POLICY chapter_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (
      public.is_chapter_member(((storage.foldername(name))[1])::uuid)
      OR public.can_manage_region_chapter(((storage.foldername(name))[1])::uuid)
      OR EXISTS (
        SELECT 1
        FROM public.chapters c
        JOIN public.org_leaderships l ON l.state_id = c.state_id
        WHERE c.id = ((storage.foldername(name))[1])::uuid
          AND l.user_id = auth.uid()
          AND l.active
          AND l.org_role = 'mce'::public.org_role
      )
    )
  );
