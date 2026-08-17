-- Excluir a baixa no fluxo de caixa reabre o item na comanda:
-- cash_entry_id nulo = em aberto; preenchido = baixado.

ALTER TABLE public.event_ticket_items
  DROP CONSTRAINT IF EXISTS event_ticket_items_cash_entry_id_fkey;

ALTER TABLE public.event_ticket_items
  ADD CONSTRAINT event_ticket_items_cash_entry_id_fkey
  FOREIGN KEY (cash_entry_id)
  REFERENCES public.cash_entries(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.event_ticket_items.cash_entry_id IS
  'Vínculo com o fluxo de caixa. Nulo = item em aberto; preenchido = baixado.';
