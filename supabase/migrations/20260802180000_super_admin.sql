-- Super administrador de plataforma: cadastros de estados, regiões, capítulos e lideranças.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_super_admin IS
  'Acesso total aos cadastros organizacionais (estados, regiões, capítulos, lideranças).';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Leitura/escrita ampla para super admin
CREATE OR REPLACE FUNCTION public.can_read_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
      OR public.is_chapter_member(_chapter_id)
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
  IF public.is_super_admin() THEN
    RETURN COALESCE((SELECT array_agg(id) FROM public.states), '{}'::uuid[]);
  END IF;
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

-- Grants faltantes (GME/super admin precisam escrever capítulos e estados)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chapters TO authenticated;

DROP POLICY IF EXISTS states_select ON public.states;
CREATE POLICY states_select ON public.states FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR id = ANY(public.my_org_state_ids())
    OR EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.state_id = states.id AND public.is_chapter_member(c.id)
    )
  );

CREATE POLICY states_write_super ON public.states FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS regions_write ON public.regions;
CREATE POLICY regions_write ON public.regions FOR ALL TO authenticated
  USING (public.is_gme(state_id) OR public.is_super_admin())
  WITH CHECK (public.is_gme(state_id) OR public.is_super_admin());

DROP POLICY IF EXISTS chapters_insert_gme ON public.chapters;
CREATE POLICY chapters_insert_gme ON public.chapters FOR INSERT TO authenticated
  WITH CHECK (public.is_gme(state_id) OR public.is_super_admin());

DROP POLICY IF EXISTS chapters_update_gme ON public.chapters;
CREATE POLICY chapters_update_gme ON public.chapters FOR UPDATE TO authenticated
  USING (public.is_gme(state_id) OR public.is_super_admin())
  WITH CHECK (public.is_gme(state_id) OR public.is_super_admin());

DROP POLICY IF EXISTS org_leaderships_select_gme ON public.org_leaderships;
CREATE POLICY org_leaderships_select_gme ON public.org_leaderships FOR SELECT TO authenticated
  USING (public.is_gme(NULL) OR public.is_super_admin());

DROP POLICY IF EXISTS org_leaderships_write_gme ON public.org_leaderships;
CREATE POLICY org_leaderships_write_gme ON public.org_leaderships FOR ALL TO authenticated
  USING (public.is_gme(NULL) OR public.is_super_admin())
  WITH CHECK (public.is_gme(NULL) OR public.is_super_admin());

DROP POLICY IF EXISTS profiles_select_super ON public.profiles;
CREATE POLICY profiles_select_super ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin());
