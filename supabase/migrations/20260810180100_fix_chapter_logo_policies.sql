-- chapter_logos_* fazia cast de foldername[1]::uuid.
-- Paths regions/<uuid>/... avaliam "regions"::uuid e abortam o RLS
-- (erro em qualquer policy cancela o statement, mesmo com region_logos_* ok).

DROP POLICY IF EXISTS chapter_logos_select ON storage.objects;
CREATE POLICY chapter_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS chapter_logos_insert ON storage.objects;
CREATE POLICY chapter_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND public.has_any_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY[
        'admin_total',
        'mestre_conselheiro',
        'escrivao',
        'presidente_conselho',
        'consultor'
      ]
    )
  );

DROP POLICY IF EXISTS chapter_logos_update ON storage.objects;
CREATE POLICY chapter_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND public.has_any_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY[
        'admin_total',
        'mestre_conselheiro',
        'escrivao',
        'presidente_conselho',
        'consultor'
      ]
    )
  )
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND public.has_any_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY[
        'admin_total',
        'mestre_conselheiro',
        'escrivao',
        'presidente_conselho',
        'consultor'
      ]
    )
  );

DROP POLICY IF EXISTS chapter_logos_delete ON storage.objects;
CREATE POLICY chapter_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] <> 'regions'
    AND public.has_any_role(
      ((storage.foldername(name))[1])::uuid,
      ARRAY[
        'admin_total',
        'mestre_conselheiro',
        'escrivao',
        'presidente_conselho',
        'consultor'
      ]
    )
  );
