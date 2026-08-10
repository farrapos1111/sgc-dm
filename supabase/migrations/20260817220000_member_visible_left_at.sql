-- Afiliação só conta se ativa e ainda não encerrada (left_at).

CREATE OR REPLACE FUNCTION public.member_visible_in_chapter(_member_id uuid, _chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id AND m.chapter_id = _chapter_id
  )
  OR EXISTS (
    SELECT 1 FROM public.member_chapter_affiliations a
    WHERE a.member_id = _member_id
      AND a.chapter_id = _chapter_id
      AND a.active
      AND a.left_at IS NULL
  );
$$;
