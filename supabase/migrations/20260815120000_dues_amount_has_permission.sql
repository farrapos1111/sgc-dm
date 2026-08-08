-- Mensalidade padrão: permitir role ou cargo com permissão tesouraria
-- (antes só has_role de admin_total / mestre_conselheiro / tesoureiro).

CREATE OR REPLACE FUNCTION public.save_default_dues_amount(
  _chapter_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_chapter_member(_chapter_id) THEN
    RAISE EXCEPTION 'Sem acesso ao capítulo' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_permission(_chapter_id, 'tesouraria') THEN
    RAISE EXCEPTION 'Sem permissão para alterar mensalidade padrão'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.chapters
  SET settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object('default_dues_amount', _amount)
  WHERE id = _chapter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.member_dues
  SET amount = _amount
  WHERE chapter_id = _chapter_id
    AND status = 'em_aberto'
    AND competence_year >= extract(year from current_date)::integer;

  RETURN _amount;
END;
$function$;
