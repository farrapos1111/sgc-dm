-- Garante Administrador Total em todos os capítulos para quem tem access_all_chapters

CREATE OR REPLACE FUNCTION public.sync_access_all_chapters_memberships(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id integer;
  v_inserted integer := 0;
  v_updated integer := 0;
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

  -- Uniformiza vínculos ativos existentes para Administrador Total
  UPDATE public.chapter_members cm
  SET role_id = v_role_id
  FROM public.profiles p
  WHERE p.id = cm.user_id
    AND p.access_all_chapters = true
    AND (_user_id IS NULL OR p.id = _user_id)
    AND cm.active = true
    AND cm.role_id IS DISTINCT FROM v_role_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_inserted + v_updated;
END;
$$;

-- Aplica agora (Usuário Duplo → admin_total em todos)
SELECT public.sync_access_all_chapters_memberships(NULL);
