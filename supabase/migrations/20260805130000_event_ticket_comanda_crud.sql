-- Excluir/editar comanda e excluir ingresso com dependentes

CREATE OR REPLACE FUNCTION public.delete_event_ticket_item(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_qty_int integer;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_line.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a comanda';
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

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  RETURN jsonb_build_object('ok', true, 'id', _line_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_ticket_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_event_ticket_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_ticket_item(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_event_ticket_item(
  _line_id uuid,
  _qty numeric DEFAULT NULL,
  _unit_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_new_qty numeric(12,2);
  v_new_price numeric(12,2);
  v_new_amount numeric(12,2);
  v_delta integer;
  v_desc text;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_line.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a comanda';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_line.ticket_id;
  SELECT * INTO v_item
  FROM public.event_finance_items
  WHERE id = v_line.item_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item financeiro não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;
  IF NOT v_item.active THEN
    RAISE EXCEPTION 'Item inexistente ou inativo neste evento';
  END IF;

  v_new_qty := COALESCE(_qty, v_line.qty);
  v_new_price := COALESCE(_unit_price, v_line.unit_price);

  IF v_new_qty IS NULL OR v_new_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF v_new_price IS NULL OR v_new_price < 0 THEN
    RAISE EXCEPTION 'Valor unitário inválido';
  END IF;

  IF v_item.track_stock THEN
    v_delta := ceil(v_new_qty)::integer - ceil(v_line.qty)::integer;
    IF v_delta > 0 THEN
      IF COALESCE(v_item.stock_qty, 0) < v_delta THEN
        RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', COALESCE(v_item.stock_qty, 0);
      END IF;
      UPDATE public.event_finance_items
        SET stock_qty = stock_qty - v_delta
        WHERE id = v_item.id;
    ELSIF v_delta < 0 THEN
      UPDATE public.event_finance_items
        SET stock_qty = COALESCE(stock_qty, 0) + abs(v_delta)
        WHERE id = v_item.id;
    END IF;
  END IF;

  v_new_amount := round(v_new_price * v_new_qty, 2);
  v_desc := format(
    'Comanda %s · %s × %s',
    COALESCE(v_ticket.buyer_name, 'participante'),
    v_item.name,
    v_new_qty::text
  );

  UPDATE public.event_ticket_items
    SET qty = v_new_qty,
        unit_price = v_new_price,
        amount = v_new_amount
    WHERE id = v_line.id;

  IF v_line.cash_entry_id IS NOT NULL THEN
    UPDATE public.cash_entries
      SET amount = v_new_amount,
          subcategory = v_item.name,
          description = v_desc,
          event_finance_item_id = v_item.id,
          event_id = v_event.id
      WHERE id = v_line.cash_entry_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_line.id,
    'qty', v_new_qty,
    'unit_price', v_new_price,
    'amount', v_new_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_event_ticket_item(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_ticket_item(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_ticket_item(uuid, numeric, numeric) TO service_role;

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
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;

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
    FOR UPDATE
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

  RETURN jsonb_build_object(
    'ok', true,
    'id', _ticket_id,
    'comanda_items_removed', v_lines_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_ticket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_event_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_ticket(uuid) TO service_role;
