-- Permite MC / admin total reabrir o caixa de um evento após o prazo de 30 dias
-- (ou status encerrado), gravando finance_open_until sem alterar a data do evento.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS finance_open_until date;

COMMENT ON COLUMN public.events.finance_open_until IS
  'Quando preenchido (reabertura), o caixa aceita lançamentos até esta data (inclusive), se status ≠ encerrado.';
