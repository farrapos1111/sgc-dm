-- Vínculo opcional de comissão → módulo do sistema (module_key).

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS module_key text;

COMMENT ON COLUMN public.commissions.module_key IS
  'Módulo do app vinculado à comissão (eventos, sindicancias, hospitalaria, financas, entretenimento, auditoria).';

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_module_key_check;
ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_module_key_check
  CHECK (
    module_key IS NULL
    OR module_key IN (
      'hospitalaria',
      'entretenimento',
      'auditoria',
      'financas',
      'sindicancias',
      'eventos'
    )
  );

-- Backfill: comissões obrigatórias (e quaisquer com o código do módulo)
UPDATE public.commissions
SET module_key = code
WHERE module_key IS NULL
  AND code IN (
    'hospitalaria',
    'entretenimento',
    'auditoria',
    'financas',
    'sindicancias',
    'eventos'
  );

-- Proteção: em Capítulo DeMolay, obrigatórias mantêm module_key = code
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
        RAISE EXCEPTION 'Comissão obrigatória do catálogo DeMolay não pode ser excluída (%)', OLD.code
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN OLD;
    END IF;

    SELECT coalesce(org_type, 'capitulo') INTO v_org
    FROM public.chapters WHERE id = OLD.chapter_id;

    IF v_org = 'capitulo' AND OLD.code = ANY (v_fixed) THEN
      RAISE EXCEPTION 'Comissão obrigatória do Capítulo DeMolay não pode ser excluída (%)', OLD.code
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.chapter_id IS NULL AND OLD.code = ANY (v_fixed) AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Código de comissão obrigatória do catálogo DeMolay não pode ser alterado (%)', OLD.code
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.chapter_id IS NOT NULL THEN
    SELECT coalesce(org_type, 'capitulo') INTO v_org
    FROM public.chapters WHERE id = NEW.chapter_id;

    IF v_org = 'capitulo' AND OLD.code = ANY (v_fixed) THEN
      IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'Código de comissão obrigatória do Capítulo DeMolay não pode ser alterado (%)', OLD.code
          USING ERRCODE = 'check_violation';
      END IF;
      NEW.label := CASE OLD.code
        WHEN 'hospitalaria' THEN 'Hospitalaria'
        WHEN 'entretenimento' THEN 'Entretenimento'
        WHEN 'auditoria' THEN 'Auditoria'
        WHEN 'financas' THEN 'Finanças'
        WHEN 'sindicancias' THEN 'Sindicâncias'
        WHEN 'eventos' THEN 'Eventos'
        ELSE NEW.label
      END;
      NEW.module_key := OLD.code;
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

-- Seed: inclui obrigatórias já com module_key
CREATE OR REPLACE FUNCTION public.tg_seed_chapter_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.commissions (code, label, sort_order, chapter_id, module_key)
  SELECT t.code, t.label, t.sort_order, NEW.id, t.module_key
  FROM public.commissions t
  WHERE t.chapter_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.commissions x
      WHERE x.chapter_id = NEW.id
        AND x.code = t.code
    );

  IF coalesce(NEW.org_type, 'capitulo') = 'capitulo' THEN
    INSERT INTO public.commissions (code, label, sort_order, chapter_id, module_key)
    SELECT v.code, v.label, v.sort_order, NEW.id, v.code
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

-- Templates globais: module_key alinhado
UPDATE public.commissions
SET module_key = code
WHERE chapter_id IS NULL
  AND code IN (
    'hospitalaria',
    'entretenimento',
    'auditoria',
    'financas',
    'sindicancias',
    'eventos'
  )
  AND (module_key IS DISTINCT FROM code);
