-- Usuário com acesso a todos os capítulos (ex.: conta de teste "Usuário Duplo")

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_all_chapters boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.access_all_chapters IS
  'Quando true, o usuário recebe vínculo ativo em todos os capítulos (e nos novos).';

-- Conta de teste conhecida
UPDATE public.profiles p
SET access_all_chapters = true
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'usuario.duplo@sgcdm.test';

CREATE OR REPLACE FUNCTION public.sync_access_all_chapters_memberships(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id integer;
  v_inserted integer := 0;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'admin_total' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role admin_total não encontrada';
  END IF;

  INSERT INTO public.chapter_members (user_id, chapter_id, role_id, active)
  SELECT p.id, c.id, v_role_id, true
  FROM public.profiles p
  CROSS JOIN public.chapters c
  WHERE p.access_all_chapters = true
    AND (_user_id IS NULL OR p.id = _user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.chapter_members cm
      WHERE cm.user_id = p.id
        AND cm.chapter_id = c.id
        AND cm.active = true
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_access_all_chapters_memberships(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_access_all_chapters_memberships(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_chapters_grant_access_all()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id integer;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'admin_total' LIMIT 1;
  IF v_role_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chapter_members (user_id, chapter_id, role_id, active)
  SELECT p.id, NEW.id, v_role_id, true
  FROM public.profiles p
  WHERE p.access_all_chapters = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.chapter_members cm
      WHERE cm.user_id = p.id
        AND cm.chapter_id = NEW.id
        AND cm.active = true
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_chapters_grant_access_all ON public.chapters;
CREATE TRIGGER tg_chapters_grant_access_all
  AFTER INSERT ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chapters_grant_access_all();

-- Sincroniza vínculos faltantes agora
SELECT public.sync_access_all_chapters_memberships(NULL);
