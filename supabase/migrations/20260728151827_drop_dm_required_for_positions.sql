-- Remove exigência de exame de Grau DeMolay para cargos do capítulo.
-- Mantém a regra de 21+ apenas para cargos do Conselho Consultivo.
CREATE OR REPLACE FUNCTION public.tg_validate_member_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_scope text;
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = NEW.member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  IF v_member.chapter_id <> NEW.chapter_id THEN
    RAISE EXCEPTION 'Membro não pertence a este capítulo';
  END IF;
  IF NEW.term_semester NOT IN (1,2) THEN
    RAISE EXCEPTION 'Semestre deve ser 1 ou 2';
  END IF;
  SELECT scope INTO v_scope FROM public.positions WHERE id = NEW.position_id;
  IF v_scope = 'consultivo' THEN
    IF v_member.birth_date IS NULL OR v_member.birth_date > (current_date - interval '21 years') THEN
      RAISE EXCEPTION 'Cargos do Conselho Consultivo exigem 21 anos ou mais';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
