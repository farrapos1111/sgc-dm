-- Baixa de item: Pix/Dinheiro, valor parcial e saldo no vendedor.

DROP FUNCTION IF EXISTS public.pay_event_ticket_item(uuid, date, text);

CREATE OR REPLACE FUNCTION public.pay_event_ticket_item(
  _line_id uuid,
  _paid_at date DEFAULT NULL,
  _tender text DEFAULT NULL,
  _amount numeric DEFAULT NULL
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
  v_charge public.member_charges%ROWTYPE;
  v_paid_at date := coalesce(
    _paid_at,
    (timezone('America/Sao_Paulo', now()))::date
  );
  v_tender text := lower(nullif(trim(coalesce(_tender, '')), ''));
  v_cash_id uuid;
  v_desc text;
  v_pay numeric(12,2);
  v_rem numeric(12,2) := 0;
  v_charge_id uuid;
  v_buyer text;
  v_has_charge boolean := false;
BEGIN
  SELECT * INTO v_line FROM public.event_ticket_items WHERE id = _line_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'cash_entry_id', v_line.cash_entry_id, 'amount', v_line.amount, 'remaining', 0);
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

  IF _amount IS NULL THEN
    v_pay := round(v_line.amount, 2);
  ELSE
    IF _amount <= 0 THEN
      RAISE EXCEPTION 'Valor de pagamento inválido';
    END IF;
    v_pay := least(round(v_line.amount, 2), round(_amount, 2));
  END IF;
  v_rem := round(v_line.amount - v_pay, 2);
  v_buyer := coalesce(nullif(trim(v_ticket.buyer_name), ''), 'participante');

  v_desc := format(
    'Comanda %s · %s × %s',
    v_buyer,
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
    v_event.chapter_id, 'entrada', 'Eventos', v_item.name, v_desc, v_pay,
    v_paid_at,
    v_event.id, v_item.id, auth.uid()
  )
  RETURNING id INTO v_cash_id;

  UPDATE public.event_ticket_items
    SET cash_entry_id = v_cash_id,
        amount = v_pay
    WHERE id = v_line.id;

  IF v_rem > 0.001 THEN
    IF v_ticket.seller_member_id IS NULL THEN
      RAISE EXCEPTION 'Informe o vendedor para gerar a cobrança do saldo';
    END IF;

    IF v_ticket.seller_charge_id IS NOT NULL THEN
      SELECT * INTO v_charge
      FROM public.member_charges
      WHERE id = v_ticket.seller_charge_id
        AND chapter_id = v_event.chapter_id
      FOR UPDATE;
      IF FOUND AND v_charge.status <> 'isento' THEN
        v_has_charge := true;
      END IF;
    END IF;

    IF v_has_charge THEN
      UPDATE public.member_charges
        SET amount = round(coalesce(amount, 0) + v_rem, 2),
            status = 'em_aberto',
            paid_at = NULL,
            cash_entry_id = NULL
        WHERE id = v_charge.id;
      v_charge_id := v_charge.id;
    ELSE
      INSERT INTO public.member_charges (
        chapter_id, member_id, kind, category, subcategory, description,
        amount, due_date, status, created_by
      ) VALUES (
        v_event.chapter_id,
        v_ticket.seller_member_id,
        'entrada',
        'Eventos',
        v_event.name,
        format('Saldo comanda %s - %s', v_event.name, v_buyer),
        v_rem,
        v_paid_at,
        'em_aberto',
        auth.uid()
      )
      RETURNING id INTO v_charge_id;

      UPDATE public.tickets
        SET seller_charge_id = v_charge_id
        WHERE id = v_ticket.id;
    END IF;
  END IF;

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
      'amount', v_pay,
      'remaining', v_rem,
      'cash_entry_id', v_cash_id,
      'paid_at', v_paid_at,
      'tender', v_tender
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'cash_entry_id', v_cash_id,
    'amount', v_pay,
    'remaining', CASE WHEN v_rem <= 0.001 THEN 0 ELSE v_rem END,
    'charge_id', v_charge_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_event_ticket_item(uuid, date, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_event_ticket_item(uuid, date, text, numeric) TO authenticated, service_role;
