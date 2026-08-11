-- Venerável Mestre (Loja) = poder pleno da instituição, equivalente ao MC.

CREATE OR REPLACE FUNCTION public.has_permission(_chapter_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _perm
    WHEN 'admin' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre',
             'presidente_conselho_consultivo','conselheiro_consultor'
           ]
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'secretaria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre','escrivao',
             'presidente_conselho_consultivo','conselheiro_consultor'
           ]
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'tesouraria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','tesoureiro'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre','tesoureiro',
             'presidente_conselho_consultivo','conselheiro_consultor'
           ]
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'comissoes' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_comissao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre','escrivao',
             'presidente_conselho_consultivo','conselheiro_consultor'
           ]
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'conselho' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','consultor','presidente_conselho'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre',
             'presidente_conselho_consultivo','conselheiro_consultor'
           ]
         )
    WHEN 'visualizar' THEN
      public.is_chapter_member(_chapter_id)
      OR public.has_current_position(
           _chapter_id,
           ARRAY['primeiro_conselheiro','segundo_conselheiro']
         )
    WHEN 'visualizar_total' THEN
      public.has_any_role(_chapter_id, ARRAY[
        'admin_total','mestre_conselheiro','escrivao','tesoureiro',
        'consultor','presidente_conselho','presidente_comissao'
      ])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','loja_veneravel_mestre','escrivao','tesoureiro',
             'presidente_conselho_consultivo','conselheiro_consultor',
             'primeiro_conselheiro','segundo_conselheiro'
           ]
         )
    ELSE public.is_chapter_member(_chapter_id)
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event_destructive(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_any_role(_chapter_id, ARRAY['admin_total', 'mestre_conselheiro'])
    OR public.has_current_position(
         _chapter_id,
         ARRAY['mestre_conselheiro', 'loja_veneravel_mestre']
       )
    OR public.has_commission_role(_chapter_id, 'eventos', ARRAY['presidente']);
$$;
