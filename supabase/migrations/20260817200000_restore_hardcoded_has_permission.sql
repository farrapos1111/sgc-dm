-- Restaura has_permission por role + cargos do termo (Capítulo DeMolay),
-- sem depender de platform_has_screen_action.
-- Tabelas/funções platform_access_* permanecem intactas (escopo reservado).

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
           ARRAY['mestre_conselheiro','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'secretaria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','escrivao','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'tesouraria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','tesoureiro'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','tesoureiro','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'comissoes' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_comissao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','escrivao','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'conselho' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','consultor','presidente_conselho'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','presidente_conselho_consultivo','conselheiro_consultor']
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
             'mestre_conselheiro','escrivao','tesoureiro',
             'presidente_conselho_consultivo','conselheiro_consultor',
             'primeiro_conselheiro','segundo_conselheiro'
           ]
         )
    ELSE public.is_chapter_member(_chapter_id)
  END;
$$;
