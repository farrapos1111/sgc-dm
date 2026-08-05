-- Remove super admin: coluna, função, trigger e ORs em RLS/helpers

DROP TRIGGER IF EXISTS profiles_protect_super_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.tg_protect_super_admin();

CREATE OR REPLACE FUNCTION public.can_read_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_chapter_member(_chapter_id)
      OR public.is_state_leader(_chapter_id)
      OR public.is_region_leader(_chapter_id);
$$;

CREATE OR REPLACE FUNCTION public.my_org_state_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT array_agg(DISTINCT s)
    FROM (
      SELECT l.state_id AS s FROM public.org_leaderships l
       WHERE l.user_id = auth.uid() AND l.active AND l.state_id IS NOT NULL
      UNION
      SELECT r.state_id FROM public.org_leaderships l
        JOIN public.regions r ON r.id = l.region_id
       WHERE l.user_id = auth.uid() AND l.active
    ) t
    WHERE s IS NOT NULL
  ), '{}'::uuid[]);
END;
$$;

DROP POLICY IF EXISTS states_select ON public.states;
CREATE POLICY states_select ON public.states FOR SELECT TO authenticated
  USING (
    id = ANY(public.my_org_state_ids())
    OR EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.state_id = states.id AND public.is_chapter_member(c.id)
    )
  );

DROP POLICY IF EXISTS states_write_super ON public.states;

DROP POLICY IF EXISTS regions_write ON public.regions;
CREATE POLICY regions_write ON public.regions FOR ALL TO authenticated
  USING (public.is_gme(state_id))
  WITH CHECK (public.is_gme(state_id));

DROP POLICY IF EXISTS chapters_insert_gme ON public.chapters;
CREATE POLICY chapters_insert_gme ON public.chapters FOR INSERT TO authenticated
  WITH CHECK (public.is_gme(state_id));

DROP POLICY IF EXISTS chapters_update_gme ON public.chapters;
CREATE POLICY chapters_update_gme ON public.chapters FOR UPDATE TO authenticated
  USING (public.is_gme(state_id))
  WITH CHECK (public.is_gme(state_id));

DROP POLICY IF EXISTS org_leaderships_select_gme ON public.org_leaderships;
CREATE POLICY org_leaderships_select_gme ON public.org_leaderships FOR SELECT TO authenticated
  USING (public.is_gme(NULL));

DROP POLICY IF EXISTS org_leaderships_write_gme ON public.org_leaderships;
CREATE POLICY org_leaderships_write_gme ON public.org_leaderships FOR ALL TO authenticated
  USING (public.is_gme(NULL))
  WITH CHECK (public.is_gme(NULL));

DROP POLICY IF EXISTS profiles_select_super ON public.profiles;

DROP FUNCTION IF EXISTS public.is_super_admin();

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_super_admin;
