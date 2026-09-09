-- Comissões fixas dos Capítulos DeMolay: sempre presentes e protegidas.
-- hospitalaria, entretenimento, auditoria, financas, sindicancias (+ eventos).

-- 1) Templates globais (rótulos/ordem canônicos)
INSERT INTO public.commissions (code, label, sort_order, chapter_id)
VALUES
  ('hospitalaria', 'Hospitalaria', 1, NULL),
  ('entretenimento', 'Entretenimento', 2, NULL),
  ('auditoria', 'Auditoria', 3, NULL),
  ('financas', 'Finanças', 4, NULL),
  ('sindicancias', 'Sindicâncias', 5, NULL),
  ('eventos', 'Eventos', 6, NULL)
ON CONFLICT (code) WHERE (chapter_id IS NULL)
DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- 2) Garante cópia em todo capítulo DeMolay (org_type = capitulo)
INSERT INTO public.commissions (code, label, sort_order, chapter_id)
SELECT t.code, t.label, t.sort_order, ch.id
FROM public.chapters ch
CROSS JOIN (
  VALUES
    ('hospitalaria', 'Hospitalaria', 1),
    ('entretenimento', 'Entretenimento', 2),
    ('auditoria', 'Auditoria', 3),
    ('financas', 'Finanças', 4),
    ('sindicancias', 'Sindicâncias', 5),
    ('eventos', 'Eventos', 6)
) AS t(code, label, sort_order)
WHERE coalesce(ch.org_type, 'capitulo') = 'capitulo'
  AND NOT EXISTS (
    SELECT 1
    FROM public.commissions x
    WHERE x.chapter_id = ch.id
      AND x.code = t.code
  );

-- Alinha rótulo/ordem das fixas já existentes nos capítulos
UPDATE public.commissions c
SET
  label = t.label,
  sort_order = t.sort_order
FROM (
  VALUES
    ('hospitalaria', 'Hospitalaria', 1),
    ('entretenimento', 'Entretenimento', 2),
    ('auditoria', 'Auditoria', 3),
    ('financas', 'Finanças', 4),
    ('sindicancias', 'Sindicâncias', 5),
    ('eventos', 'Eventos', 6)
) AS t(code, label, sort_order),
public.chapters ch
WHERE c.chapter_id = ch.id
  AND coalesce(ch.org_type, 'capitulo') = 'capitulo'
  AND c.code = t.code
  AND (c.label IS DISTINCT FROM t.label OR c.sort_order IS DISTINCT FROM t.sort_order);

-- 3) Seed em capítulos novos: templates globais (comportamento atual)
--    + reforço explícito das fixas quando for Capítulo DeMolay
CREATE OR REPLACE FUNCTION public.tg_seed_chapter_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Catálogo global (todos os org_types)
  INSERT INTO public.commissions (code, label, sort_order, chapter_id)
  SELECT t.code, t.label, t.sort_order, NEW.id
  FROM public.commissions t
  WHERE t.chapter_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.commissions x
      WHERE x.chapter_id = NEW.id
        AND x.code = t.code
    );

  -- Capítulos DeMolay: garante as fixas mesmo se o template global mudar
  IF coalesce(NEW.org_type, 'capitulo') = 'capitulo' THEN
    INSERT INTO public.commissions (code, label, sort_order, chapter_id)
    SELECT v.code, v.label, v.sort_order, NEW.id
    FROM (
      VALUES
        ('hospitalaria', 'Hospitalaria', 1),
        ('entretenimento', 'Entretenimento', 2),
        ('auditoria', 'Auditoria', 3),
        ('financas', 'Finanças', 4),
        ('sindicancias', 'Sindicâncias', 5),
        ('eventos', 'Eventos', 6)
    ) AS v(code, label, sort_order)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.commissions x
      WHERE x.chapter_id = NEW.id
        AND x.code = v.code
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Protege códigos fixos em capítulos DeMolay (não apagar / não mudar code)
CREATE OR REPLACE FUNCTION public.tg_protect_fixed_demolay_commissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_org text;
  v_fixed text[] := ARRAY[
    'hospitalaria',
    'entretenimento',
    'auditoria',
    'financas',
    'sindicancias',
    'eventos'
  ];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.chapter_id IS NULL THEN
      IF OLD.code = ANY (v_fixed) THEN
        RAISE EXCEPTION 'Comissão fixa do catálogo DeMolay não pode ser excluída (%)', OLD.code
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN OLD;
    END IF;

    SELECT coalesce(org_type, 'capitulo') INTO v_org
    FROM public.chapters WHERE id = OLD.chapter_id;

    IF v_org = 'capitulo' AND OLD.code = ANY (v_fixed) THEN
      RAISE EXCEPTION 'Comissão fixa do Capítulo DeMolay não pode ser excluída (%)', OLD.code
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.chapter_id IS NULL AND OLD.code = ANY (v_fixed) AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Código de comissão fixa do catálogo DeMolay não pode ser alterado (%)', OLD.code
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.chapter_id IS NOT NULL THEN
    SELECT coalesce(org_type, 'capitulo') INTO v_org
    FROM public.chapters WHERE id = NEW.chapter_id;

    IF v_org = 'capitulo' AND OLD.code = ANY (v_fixed) THEN
      IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'Código de comissão fixa do Capítulo DeMolay não pode ser alterado (%)', OLD.code
          USING ERRCODE = 'check_violation';
      END IF;
      -- Mantém rótulo canônico
      NEW.label := CASE OLD.code
        WHEN 'hospitalaria' THEN 'Hospitalaria'
        WHEN 'entretenimento' THEN 'Entretenimento'
        WHEN 'auditoria' THEN 'Auditoria'
        WHEN 'financas' THEN 'Finanças'
        WHEN 'sindicancias' THEN 'Sindicâncias'
        WHEN 'eventos' THEN 'Eventos'
        ELSE NEW.label
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_protect_fixed_demolay ON public.commissions;
CREATE TRIGGER commissions_protect_fixed_demolay
  BEFORE UPDATE OR DELETE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_protect_fixed_demolay_commissions();
