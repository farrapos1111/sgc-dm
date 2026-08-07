-- Intervalo anual DD/MM até DD/MM nas datas obrigatórias.

ALTER TABLE public.org_mandatory_dates
  ADD COLUMN IF NOT EXISTS start_day integer
    CHECK (start_day IS NULL OR (start_day >= 1 AND start_day <= 31));

ALTER TABLE public.org_mandatory_dates
  ADD COLUMN IF NOT EXISTS start_month integer
    CHECK (start_month IS NULL OR (start_month >= 1 AND start_month <= 12));

ALTER TABLE public.org_mandatory_dates
  DROP CONSTRAINT IF EXISTS org_mandatory_dates_prazo_kind_check;

ALTER TABLE public.org_mandatory_dates
  ADD CONSTRAINT org_mandatory_dates_prazo_kind_check
  CHECK (prazo_kind = ANY (ARRAY[
    'until_day'::text,
    'within_month'::text,
    'until_month'::text,
    'date_range'::text
  ]));

ALTER TABLE public.org_mandatory_dates
  DROP CONSTRAINT IF EXISTS org_mandatory_dates_fields_ck;

ALTER TABLE public.org_mandatory_dates
  ADD CONSTRAINT org_mandatory_dates_fields_ck CHECK (
    (
      prazo_kind = 'until_day'
      AND due_month IS NOT NULL
      AND due_day IS NOT NULL
      AND start_month IS NULL
      AND start_day IS NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
    OR (
      prazo_kind IN ('within_month', 'until_month')
      AND due_month IS NOT NULL
      AND due_day IS NULL
      AND start_month IS NULL
      AND start_day IS NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
    OR (
      prazo_kind = 'date_range'
      AND start_month IS NOT NULL
      AND start_day IS NOT NULL
      AND due_month IS NOT NULL
      AND due_day IS NOT NULL
      AND due_date IS NULL
      AND due_year IS NULL
    )
  );
