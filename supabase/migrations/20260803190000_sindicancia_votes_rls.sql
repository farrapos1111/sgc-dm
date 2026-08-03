-- RLS de votos: comissão/liderança no SELECT; write só no próprio membro.

DROP POLICY IF EXISTS sindicancia_votes_select ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_write ON public.sindicancia_votes;

CREATE OR REPLACE FUNCTION public.can_read_sindicancia_votes(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_commission_member(_chapter_id, 'sindicancias')
      OR public.has_any_role(
        _chapter_id,
        ARRAY[
          'mestre_conselheiro',
          'admin_total',
          'presidente_conselho',
          'consultor'
        ]
      );
$$;

CREATE OR REPLACE FUNCTION public.auth_member_id_in_chapter(_chapter_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id
  FROM public.members m
  WHERE m.chapter_id = _chapter_id
    AND m.user_id = auth.uid()
  ORDER BY m.created_at NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.can_read_sindicancia_votes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_member_id_in_chapter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_sindicancia_votes(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_member_id_in_chapter(uuid)
  TO authenticated, service_role;

CREATE POLICY sindicancia_votes_select ON public.sindicancia_votes
  FOR SELECT TO authenticated
  USING (public.can_read_sindicancia_votes(chapter_id));

CREATE POLICY sindicancia_votes_insert ON public.sindicancia_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  );

CREATE POLICY sindicancia_votes_update ON public.sindicancia_votes
  FOR UPDATE TO authenticated
  USING (
    public.is_chapter_member(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  )
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  );

CREATE POLICY sindicancia_votes_delete ON public.sindicancia_votes
  FOR DELETE TO authenticated
  USING (
    public.is_chapter_member(chapter_id)
    AND member_id = public.auth_member_id_in_chapter(chapter_id)
  );

-- Totais agregados sem expor votos individuais
CREATE OR REPLACE FUNCTION public.sindicancia_vote_totals(_calendar_event_id uuid)
RETURNS TABLE (aprovada integer, reprovada integer, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
BEGIN
  SELECT d.chapter_id INTO v_chapter
  FROM public.sindicancia_details d
  WHERE d.calendar_event_id = _calendar_event_id;

  IF v_chapter IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_read_sindicancia_votes(v_chapter) THEN
    RAISE EXCEPTION 'Sem permissão para ver a votação' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE v.vote = 'aprovada')::integer,
    count(*) FILTER (WHERE v.vote = 'reprovada')::integer,
    count(*)::integer
  FROM public.sindicancia_votes v
  WHERE v.calendar_event_id = _calendar_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sindicancia_vote_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sindicancia_vote_totals(uuid)
  TO authenticated, service_role;
