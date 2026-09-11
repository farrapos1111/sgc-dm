-- Alinha "em aberto" do Dia dos Pais ao relatório PDF de 19/08/2026 (R$ 401,00).
-- Fecha o que está aberto indevidamente (placeholder amount=0 — sem inflar caixa).
-- Reabre itens que o PDF lista em aberto e que tinham sido baixados no restore.
-- Não altera amounts > 0 de cash_entries existentes.

DO $$
DECLARE
  v_event_id uuid := '725b06df-0076-408b-8364-ecd14f2688b1';
  v_chapter_id uuid;
  v_line record;
  v_cash_id uuid;
  v_closed int := 0;
  v_reopened int := 0;
BEGIN
  SELECT chapter_id INTO v_chapter_id FROM public.events WHERE id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Evento Dia dos Pais não encontrado';
  END IF;

  -- 1) Fernando: PDF lista ingresso em aberto → desliga cobrança do ticket
  --    (cobrança/caixa existentes permanecem; só o evento volta a mostrar em aberto)
  UPDATE public.tickets
  SET seller_charge_id = NULL
  WHERE event_id = v_event_id
    AND deleted_at IS NULL
    AND buyer_name = 'Fernando Fernandes'
    AND price_paid = 35
    AND seller_charge_id IS NOT NULL;

  -- 2) Reabrir linhas de comanda que o PDF mantém em aberto
  UPDATE public.event_ticket_items i
  SET cash_entry_id = NULL
  FROM public.tickets t
  WHERE i.ticket_id = t.id
    AND i.event_id = v_event_id
    AND i.deleted_at IS NULL
    AND i.cash_entry_id IS NOT NULL
    AND (
      (t.buyer_name = 'Dionata' AND i.item_id = 'e20c2f62-f9c9-490e-8bc6-d33e7dd0ce67' AND i.amount = 10)
      OR (t.buyer_name = 'João da Silva Dutra Neto' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 50)
      OR (t.buyer_name = 'Solange Deon Pereira' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 20)
      OR (t.buyer_name = 'Rafael Roldo' AND i.item_id = 'e20c2f62-f9c9-490e-8bc6-d33e7dd0ce67' AND i.amount = 10)
      OR (t.buyer_name = 'Everton' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 10 AND i.qty = 1)
      OR (t.buyer_name = 'Silvio da Silva Borges' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 10 AND i.qty = 1
          AND i.id = 'e2804163-0529-4f94-81d6-1397b69e41f2')
    );

  GET DIAGNOSTICS v_reopened = ROW_COUNT;

  -- 3) Anderson: remove duplicata já baixada do Rifão (fica só a linha em aberto do PDF)
  UPDATE public.event_ticket_items
  SET deleted_at = coalesce(deleted_at, now())
  WHERE id = 'b59315b3-a25b-4e57-9b6d-ec20a6c5a49a'
    AND deleted_at IS NULL;

  -- 4) Fechar linhas em aberto que NÃO estão no PDF (placeholder R$ 0)
  FOR v_line IN
    SELECT i.id, i.ticket_id, i.item_id, i.amount, i.qty, t.buyer_name, fi.name AS item_name
    FROM public.event_ticket_items i
    JOIN public.tickets t ON t.id = i.ticket_id
    LEFT JOIN public.event_finance_items fi ON fi.id = i.item_id
    WHERE i.event_id = v_event_id
      AND i.deleted_at IS NULL
      AND i.cash_entry_id IS NULL
      AND i.amount > 0
      AND NOT (
        -- Lista PDF "Ainda em aberto"
        (t.buyer_name = 'Anderson' AND i.item_id = '2f568532-711e-4e8f-89e1-7bc0824aac64' AND i.amount = 6)
        OR (t.buyer_name = 'João da Silva Dutra Neto' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 50)
        OR (t.buyer_name = 'Solange Deon Pereira' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 20)
        OR (t.buyer_name = 'Guilherme Peres' AND i.item_id = 'e20c2f62-f9c9-490e-8bc6-d33e7dd0ce67' AND i.amount = 10)
        OR (t.buyer_name = 'Silvio da Silva Borges' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 10)
        OR (t.buyer_name = 'Rafael Roldo' AND i.item_id = 'e20c2f62-f9c9-490e-8bc6-d33e7dd0ce67' AND i.amount = 10)
        OR (t.buyer_name = 'Everton' AND i.item_id = 'af31f9ef-cd67-4f4d-8d88-74fd87aa7260' AND i.amount = 10)
        OR (t.buyer_name = 'Dionata' AND i.item_id = 'e20c2f62-f9c9-490e-8bc6-d33e7dd0ce67' AND i.amount = 10)
      )
  LOOP
    INSERT INTO public.cash_entries (
      chapter_id, kind, category, subcategory, description,
      amount, entry_date, event_id, event_finance_item_id
    ) VALUES (
      v_chapter_id,
      'entrada',
      'Eventos',
      'Dia dos Pais',
      format(
        '[pdf-alinhado-sem-reentrada] Comanda %s · %s',
        v_line.buyer_name,
        coalesce(v_line.item_name, 'item')
      ),
      0,
      DATE '2026-08-19',
      v_event_id,
      v_line.item_id
    )
    RETURNING id INTO v_cash_id;

    UPDATE public.event_ticket_items
    SET cash_entry_id = v_cash_id
    WHERE id = v_line.id
      AND cash_entry_id IS NULL;

    v_closed := v_closed + 1;
  END LOOP;

  RAISE NOTICE 'align pdf open: reopened_cmds=% closed_false_open=%', v_reopened, v_closed;
END $$;
