-- MCR/OE/GME podem gerar o link público (lobby) dos capítulos do escopo.

CREATE OR REPLACE FUNCTION public.can_manage_public_lobby(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (
      public.is_chapter_member(_chapter_id)
      AND (
        public.has_role(_chapter_id, 'admin_total')
        OR public.has_role(_chapter_id, 'mestre_conselheiro')
        OR public.has_role(_chapter_id, 'tesoureiro')
      )
    )
    OR public.can_manage_region_chapter(_chapter_id);
$function$;
