
-- ============ TABLES ============

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  number text NOT NULL,
  city text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  lgpd_officer_name text,
  lgpd_officer_contact text,
  primary_color text NOT NULL DEFAULT '#9E1B32',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.roles (
  id smallint PRIMARY KEY,
  name text NOT NULL UNIQUE,
  label text NOT NULL
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chapter_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES public.roles(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id, role_id)
);
CREATE INDEX chapter_members_user_idx ON public.chapter_members (user_id) WHERE active;
CREATE INDEX chapter_members_chapter_idx ON public.chapter_members (chapter_id) WHERE active;
GRANT SELECT ON public.chapter_members TO authenticated;
GRANT ALL ON public.chapter_members TO service_role;
ALTER TABLE public.chapter_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS (SECURITY DEFINER) ============

CREATE OR REPLACE FUNCTION public.is_chapter_member(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chapter_members
    WHERE chapter_id = _chapter_id
      AND user_id = auth.uid()
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_chapter_id uuid, _role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapter_members cm
    JOIN public.roles r ON r.id = cm.role_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.user_id = auth.uid()
      AND cm.active = true
      AND r.name = _role_name
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_chapter_with(_other_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapter_members a
    JOIN public.chapter_members b ON b.chapter_id = a.chapter_id
    WHERE a.user_id = auth.uid()
      AND b.user_id = _other_user
      AND a.active = true
      AND b.active = true
  );
$$;

-- ============ AUTO PROFILE ON SIGNUP ============

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- chapters: leitura só para membros ativos
CREATE POLICY "chapters_select_members" ON public.chapters
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(id));

-- profiles: próprio perfil (leitura + edição) e leitura de quem compartilha capítulo
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_shared_chapter" ON public.profiles
  FOR SELECT TO authenticated
  USING (id <> auth.uid() AND public.shares_chapter_with(id));

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- roles: tabela de referência, leitura livre para autenticados
CREATE POLICY "roles_select_all" ON public.roles
  FOR SELECT TO authenticated
  USING (true);

-- chapter_members: próprios vínculos + vínculos de membros do mesmo capítulo
CREATE POLICY "chapter_members_select_own" ON public.chapter_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "chapter_members_select_shared" ON public.chapter_members
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

-- audit_logs: leitura restrita a membros do capítulo
CREATE POLICY "audit_logs_select_members" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

-- ============ SEED: ROLES ============

INSERT INTO public.roles (id, name, label) VALUES
  (1, 'mestre_conselheiro',     'Mestre Conselheiro'),
  (2, 'tesoureiro',              'Tesoureiro'),
  (3, 'escrivao',                'Escrivão'),
  (4, 'presidente_comissao',     'Presidente de Comissão'),
  (5, 'membro',                  'Membro'),
  (6, 'conselho_consultivo',     'Conselho Consultivo'),
  (7, 'admin_regional',          'Admin Regional');

-- ============ SEED: CHAPTERS ============

INSERT INTO public.chapters (id, name, number, city, primary_color) VALUES
  ('00000000-0000-0000-0000-000000000000'::uuid, 'Capítulo Exemplo Nº 0000', '0000', 'Cidade Exemplo A', '#9E1B32'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Capítulo Exemplo Nº 0001', '0001', 'Cidade Exemplo B', '#9E1B32');
