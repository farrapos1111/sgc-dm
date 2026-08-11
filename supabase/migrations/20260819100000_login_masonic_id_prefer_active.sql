-- Login por ID também considera masonic_id (Loja) e prefere quem tem
-- chapter_members ativo. Sem isso, o ID maçônico 123456 caía no cadastro
-- DeMolay homônimo com vínculo inativo e a conta ficava sem instituição.

CREATE OR REPLACE FUNCTION public.find_member_auth_by_demolay_id(_demolay_id text)
RETURNS TABLE(user_id uuid, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := nullif(public.normalize_demolay_id(_demolay_id), '');
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.status::text
  FROM public.members m
  WHERE m.user_id IS NOT NULL
    AND (
      (
        m.demolay_id IS NOT NULL
        AND public.normalize_demolay_id(m.demolay_id) = v_id
      )
      OR (
        m.masonic_id IS NOT NULL
        AND public.normalize_demolay_id(m.masonic_id) = v_id
      )
    )
  ORDER BY
    EXISTS (
      SELECT 1
      FROM public.chapter_members cm
      WHERE cm.user_id = m.user_id
        AND cm.active IS TRUE
    ) DESC,
    (m.status = 'regular') DESC,
    m.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_member_auth_by_demolay_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_member_auth_by_demolay_id(text) TO service_role;

-- Ficha vinculada sem nenhum chapter_members ativo: reativa o vínculo da loja/capítulo da ficha.
UPDATE public.chapter_members cm
SET active = true
FROM public.members m
WHERE cm.user_id = m.user_id
  AND cm.chapter_id = m.chapter_id
  AND m.user_id IS NOT NULL
  AND cm.active IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.chapter_members x
    WHERE x.user_id = cm.user_id
      AND x.active IS TRUE
  );
