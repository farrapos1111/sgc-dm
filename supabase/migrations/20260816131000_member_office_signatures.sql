-- Assinaturas digitais obrigatórias por cargo ritualístico (pós-reset de senha)

CREATE TABLE IF NOT EXISTS public.member_office_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  signature_data_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, chapter_id, position_code)
);

CREATE INDEX IF NOT EXISTS member_office_signatures_chapter_idx
  ON public.member_office_signatures (chapter_id);

CREATE INDEX IF NOT EXISTS member_office_signatures_member_idx
  ON public.member_office_signatures (member_id);

DROP TRIGGER IF EXISTS member_office_signatures_set_updated_at ON public.member_office_signatures;
CREATE TRIGGER member_office_signatures_set_updated_at
  BEFORE UPDATE ON public.member_office_signatures
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.member_office_signatures TO authenticated;
GRANT ALL ON public.member_office_signatures TO service_role;
ALTER TABLE public.member_office_signatures ENABLE ROW LEVEL SECURITY;

-- Membro lê e grava a própria assinatura
DROP POLICY IF EXISTS mos_select_own ON public.member_office_signatures;
CREATE POLICY mos_select_own ON public.member_office_signatures
  FOR SELECT TO authenticated
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
    AND length(trim(signature_data_url)) > 0
  );

-- Secretaria / admin do capítulo podem ler assinaturas do capítulo
DROP POLICY IF EXISTS mos_select_secretaria ON public.member_office_signatures;
CREATE POLICY mos_select_secretaria ON public.member_office_signatures
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
  );
