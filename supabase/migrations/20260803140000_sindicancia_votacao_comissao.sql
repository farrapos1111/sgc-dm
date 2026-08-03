-- Status "Votação Comissão" + votos da entrevista de sindicância.

ALTER TYPE public.investigation_status ADD VALUE IF NOT EXISTS 'votacao_comissao';

CREATE TABLE IF NOT EXISTS public.sindicancia_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id uuid NOT NULL
    REFERENCES public.sindicancia_details (calendar_event_id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('aprovada', 'reprovada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calendar_event_id, member_id)
);

CREATE INDEX IF NOT EXISTS sindicancia_votes_event_idx
  ON public.sindicancia_votes (calendar_event_id);
CREATE INDEX IF NOT EXISTS sindicancia_votes_chapter_idx
  ON public.sindicancia_votes (chapter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sindicancia_votes TO authenticated;
GRANT ALL ON public.sindicancia_votes TO service_role;

ALTER TABLE public.sindicancia_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sindicancia_votes_select ON public.sindicancia_votes;
CREATE POLICY sindicancia_votes_select ON public.sindicancia_votes
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

DROP POLICY IF EXISTS sindicancia_votes_write ON public.sindicancia_votes;
CREATE POLICY sindicancia_votes_write ON public.sindicancia_votes
  FOR ALL TO authenticated
  USING (public.is_chapter_member(chapter_id))
  WITH CHECK (public.is_chapter_member(chapter_id));

DROP TRIGGER IF EXISTS sindicancia_votes_updated_at ON public.sindicancia_votes;
CREATE TRIGGER sindicancia_votes_updated_at
  BEFORE UPDATE ON public.sindicancia_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
