-- 1. STATES
CREATE TABLE public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  uf text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.states TO authenticated;
GRANT ALL ON public.states TO service_role;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;

-- 2. REGIONS
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id uuid NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- 3. CHAPTERS: escopo organizacional
ALTER TABLE public.chapters
  ADD COLUMN state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  ADD COLUMN region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  ADD COLUMN active boolean NOT NULL DEFAULT true;

-- 4. ORG LEADERSHIPS
CREATE TYPE public.org_role AS ENUM ('gme', 'mce', 'mcr', 'oe');

CREATE TABLE public.org_leaderships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_role public.org_role NOT NULL,
  state_id uuid REFERENCES public.states(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  term_year smallint,
  term_semester smallint,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_leaderships_scope_ck CHECK (
    (org_role IN ('gme','mce') AND state_id IS NOT NULL AND region_id IS NULL)
    OR (org_role IN ('mcr','oe') AND region_id IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_leaderships TO authenticated;
GRANT ALL ON public.org_leaderships TO service_role;
ALTER TABLE public.org_leaderships ENABLE ROW LEVEL SECURITY;

CREATE INDEX org_leaderships_user_idx ON public.org_leaderships(user_id) WHERE active;
CREATE INDEX chapters_region_idx ON public.chapters(region_id);
CREATE INDEX chapters_state_idx ON public.chapters(state_id);

CREATE TRIGGER states_updated_at BEFORE UPDATE ON public.states
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER regions_updated_at BEFORE UPDATE ON public.regions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER org_leaderships_updated_at BEFORE UPDATE ON public.org_leaderships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_state_leader(_chapter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapters c
    JOIN public.org_leaderships l ON l.state_id = c.state_id
    WHERE c.id = _chapter_id
      AND l.user_id = auth.uid()
      AND l.active = true
      AND l.org_role IN ('gme','mce')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_region_leader(_chapter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapters c
    JOIN public.org_leaderships l ON l.region_id = c.region_id
    WHERE c.id = _chapter_id
      AND l.user_id = auth.uid()
      AND l.active = true
      AND l.org_role IN ('mcr','oe')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_chapter(_chapter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_chapter_member(_chapter_id)
      OR public.is_state_leader(_chapter_id)
      OR public.is_region_leader(_chapter_id);
$$;

CREATE OR REPLACE FUNCTION public.is_gme(_state_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_leaderships l
    WHERE l.user_id = auth.uid()
      AND l.active = true
      AND l.org_role = 'gme'
      AND (_state_id IS NULL OR l.state_id = _state_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.my_org_state_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT s), '{}')
  FROM (
    SELECT l.state_id AS s FROM public.org_leaderships l
     WHERE l.user_id = auth.uid() AND l.active AND l.state_id IS NOT NULL
    UNION
    SELECT r.state_id FROM public.org_leaderships l
      JOIN public.regions r ON r.id = l.region_id
     WHERE l.user_id = auth.uid() AND l.active
  ) t WHERE s IS NOT NULL;
$$;

-- 6. RLS POLICIES for new tables
CREATE POLICY states_select ON public.states FOR SELECT TO authenticated
  USING (id = ANY(public.my_org_state_ids())
         OR EXISTS (SELECT 1 FROM public.chapters c WHERE c.state_id = states.id AND public.is_chapter_member(c.id)));

CREATE POLICY regions_select ON public.regions FOR SELECT TO authenticated
  USING (state_id = ANY(public.my_org_state_ids())
         OR EXISTS (SELECT 1 FROM public.chapters c WHERE c.region_id = regions.id AND public.is_chapter_member(c.id)));

CREATE POLICY regions_write ON public.regions FOR ALL TO authenticated
  USING (public.is_gme(state_id)) WITH CHECK (public.is_gme(state_id));

CREATE POLICY org_leaderships_select_own ON public.org_leaderships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY org_leaderships_select_gme ON public.org_leaderships FOR SELECT TO authenticated
  USING (public.is_gme(NULL));

CREATE POLICY org_leaderships_write_gme ON public.org_leaderships FOR ALL TO authenticated
  USING (public.is_gme(NULL)) WITH CHECK (public.is_gme(NULL));

-- 7. CHAPTERS policies: leitura para lideranças, escrita para GME
DROP POLICY IF EXISTS chapters_select_members ON public.chapters;
CREATE POLICY chapters_select ON public.chapters FOR SELECT TO authenticated
  USING (public.can_read_chapter(id) OR (state_id IS NOT NULL AND state_id = ANY(public.my_org_state_ids())));

CREATE POLICY chapters_insert_gme ON public.chapters FOR INSERT TO authenticated
  WITH CHECK (public.is_gme(state_id));

CREATE POLICY chapters_update_gme ON public.chapters FOR UPDATE TO authenticated
  USING (public.is_gme(state_id)) WITH CHECK (public.is_gme(state_id));

-- 8. Content tables: leitura ampliada para lideranças
DROP POLICY attendance_select ON public.attendance_records;
CREATE POLICY attendance_select ON public.attendance_records FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY calendar_events_select ON public.calendar_events;
CREATE POLICY calendar_events_select ON public.calendar_events FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY chapter_lodges_select ON public.chapter_lodges;
CREATE POLICY chapter_lodges_select ON public.chapter_lodges FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY chapter_members_select_shared ON public.chapter_members;
CREATE POLICY chapter_members_select_shared ON public.chapter_members FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY commission_members_select ON public.commission_members;
CREATE POLICY commission_members_select ON public.commission_members FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY events_select ON public.events;
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY member_positions_select ON public.member_positions;
CREATE POLICY member_positions_select ON public.member_positions FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY members_select ON public.members;
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY minutes_select ON public.session_minutes;
CREATE POLICY minutes_select ON public.session_minutes FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

DROP POLICY approvals_select ON public.minute_approvals;
CREATE POLICY approvals_select ON public.minute_approvals FOR SELECT TO authenticated USING (public.can_read_chapter(chapter_id));

-- 9. Dados de exemplo
INSERT INTO public.states (name, uf) VALUES ('Estado Exemplo', 'EX');

INSERT INTO public.regions (state_id, name, code)
SELECT s.id, 'Região Exemplo 1', 'R1' FROM public.states s WHERE s.uf = 'EX';
INSERT INTO public.regions (state_id, name, code)
SELECT s.id, 'Região Exemplo 2', 'R2' FROM public.states s WHERE s.uf = 'EX';

UPDATE public.chapters c
   SET state_id = (SELECT id FROM public.states WHERE uf = 'EX'),
       region_id = (SELECT id FROM public.regions WHERE code = 'R1' LIMIT 1)
 WHERE c.state_id IS NULL;

UPDATE public.chapters c
   SET region_id = (SELECT id FROM public.regions WHERE code = 'R2' LIMIT 1)
 WHERE c.number = '0001';