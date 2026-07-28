
GRANT EXECUTE ON FUNCTION public.is_chapter_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_chapter_with(uuid) TO authenticated;
