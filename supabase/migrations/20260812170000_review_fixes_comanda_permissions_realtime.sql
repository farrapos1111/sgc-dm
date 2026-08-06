-- Review fixes (applied on top of live functions):
-- - can_manage_event_destructive uses current-term has_commission_role
-- - checkout preserves non-pago status on partial pay; cash desc without member PII
-- - update/delete ticket item: IF NOT FOUND after ticket load
-- - delete_event_ticket: seller_charge_removed only when charge deleted
-- - realtime: member_charge_payments

CREATE OR REPLACE FUNCTION public.can_manage_event_destructive(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_any_role(_chapter_id, ARRAY['admin_total', 'mestre_conselheiro'])
    OR public.has_current_position(_chapter_id, ARRAY['mestre_conselheiro'])
    OR public.has_commission_role(_chapter_id, 'eventos', ARRAY['presidente']);
$$;

CREATE OR REPLACE FUNCTION public.checkout_event_ticket_comanda(
  _event_id uuid,
  _ticket_id uuid,
  _paid_at date DEFAULT NULL,
  _amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_charge public.member_charges%ROWTYPE;
  v_paid_at date := coalesce(
    _paid_at,
    (timezone('America/Sao_Paulo', now()))::date
  );
  v_already numeric(12,2) := 0;
  v_remaining numeric(12,2) := 0;
  v_pay numeric(12,2) := 0;
  v_entry_id uuid;
  v_cash_desc text;
  v_fully boolean;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id
    AND event_id = _event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  PERFORM public.require_ticket_checkin(_ticket_id);

  SELECT * INTO v_event FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissao para quitar a comanda';
  END IF;

  IF v_ticket.seller_charge_id IS NULL THEN
    RAISE EXCEPTION 'Ingresso sem cobranca de vendedor vinculada';
  END IF;

  SELECT * INTO v_charge
  FROM public.member_charges
  WHERE id = v_ticket.seller_charge_id
    AND chapter_id = v_event.chapter_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobranca nao encontrada';
  END IF;

  IF v_charge.status = 'pago' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'fully_paid', true);
  END IF;
  IF v_charge.status = 'isento' THEN
    RAISE EXCEPTION 'Cobranca isenta nao pode ser quitada no checkout';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_already
  FROM public.member_charge_payments
  WHERE charge_id = v_charge.id;

  v_remaining := greatest(0, round(coalesce(v_charge.amount, 0) - v_already, 2));
  IF v_remaining <= 0 THEN
    UPDATE public.member_charges
      SET status = 'pago',
          paid_at = v_paid_at
      WHERE id = v_charge.id;
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'fully_paid', true);
  END IF;

  IF _amount IS NULL THEN
    v_pay := v_remaining;
  ELSE
    IF _amount <= 0 THEN
      RAISE EXCEPTION 'Valor de baixa invalido';
    END IF;
    v_pay := round(_amount, 2);
    IF v_pay > v_remaining + 0.001 THEN
      RAISE EXCEPTION 'Valor excede o saldo em aberto (%)', v_remaining;
    END IF;
  END IF;

  v_cash_desc := coalesce(nullif(trim(v_charge.description), ''), 'Cobranca');

  INSERT INTO public.cash_entries (
    chapter_id, kind, category, subcategory, description, amount, entry_date,
    created_by, event_id
  ) VALUES (
    v_event.chapter_id,
    v_charge.kind,
    v_charge.category,
    v_charge.subcategory,
    v_cash_desc,
    v_pay,
    v_paid_at,
    auth.uid(),
    _event_id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO public.member_charge_payments (
    chapter_id, charge_id, amount, paid_at, cash_entry_id, notes, created_by
  ) VALUES (
    v_event.chapter_id,
    v_charge.id,
    v_pay,
    v_paid_at,
    v_entry_id,
    CASE
      WHEN v_pay + 0.001 >= v_remaining THEN 'Checkout comanda / quitacao ingresso'
      ELSE 'Checkout comanda / baixa parcial ingresso'
    END,
    auth.uid()
  );

  v_fully := (v_already + v_pay + 0.001) >= coalesce(v_charge.amount, 0);

  UPDATE public.member_charges
    SET status = CASE WHEN v_fully THEN 'pago' ELSE status END,
        paid_at = CASE WHEN v_fully THEN v_paid_at ELSE paid_at END,
        cash_entry_id = CASE WHEN v_fully THEN v_entry_id ELSE cash_entry_id END
    WHERE id = v_charge.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'fully_paid', v_fully,
    'amount', v_pay,
    'remaining', greatest(0, round(coalesce(v_charge.amount, 0) - v_already - v_pay, 2))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_event_ticket_item(
  _line_id uuid,
  _qty numeric DEFAULT NULL,
  _unit_price numeric DEFAULT NULL
)
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
  v_new_qty numeric(12,2);
  v_new_price numeric(12,2);
  v_new_amount numeric(12,2);
  v_delta integer;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda nao encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Item ja baixado — nao e possivel alterar';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_line.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF NOT (
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item financeiro nao encontrado';
  END IF;
  IF v_item.event_id <> v_line.event_id THEN
    RAISE EXCEPTION 'Item financeiro nao pertence a este evento';
  END IF;

  v_new_qty := COALESCE(_qty, v_line.qty);
  v_new_price := COALESCE(_unit_price, v_line.unit_price);

  IF v_new_qty IS NULL OR v_new_qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;
  IF v_new_price IS NULL OR v_new_price < 0 THEN
    RAISE EXCEPTION 'Valor unitario invalido';
  END IF;

  IF v_item.track_stock THEN
    v_delta := ceil(v_new_qty)::integer - ceil(v_line.qty)::integer;
    IF v_delta > 0 THEN
      IF COALESCE(v_item.stock_qty, 0) < v_delta THEN
        RAISE EXCEPTION 'Estoque insuficiente (disponivel: %)', COALESCE(v_item.stock_qty, 0);
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

  UPDATE public.event_ticket_items
    SET qty = v_new_qty,
        unit_price = v_new_price,
        amount = v_new_amount
    WHERE id = v_line.id;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'comanda_item_update',
    'event_ticket_items',
    v_line.id,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'item_id', v_item.id,
      'old', jsonb_build_object(
        'qty', v_line.qty,
        'unit_price', v_line.unit_price,
        'amount', v_line.amount
      ),
      'new', jsonb_build_object(
        'qty', v_new_qty,
        'unit_price', v_new_price,
        'amount', v_new_amount
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_line.id,
    'qty', v_new_qty,
    'unit_price', v_new_price,
    'amount', v_new_amount
  );
END;
$$;

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

  IF NOT (
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
      'item_id', v_line.item_id,
      'qty', v_line.qty,
      'unit_price', v_line.unit_price,
      'amount', v_line.amount,
      'cash_entry_id', v_line.cash_entry_id
    )
  );

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_event_ticket(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_seller_charge_removed boolean := false;
BEGIN
  PERFORM 1
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;

  v_seller_charge_id := v_ticket.seller_charge_id;

  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF NOT public.can_manage_event_destructive(v_event.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissao para excluir ingresso';
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

      v_seller_charge_removed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', _ticket_id,
    'comanda_items_removed', v_lines_count,
    'seller_charge_removed', v_seller_charge_removed
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      IF to_regclass('public.member_charge_payments') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.member_charge_payments;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;
  BEGIN
    ALTER TABLE IF EXISTS public.member_charge_payments REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END $$;
