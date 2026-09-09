-- Conselho Consultivo: papel "conselho" em todas as comissões do Capítulo DeMolay.
-- Membros: presidente_conselho_consultivo / conselheiro_consultor (cargos)
--          ou account roles consultor / presidente_conselho.

ALTER TYPE public.commission_role ADD VALUE IF NOT EXISTS 'conselho';

CREATE OR REPLACE FUNCTION public.is_advisory_council_member(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_chapter_member(_chapter_id)
    AND EXISTS (
      SELECT 1
      FROM public.chapters ch
      WHERE ch.id = _chapter_id
        AND ch.org_type = 'capitulo'
    )
    AND (
      public.has_any_role(
        _chapter_id,
        ARRAY['consultor', 'presidente_conselho']
      )
      OR EXISTS (
        SELECT 1
        FROM public.member_positions mp
        JOIN public.positions p ON p.id = mp.position_id
        WHERE mp.chapter_id = _chapter_id
          AND mp.term_year = public.current_term_year()
          AND mp.term_semester = public.current_term_semester()
          AND p.code = ANY (
            ARRAY[
              'presidente_conselho_consultivo',
              'conselheiro_consultor'
            ]
          )
          AND public.is_linked_member(mp.member_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_advisory_council_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_advisory_council_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_commission_member(
  _chapter_id uuid,
  _commission_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_advisory_council_member(_chapter_id)
    OR EXISTS (
      SELECT 1
      FROM public.commission_members cm
      JOIN public.commissions c ON c.id = cm.commission_id
      WHERE cm.chapter_id = _chapter_id
        AND c.code = _commission_code
        AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
        AND cm.term_year = public.current_term_year()
        AND cm.term_semester = public.current_term_semester()
        AND public.is_chapter_member(_chapter_id)
        AND public.is_linked_member(cm.member_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_commission_role(
  _chapter_id uuid,
  _commission_code text,
  _roles text[] DEFAULT ARRAY[
    'presidente',
    'vice',
    'membro',
    'auxiliar_senior',
    'conselho'
  ]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      'conselho' = ANY (_roles)
      AND public.is_advisory_council_member(_chapter_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.commission_members cm
      JOIN public.commissions c ON c.id = cm.commission_id
      WHERE cm.chapter_id = _chapter_id
        AND cm.term_year = public.current_term_year()
        AND cm.term_semester = public.current_term_semester()
        AND c.code = _commission_code
        AND cm.role::text = ANY (_roles)
        AND public.is_chapter_member(_chapter_id)
        AND public.is_linked_member(cm.member_id)
    );
$$;
