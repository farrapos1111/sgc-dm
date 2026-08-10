-- Cargos/comissões: membro afiliado (não só originário) pode receber cargo no capítulo

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

  IF NOT public.member_visible_in_chapter(NEW.member_id, NEW.chapter_id) THEN
    RAISE EXCEPTION 'Membro não pertence a este capítulo';
  END IF;

  IF NEW.term_semester NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Semestre deve ser 1 ou 2';
  END IF;

  SELECT scope INTO v_scope FROM public.positions WHERE id = NEW.position_id;

  IF v_scope = 'regional' THEN
    IF NEW.region_id IS NULL THEN
      RAISE EXCEPTION 'Cargos regionais exigem região e só podem ser atribuídos via transferência oficial';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = NEW.chapter_id AND c.region_id = NEW.region_id
    ) THEN
      RAISE EXCEPTION 'O membro precisa pertencer a um capítulo da região do cargo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.region_id IS NOT NULL THEN
    RAISE EXCEPTION 'region_id só é permitido em cargos regionais';
  END IF;

  IF v_scope = 'consultivo' THEN
    IF v_member.birth_date IS NULL OR v_member.birth_date > (current_date - interval '21 years') THEN
      RAISE EXCEPTION 'Cargos do Conselho Consultivo exigem 21 anos ou mais';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_validate_commission_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.member_visible_in_chapter(NEW.member_id, NEW.chapter_id) THEN
    RAISE EXCEPTION 'Membro não pertence a este capítulo';
  END IF;
  IF NEW.term_semester NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Semestre deve ser 1 ou 2';
  END IF;
  RETURN NEW;
END;
$$;
