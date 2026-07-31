-- Cartões de Proficiência (carteirinha CR80) emitidos pelo Mestre Conselheiro

CREATE TABLE IF NOT EXISTS public.proficiency_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  issued_by uuid NOT NULL REFERENCES public.profiles(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id),

  registro_scdb text,
  photo_url text,
  prof_iniciatico date,
  prof_demolay date,
  valid_until date,
  member_signature_url text,
  consultor_signature_url text,
  qr_url text,
  verification_code text NOT NULL,
  note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT proficiency_cards_verification_code_key UNIQUE (verification_code)
);

-- Uma carteirinha ativa por membro no capítulo
CREATE UNIQUE INDEX IF NOT EXISTS proficiency_cards_one_active_per_member
  ON public.proficiency_cards (chapter_id, member_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS proficiency_cards_chapter_idx
  ON public.proficiency_cards (chapter_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS proficiency_cards_member_idx
  ON public.proficiency_cards (member_id);

-- Soft-link: usuário titular do cadastro de membro (e-mail ou nome do perfil)
CREATE OR REPLACE FUNCTION public.is_linked_member(_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = _member_id
      AND (
        (
          m.email IS NOT NULL
          AND length(trim(m.email)) > 0
          AND lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        OR lower(m.full_name) = lower(
          coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '###')
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_linked_member(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.proficiency_cards TO authenticated;
GRANT ALL ON public.proficiency_cards TO service_role;
ALTER TABLE public.proficiency_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proficiency_cards_select ON public.proficiency_cards;
CREATE POLICY proficiency_cards_select ON public.proficiency_cards
  FOR SELECT TO authenticated
  USING (
    public.can_read_chapter(chapter_id)
    OR public.is_linked_member(member_id)
  );

DROP POLICY IF EXISTS proficiency_cards_insert ON public.proficiency_cards;
CREATE POLICY proficiency_cards_insert ON public.proficiency_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(chapter_id, ARRAY['mestre_conselheiro', 'admin_total'])
  );

DROP POLICY IF EXISTS proficiency_cards_update ON public.proficiency_cards;
CREATE POLICY proficiency_cards_update ON public.proficiency_cards
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(chapter_id, ARRAY['mestre_conselheiro', 'admin_total'])
  )
  WITH CHECK (
    public.has_any_role(chapter_id, ARRAY['mestre_conselheiro', 'admin_total'])
  );

DROP TRIGGER IF EXISTS proficiency_cards_updated_at ON public.proficiency_cards;
CREATE TRIGGER proficiency_cards_updated_at
  BEFORE UPDATE ON public.proficiency_cards
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
