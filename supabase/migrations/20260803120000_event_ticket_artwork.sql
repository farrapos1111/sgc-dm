-- Arte de fundo do ingresso (estilo Sympla) por evento
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_artwork_url text;

-- Bucket privado para artes de ingresso
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-artwork',
  'event-artwork',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Path: {chapter_id}/{event_id}/...
CREATE POLICY "event_artwork_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-artwork'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "event_artwork_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-artwork'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "event_artwork_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'event-artwork'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'event-artwork'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "event_artwork_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'event-artwork'
    AND public.is_chapter_member(((storage.foldername(name))[1])::uuid)
  );
