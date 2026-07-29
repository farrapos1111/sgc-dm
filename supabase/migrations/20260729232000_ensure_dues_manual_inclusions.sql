-- Garante a tabela de inclusões manuais (idempotente; corrige schema cache se a migration anterior não rodou)
CREATE TABLE IF NOT EXISTS public.member_dues_manual_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year integer NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, member_id, year)
);

CREATE INDEX IF NOT EXISTS member_dues_manual_inclusions_chapter_year_idx
  ON public.member_dues_manual_inclusions (chapter_id, year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_dues_manual_inclusions TO authenticated;
GRANT ALL ON public.member_dues_manual_inclusions TO service_role;

ALTER TABLE public.member_dues_manual_inclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dues_manual_inc_select ON public.member_dues_manual_inclusions;
CREATE POLICY dues_manual_inc_select ON public.member_dues_manual_inclusions
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

DROP POLICY IF EXISTS dues_manual_inc_write ON public.member_dues_manual_inclusions;
CREATE POLICY dues_manual_inc_write ON public.member_dues_manual_inclusions
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria'))
  WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));

NOTIFY pgrst, 'reload schema';
