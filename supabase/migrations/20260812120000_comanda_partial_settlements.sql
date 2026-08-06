-- Comanda: itens entram sem caixa; baixa individual (item ou ingresso) lança no fluxo.
-- Linhas já existentes com cash_entry_id permanecem como pagas.

CREATE OR REPLACE FUNCTION public.add_event_ticket_item(
  _ticket_id uuid,
  _item_id uuid,
  _qty numeric DEFAULT 1,
  _unit_price numeric DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_price numeric(12,2);
  v_amount numeric(12,2);
  v_qty_int integer;
  v_line_id uuid;
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
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
    RAISE EXCEPTION 'Sem permissão para lançar na comanda';
  END IF;

  SELECT * INTO v_item
  FROM public.event_finance_items
  WHERE id = _item_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_item.active OR v_item.event_id <> v_ticket.event_id THEN
    RAISE EXCEPTION 'Item inexistente ou inativo neste evento';
  END IF;

  v_price := COALESCE(_unit_price, v_item.unit_price);
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Informe o valor unitário';
  END IF;
  IF v_price < 0 THEN
    RAISE EXCEPTION 'Valor unitário inválido';
  END IF;

  v_amount := round(v_price * _qty, 2);

  IF v_item.track_stock THEN
    v_qty_int := ceil(_qty)::integer;
    IF v_item.stock_qty IS NULL OR v_item.stock_qty < v_qty_int THEN
      RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', COALESCE(v_item.stock_qty, 0);
    END IF;
    UPDATE public.event_finance_items
      SET stock_qty = stock_qty - v_qty_int
      WHERE id = v_item.id;
  END IF;

  -- Sem cash_entry: só baixa gera lançamento no fluxo.
  INSERT INTO public.event_ticket_items (
    event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_by
  ) VALUES (
    v_event.id, v_ticket.id, v_item.id, _qty, v_price, v_amount, NULL, auth.uid()
  )
  RETURNING id INTO v_line_id;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'comanda_item_add',
    'event_ticket_items',
    v_line_id,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'buyer_name', v_ticket.buyer_name,
      'item_id', v_item.id,
      'item_name', v_item.name,
      'qty', _qty,
      'unit_price', v_price,
      'amount', v_amount,
      'event_id', v_event.id,
      'event_name', v_event.name,
      'deferred_cash', true
    )
  );

  RETURN jsonb_build_object(
    'id', v_line_id,
    'cash_entry_id', NULL,
    'amount', v_amount,
    'unit_price', v_price,
    'qty', _qty
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_event_ticket_item(
  _line_id uuid,
  _paid_at date DEFAULT NULL
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
  v_paid_at date := coalesce(
    _paid_at,
    (timezone('America/Sao_Paulo', now()))::date
  );
  v_cash_id uuid;
  v_desc text;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'cash_entry_id', v_line.cash_entry_id);
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
    RAISE EXCEPTION 'Sem permissão para baixar item da comanda';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_line.ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  SELECT * INTO v_item FROM public.event_finance_items WHERE id = v_line.item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item financeiro não encontrado';
  END IF;

  v_desc := format(
    'Comanda %s · %s × %s',
    COALESCE(v_ticket.buyer_name, 'participante'),
    v_item.name,
    v_line.qty::text
  );

  INSERT INTO public.cash_entries (
    chapter_id, kind, category, subcategory, description, amount, entry_date,
    event_id, event_finance_item_id, created_by
  ) VALUES (
    v_event.chapter_id, 'entrada', 'Eventos', v_item.name, v_desc, v_line.amount,
    v_paid_at,
    v_event.id, v_item.id, auth.uid()
  )
  RETURNING id INTO v_cash_id;

  UPDATE public.event_ticket_items
    SET cash_entry_id = v_cash_id
    WHERE id = v_line.id;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'comanda_item_pay',
    'event_ticket_items',
    v_line.id,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'item_id', v_item.id,
      'item_name', v_item.name,
      'amount', v_line.amount,
      'cash_entry_id', v_cash_id,
      'paid_at', v_paid_at
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'cash_entry_id', v_cash_id,
    'amount', v_line.amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_event_ticket_item(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_event_ticket_item(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_event_ticket_item(uuid, date) TO service_role;

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
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'Item já baixado — não é possível alterar';
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

  SELECT * INTO v_item
  FROM public.event_finance_items
  WHERE id = v_line.item_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item financeiro não encontrado';
  END IF;
  IF v_item.event_id <> v_line.event_id THEN
    RAISE EXCEPTION 'Item financeiro não pertence a este evento';
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
SET search_path = public
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

  -- Item já baixado: remove também o lançamento do caixa.
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

-- Baixa do ingresso (parcial ou total). _amount NULL = saldo restante.
DROP FUNCTION IF EXISTS public.checkout_event_ticket_comanda(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.checkout_event_ticket_comanda(
  _event_id uuid,
  _ticket_id uuid,
  _paid_at date DEFAULT NULL,
  _amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_charge public.member_charges%ROWTYPE;
  v_seller public.members%ROWTYPE;
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
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para quitar a comanda';
  END IF;

  IF v_ticket.seller_charge_id IS NULL THEN
    RAISE EXCEPTION 'Ingresso sem cobrança de vendedor vinculada';
  END IF;

  SELECT * INTO v_charge
  FROM public.member_charges
  WHERE id = v_ticket.seller_charge_id
    AND chapter_id = v_event.chapter_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança não encontrada';
  END IF;

  IF v_charge.status = 'pago' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'fully_paid', true);
  END IF;
  IF v_charge.status = 'isento' THEN
    RAISE EXCEPTION 'Cobrança isenta não pode ser quitada no checkout';
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
      RAISE EXCEPTION 'Valor de baixa inválido';
    END IF;
    v_pay := round(_amount, 2);
    IF v_pay > v_remaining + 0.001 THEN
      RAISE EXCEPTION 'Valor excede o saldo em aberto (%)', v_remaining;
    END IF;
  END IF;

  SELECT * INTO v_seller
  FROM public.members
  WHERE id = v_charge.member_id;

  v_cash_desc := format(
    '%s - %s',
    coalesce(nullif(trim(v_charge.description), ''), 'Cobrança'),
    coalesce(nullif(trim(v_seller.full_name), ''), 'Membro')
  );

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
      WHEN v_pay + 0.001 >= v_remaining THEN 'Checkout comanda / quitação ingresso'
      ELSE 'Checkout comanda / baixa parcial ingresso'
    END,
    auth.uid()
  );

  v_fully := (v_already + v_pay + 0.001) >= coalesce(v_charge.amount, 0);

  UPDATE public.member_charges
    SET status = CASE WHEN v_fully THEN 'pago' ELSE 'em_aberto' END,
        paid_at = CASE WHEN v_fully THEN v_paid_at ELSE NULL END,
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

REVOKE ALL ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric) TO service_role;
