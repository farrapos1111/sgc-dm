CREATE TABLE public.chapter_lodges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_lodges TO authenticated;
GRANT ALL ON public.chapter_lodges TO service_role;

ALTER TABLE public.chapter_lodges ENABLE ROW LEVEL SECURITY;

CREATE POLICY chapter_lodges_select ON public.chapter_lodges
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

CREATE POLICY chapter_lodges_write ON public.chapter_lodges
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']));

CREATE INDEX chapter_lodges_chapter_idx ON public.chapter_lodges(chapter_id);

CREATE TRIGGER chapter_lodges_set_updated_at
  BEFORE UPDATE ON public.chapter_lodges
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.calendar_events
  ADD COLUMN address text,
  ADD COLUMN lodge_id uuid REFERENCES public.chapter_lodges(id) ON DELETE SET NULL;