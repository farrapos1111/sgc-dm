-- Ao excluir ingresso, remove também a cobrança do vendedor (e pagamentos/caixa vinculados).

CREATE OR REPLACE FUNCTION public.delete_event_ticket(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_qty_int integer;
  v_cash_ids uuid[] := ARRAY[]::uuid[];
  v_lines_count integer := 0;
  v_seller_charge_id uuid;
  v_charge_cash_id uuid;
  v_pay record;
BEGIN
  -- Bloqueia linhas da comanda antes do ingresso (evita deadlock com delete_event_ticket_item).
  PERFORM 1
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;

  v_seller_charge_id := v_ticket.seller_charge_id;

  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir ingresso';
  END IF;

  FOR v_line IN
    SELECT * FROM public.event_ticket_items
    WHERE ticket_id = _ticket_id
    ORDER BY id
  LOOP
    v_lines_count := v_lines_count + 1;
    SELECT * INTO v_item
    FROM public.event_finance_items
    WHERE id = v_line.item_id
    FOR UPDATE;
    IF FOUND AND v_item.track_stock THEN
      v_qty_int := ceil(v_line.qty)::integer;
      UPDATE public.event_finance_items
        SET stock_qty = COALESCE(stock_qty, 0) + v_qty_int
        WHERE id = v_item.id;
    END IF;
    IF v_line.cash_entry_id IS NOT NULL THEN
      v_cash_ids := array_append(v_cash_ids, v_line.cash_entry_id);
    END IF;
  END LOOP;

  DELETE FROM public.event_ticket_items WHERE ticket_id = _ticket_id;

  IF array_length(v_cash_ids, 1) IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = ANY(v_cash_ids);
  END IF;

  UPDATE public.seats SET ticket_id = NULL WHERE ticket_id = _ticket_id;
  DELETE FROM public.checkins WHERE ticket_id = _ticket_id;
  DELETE FROM public.tickets WHERE id = _ticket_id;

  -- Cobrança do vendedor vinculada ao ingresso
  IF v_seller_charge_id IS NOT NULL THEN
    SELECT cash_entry_id INTO v_charge_cash_id
    FROM public.member_charges
    WHERE id = v_seller_charge_id
    FOR UPDATE;

    IF FOUND THEN
      FOR v_pay IN
        SELECT cash_entry_id
        FROM public.member_charge_payments
        WHERE charge_id = v_seller_charge_id
      LOOP
        IF v_pay.cash_entry_id IS NOT NULL THEN
          v_cash_ids := array_append(v_cash_ids, v_pay.cash_entry_id);
        END IF;
      END LOOP;

      IF v_charge_cash_id IS NOT NULL THEN
        v_cash_ids := array_append(v_cash_ids, v_charge_cash_id);
      END IF;

      DELETE FROM public.member_charge_payments
      WHERE charge_id = v_seller_charge_id;

      DELETE FROM public.member_charges
      WHERE id = v_seller_charge_id;

      IF array_length(v_cash_ids, 1) IS NOT NULL THEN
        DELETE FROM public.cash_entries WHERE id = ANY(v_cash_ids);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', _ticket_id,
    'comanda_items_removed', v_lines_count,
    'seller_charge_removed', v_seller_charge_id IS NOT NULL
  );
END;
$$;
