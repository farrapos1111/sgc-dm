-- Baixa em dinheiro: anexa (espécie) à descrição do lançamento no caixa.

DROP FUNCTION IF EXISTS public.pay_event_ticket_item(uuid, date);
DROP FUNCTION IF EXISTS public.checkout_event_ticket_comanda(uuid, uuid, date, numeric);

CREATE OR REPLACE FUNCTION public.pay_event_ticket_item(
  _line_id uuid,
  _paid_at date DEFAULT NULL,
  _tender text DEFAULT NULL
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
  v_tender text := lower(nullif(trim(coalesce(_tender, '')), ''));
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'cash_entry_id', v_line.cash_entry_id);
  END IF;

  PERFORM public.require_ticket_checkin(v_line.ticket_id);

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
  IF v_tender IN ('dinheiro', 'especie') THEN
    v_desc := v_desc || ' (espécie)';
  END IF;

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
      'paid_at', v_paid_at,
      'tender', v_tender
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

CREATE OR REPLACE FUNCTION public.checkout_event_ticket_comanda(
  _event_id uuid,
  _ticket_id uuid,
  _paid_at date DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _tender text DEFAULT NULL
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
  v_tender text := lower(nullif(trim(coalesce(_tender, '')), ''));
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
  IF v_tender IN ('dinheiro', 'especie') THEN
    v_cash_desc := v_cash_desc || ' (espécie)';
  END IF;

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

REVOKE ALL ON FUNCTION public.pay_event_ticket_item(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_event_ticket_item(uuid, date, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric, text) TO authenticated, service_role;
