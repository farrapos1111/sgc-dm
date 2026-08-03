-- Helper seguro para UUID do capítulo no path do Storage + policies.

CREATE OR REPLACE FUNCTION public.storage_chapter_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_seg text;
  v_uuid uuid;
BEGIN
  v_seg := (storage.foldername(object_name))[1];
  IF v_seg IS NULL OR v_seg !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;
  v_uuid := v_seg::uuid;
  RETURN v_uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_chapter_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_chapter_uuid(text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS member_documents_select ON storage.objects;
CREATE POLICY member_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_reveal_id_documents(public.storage_chapter_uuid(name))
  );

DROP POLICY IF EXISTS member_documents_insert ON storage.objects;
CREATE POLICY member_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND (
      public.can_manage_commission(public.storage_chapter_uuid(name), 'sindicancias')
      OR public.has_any_role(
        public.storage_chapter_uuid(name),
        ARRAY['mestre_conselheiro', 'admin_total', 'presidente_conselho']
      )
    )
  );

DROP POLICY IF EXISTS member_documents_update ON storage.objects;
CREATE POLICY member_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_manage_commission(public.storage_chapter_uuid(name), 'sindicancias')
  )
  WITH CHECK (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_manage_commission(public.storage_chapter_uuid(name), 'sindicancias')
  );

DROP POLICY IF EXISTS member_documents_delete ON storage.objects;
CREATE POLICY member_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-documents'
    AND public.storage_chapter_uuid(name) IS NOT NULL
    AND public.can_manage_commission(public.storage_chapter_uuid(name), 'sindicancias')
  );
