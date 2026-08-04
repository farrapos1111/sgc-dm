-- Fixes: name_key triggers, delete order (FK), lock order, search_path.

CREATE OR REPLACE FUNCTION public.finance_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT lower(trim(both from regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.tg_set_finance_name_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.name_key := public.finance_name_key(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_event_finance_categories_name_key
  ON public.event_finance_categories;
CREATE TRIGGER tg_event_finance_categories_name_key
  BEFORE INSERT OR UPDATE OF name, name_key ON public.event_finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_finance_name_key();

DROP TRIGGER IF EXISTS tg_event_finance_items_name_key
  ON public.event_finance_items;
CREATE TRIGGER tg_event_finance_items_name_key
  BEFORE INSERT OR UPDATE OF name, name_key ON public.event_finance_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_finance_name_key();

-- Ordem de bloqueio: event_ticket_items antes de tickets (igual delete_event_ticket_item).
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

  RETURN jsonb_build_object(
    'ok', true,
    'id', _ticket_id,
    'comanda_items_removed', v_lines_count
  );
END;
$$;

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
  v_ticket public.tickets%ROWTYPE;
  v_qty_int integer;
BEGIN
  -- Bloqueia a linha da comanda antes do ingresso.
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

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_line.ticket_id FOR UPDATE;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;
  IF v_ticket.seller_charge_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.member_charges
       WHERE id = v_ticket.seller_charge_id AND status = 'pago'
     )
  THEN
    RAISE EXCEPTION 'Comanda já quitada — não é possível alterar';
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
      'item_id', v_line.item_id,
      'qty', v_line.qty,
      'unit_price', v_line.unit_price,
      'amount', v_line.amount,
      'cash_entry_id', v_line.cash_entry_id
    )
  );

  -- Filho (event_ticket_items) antes do pai (cash_entries) — FK ON DELETE RESTRICT.
  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _line_id);
END;
$$;
