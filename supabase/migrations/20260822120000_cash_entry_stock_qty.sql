-- Quantidade vendida em lançamentos manuais de itens com controle de estoque.
-- Nulo para lançamentos sem baixa de estoque (comanda/ingresso ou itens sem track_stock).

ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS qty integer;

ALTER TABLE public.cash_entries
  DROP CONSTRAINT IF EXISTS cash_entries_qty_ck;

ALTER TABLE public.cash_entries
  ADD CONSTRAINT cash_entries_qty_ck
  CHECK (qty IS NULL OR qty >= 1);

COMMENT ON COLUMN public.cash_entries.qty IS
  'Quantidade vendida em lançamentos manuais de itens com controle de estoque.';
