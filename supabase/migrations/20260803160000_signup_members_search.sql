-- Busca + só membros regulares em list_investigation_signup_members.

DROP FUNCTION IF EXISTS public.list_investigation_signup_members(text);

CREATE OR REPLACE FUNCTION public.list_investigation_signup_members(
  _token text,
  _search text DEFAULT ''
)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_q text := lower(trim(coalesce(_search, '')));
BEGIN
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_chapter
  FROM public.chapters c
  WHERE c.settings->>'investigation_signup_token' = nullif(trim(_token), '')
  LIMIT 1;
  IF v_chapter IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.full_name
  FROM public.members m
  WHERE m.chapter_id = v_chapter
    AND m.status = 'regular'
    AND lower(m.full_name) LIKE '%' || v_q || '%'
  ORDER BY m.full_name
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.list_investigation_signup_members(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_investigation_signup_members(text, text)
  TO anon, authenticated, service_role;
