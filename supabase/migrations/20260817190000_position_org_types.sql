-- Catálogo de cargos (positions) por tipo de instituição — alinhado à Gestão.

CREATE SEQUENCE IF NOT EXISTS public.positions_id_seq;
SELECT setval(
  'public.positions_id_seq',
  coalesce((SELECT max(id) FROM public.positions), 0)
);

ALTER TABLE public.positions
  ALTER COLUMN id SET DEFAULT nextval('public.positions_id_seq');

ALTER SEQUENCE public.positions_id_seq OWNED BY public.positions.id;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

UPDATE public.positions SET is_system = true WHERE id <= 27;

CREATE TABLE IF NOT EXISTS public.position_org_types (
  position_id smallint NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  org_type text NOT NULL
    CHECK (org_type IN (
      'capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro',
      'abelhinhas', 'arco_iris'
    )),
  role_group text NULL
    CHECK (
      role_group IS NULL
      OR role_group IN ('ritualisticos', 'conselho', 'comissoes')
    ),
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (position_id, org_type)
);

CREATE INDEX IF NOT EXISTS position_org_types_org_idx
  ON public.position_org_types (org_type, role_group, sort_order);

ALTER TABLE public.position_org_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS position_org_types_select ON public.position_org_types;
CREATE POLICY position_org_types_select ON public.position_org_types
  FOR SELECT TO authenticated USING (true);

-- Seed: cargos atuais do DeMolay → Capítulo (exceto regionais)
INSERT INTO public.position_org_types (position_id, org_type, role_group, sort_order)
SELECT
  p.id,
  'capitulo',
  CASE
    WHEN p.scope = 'consultivo' THEN 'conselho'
    ELSE 'ritualisticos'
  END,
  p.sort_order
FROM public.positions p
WHERE p.scope IN ('capitulo', 'consultivo')
ON CONFLICT (position_id, org_type) DO UPDATE
SET
  role_group = EXCLUDED.role_group,
  sort_order = EXCLUDED.sort_order;

-- Validação: scope comissao comporta-se como cargo de corpo (sem regra de 21 anos)
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
