-- Religa pagamentos em lote do fluxo ("Comanda Dia dos Pais 2026/02 · …")
-- às linhas de comanda em aberto, sem criar nem alterar amounts no caixa.
-- Idempotente: só processa cash_entries ainda sem nenhuma linha ligada.

DO $$
DECLARE
  v_event_id uuid := '725b06df-0076-408b-8364-ecd14f2688b1';
  v_cash record;
  v_buyer text;
  v_rem numeric;
  v_line record;
  v_pay numeric;
  v_left numeric;
  v_unit numeric;
  v_qty_paid numeric;
  v_qty_left numeric;
  v_linked int := 0;
  v_split int := 0;
BEGIN
  FOR v_cash IN
    SELECT c.id, c.amount, c.description
    FROM public.cash_entries c
    WHERE c.event_id = v_event_id
      AND c.deleted_at IS NULL
      AND c.amount > 0
      AND c.description ILIKE 'Comanda Dia dos Pais 2026/02 · %'
      AND NOT EXISTS (
        SELECT 1
        FROM public.event_ticket_items i
        WHERE i.cash_entry_id = c.id
          AND i.deleted_at IS NULL
      )
    ORDER BY c.created_at
  LOOP
    v_buyer := trim(both ' ' FROM regexp_replace(
      regexp_replace(v_cash.description, '^Comanda Dia dos Pais 2026/02 · ', ''),
      ' \(espécie\)$',
      ''
    ));

    v_rem := v_cash.amount;

    FOR v_line IN
      SELECT i.id, i.ticket_id, i.item_id, i.qty, i.unit_price, i.amount, i.created_by, i.created_at
      FROM public.event_ticket_items i
      JOIN public.tickets t ON t.id = i.ticket_id
      WHERE i.event_id = v_event_id
        AND i.deleted_at IS NULL
        AND i.cash_entry_id IS NULL
        AND lower(trim(t.buyer_name)) = lower(trim(v_buyer))
      ORDER BY i.created_at, i.id
    LOOP
      EXIT WHEN v_rem <= 0;

      IF v_line.amount <= v_rem THEN
        UPDATE public.event_ticket_items
        SET cash_entry_id = v_cash.id
        WHERE id = v_line.id
          AND cash_entry_id IS NULL;

        v_rem := v_rem - v_line.amount;
        v_linked := v_linked + 1;
      ELSE
        -- Pagamento parcial: divide a linha (pago + restante em aberto)
        v_pay := v_rem;
        v_left := v_line.amount - v_pay;
        v_unit := NULLIF(v_line.unit_price, 0);

        IF v_unit IS NOT NULL AND v_unit > 0 THEN
          v_qty_paid := round(v_pay / v_unit, 4);
          v_qty_left := round(v_left / v_unit, 4);
        ELSE
          v_qty_paid := 1;
          v_qty_left := 1;
        END IF;

        UPDATE public.event_ticket_items
        SET qty = v_qty_paid,
            amount = v_pay,
            cash_entry_id = v_cash.id
        WHERE id = v_line.id
          AND cash_entry_id IS NULL;

        INSERT INTO public.event_ticket_items (
          event_id, ticket_id, item_id, qty, unit_price, amount,
          cash_entry_id, created_by, created_at
        ) VALUES (
          v_event_id, v_line.ticket_id, v_line.item_id, v_qty_left, v_line.unit_price, v_left,
          NULL, v_line.created_by, v_line.created_at
        );

        v_rem := 0;
        v_split := v_split + 1;
        v_linked := v_linked + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'reconcile comanda: linked=% split=%', v_linked, v_split;
END $$;
