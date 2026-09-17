-- Compartilhar ata: aceitar cargo ritualístico de Escrivão (e quem tem secretaria),
-- não só o role de conta 'escrivao'. Quem tem o cargo e role "membro" falhava antes.

CREATE OR REPLACE FUNCTION public.can_manage_minute_public_share(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND public.has_permission(_chapter_id, 'secretaria');
$$;
