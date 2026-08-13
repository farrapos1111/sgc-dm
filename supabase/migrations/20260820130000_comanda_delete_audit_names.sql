-- Audit de remoção de item da comanda com nome do item e do comprador.

CREATE OR REPLACE FUNCTION public.delete_event_ticket_item(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_qty_int integer;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda nao encontrado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_line.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    IF NOT public.can_manage_event_destructive(v_event.chapter_id) THEN
      RAISE EXCEPTION 'Sem permissao para remover item ja baixado no caixa';
    END IF;
  ELSIF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a comanda';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_line.ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

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

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'comanda_item_delete',
    'event_ticket_items',
    v_line.id,
    jsonb_build_object(
      'ticket_id', v_line.ticket_id,
      'buyer_name', v_ticket.buyer_name,
      'item_id', v_line.item_id,
      'item_name', v_item.name,
      'qty', v_line.qty,
      'unit_price', v_line.unit_price,
      'amount', v_line.amount,
      'cash_entry_id', v_line.cash_entry_id,
      'event_id', v_event.id,
      'event_name', v_event.name
    )
  );

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  RETURN jsonb_build_object('ok', true, 'id', v_line.id);
END;
$$;
