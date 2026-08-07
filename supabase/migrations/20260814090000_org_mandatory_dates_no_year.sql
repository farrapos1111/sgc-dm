-- Datas obrigatórias recorrentes: só mês (e dia), sem ano.

ALTER TABLE public.org_mandatory_dates
  ADD COLUMN IF NOT EXISTS due_day integer
    CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

-- Migrar until_day: extrair mês/dia de due_date
UPDATE public.org_mandatory_dates
SET
  due_month = EXTRACT(MONTH FROM due_date)::integer,
  due_day = EXTRACT(DAY FROM due_date)::integer,
  due_date = NULL,
  due_year = NULL
WHERE prazo_kind = 'until_day'
  AND due_date IS NOT NULL;

-- within_month / until_month: descartar ano
UPDATE public.org_mandatory_dates
SET due_year = NULL
WHERE prazo_kind IN ('within_month', 'until_month');

ALTER TABLE public.org_mandatory_dates
  DROP CONSTRAINT IF EXISTS org_mandatory_dates_fields_ck;

ALTER TABLE public.org_mandatory_dates
  ADD CONSTRAINT org_mandatory_dates_fields_ck CHECK (
    (
      prazo_kind = 'until_day'
      AND due_month IS NOT NULL
      AND due_day IS NOT NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
    OR (
      prazo_kind IN ('within_month', 'until_month')
      AND due_month IS NOT NULL
      AND due_day IS NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
  );
