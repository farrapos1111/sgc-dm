-- Logos de região no bucket chapter-logos (pasta regions/<region_id>/...)

CREATE OR REPLACE FUNCTION public.can_manage_region_logo(_region_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _region_id IS NOT NULL AND (
    public.is_active_region_office(_region_id, ARRAY['mcr', 'oe']::public.org_role[])
    OR public.is_gme((SELECT r.state_id FROM public.regions r WHERE r.id = _region_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_region_logo(_region_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _region_id IS NOT NULL AND (
    public.can_manage_region_logo(_region_id)
    OR EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.region_id = _region_id
        AND public.is_chapter_member(c.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.org_leaderships l
      WHERE l.user_id = auth.uid()
        AND l.active
        AND (
          l.region_id = _region_id
          OR l.state_id = (SELECT r.state_id FROM public.regions r WHERE r.id = _region_id)
        )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_region_logo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_region_logo(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_read_region_logo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_region_logo(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS region_logos_select ON storage.objects;
CREATE POLICY region_logos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] = 'regions'
    AND public.can_read_region_logo(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS region_logos_insert ON storage.objects;
CREATE POLICY region_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] = 'regions'
    AND public.can_manage_region_logo(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS region_logos_update ON storage.objects;
CREATE POLICY region_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] = 'regions'
    AND public.can_manage_region_logo(((storage.foldername(name))[2])::uuid)
  )
  WITH CHECK (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] = 'regions'
    AND public.can_manage_region_logo(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS region_logos_delete ON storage.objects;
CREATE POLICY region_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chapter-logos'
    AND (storage.foldername(name))[1] = 'regions'
    AND public.can_manage_region_logo(((storage.foldername(name))[2])::uuid)
  );
