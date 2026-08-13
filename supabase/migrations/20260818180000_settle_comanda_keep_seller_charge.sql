-- Saldo parcial permanece na cobrança do vendedor (histórico de pago parcial).

CREATE OR REPLACE FUNCTION public.settle_event_ticket_comanda(
  _event_id uuid,
  _ticket_id uuid,
  _paid_at date DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _tender text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_charge public.member_charges%ROWTYPE;
  v_line public.event_ticket_items%ROWTYPE;
  v_paid_at date := coalesce(
    _paid_at,
    (timezone('America/Sao_Paulo', now()))::date
  );
  v_tender text := lower(nullif(trim(coalesce(_tender, '')), ''));
  v_has_charge boolean := false;
  v_ticket_due numeric(12,2) := 0;
  v_items_due numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_pay numeric(12,2) := 0;
  v_alloc numeric(12,2) := 0;
  v_ticket_pay numeric(12,2) := 0;
  v_items_pay numeric(12,2) := 0;
  v_paid_sum numeric(12,2) := 0;
  v_ticket_left numeric(12,2) := 0;
  v_items_left numeric(12,2) := 0;
  v_rem numeric(12,2) := 0;
  v_ticket_cash_id uuid;
  v_items_cash_id uuid;
  v_charge_id uuid;
  v_item_ids uuid[] := '{}';
  v_desc text;
  v_buyer text;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id AND event_id = _event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  PERFORM public.require_ticket_checkin(_ticket_id);

  SELECT * INTO v_event FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  IF NOT (
    public.has_permission(v_event.chapter_id, 'admin')
    OR public.has_permission(v_event.chapter_id, 'tesouraria')
    OR public.can_manage_commission(v_event.chapter_id, 'eventos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar o pagamento';
  END IF;

  v_buyer := coalesce(nullif(trim(v_ticket.buyer_name), ''), 'participante');

  IF v_ticket.seller_charge_id IS NOT NULL THEN
    SELECT * INTO v_charge
    FROM public.member_charges
    WHERE id = v_ticket.seller_charge_id
      AND chapter_id = v_event.chapter_id
    FOR UPDATE;
    IF FOUND AND v_charge.status <> 'isento' THEN
      v_has_charge := true;
      v_charge_id := v_charge.id;
      SELECT coalesce(sum(amount), 0) INTO v_paid_sum
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id;
      IF v_charge.status = 'pago' THEN
        v_ticket_due := 0;
      ELSE
        v_ticket_due := greatest(0, round(coalesce(v_charge.amount, 0) - v_paid_sum, 2));
      END IF;
    END IF;
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_items_due
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id
    AND event_id = _event_id
    AND cash_entry_id IS NULL;

  v_total := round(v_ticket_due + v_items_due, 2);
  IF v_total <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'fully_paid', true, 'amount', 0, 'remaining', 0);
  END IF;

  IF _amount IS NULL THEN
    v_pay := v_total;
  ELSE
    IF _amount <= 0 THEN
      RAISE EXCEPTION 'Valor de pagamento inválido';
    END IF;
    v_pay := least(v_total, round(_amount, 2));
  END IF;

  v_alloc := v_pay;
  IF v_has_charge AND v_ticket_due > 0 AND v_alloc > 0 THEN
    v_ticket_pay := least(v_alloc, v_ticket_due);
    v_alloc := round(v_alloc - v_ticket_pay, 2);
  END IF;

  FOR v_line IN
    SELECT *
    FROM public.event_ticket_items
    WHERE ticket_id = _ticket_id
      AND event_id = _event_id
      AND cash_entry_id IS NULL
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_alloc <= 0.001;
    IF v_line.amount <= v_alloc + 0.001 THEN
      v_item_ids := array_append(v_item_ids, v_line.id);
      v_items_pay := round(v_items_pay + v_line.amount, 2);
      v_alloc := round(v_alloc - v_line.amount, 2);
    ELSE
      EXIT;
    END IF;
  END LOOP;

  IF v_ticket_pay > 0.001 THEN
    v_desc := coalesce(
      nullif(trim(v_charge.description), ''),
      format('Ingresso %s · %s', v_event.name, v_buyer)
    );
    IF v_tender IN ('dinheiro', 'especie') THEN
      v_desc := v_desc || ' (espécie)';
    END IF;
    INSERT INTO public.cash_entries (
      chapter_id, kind, category, subcategory, description, amount, entry_date,
      created_by, event_id
    ) VALUES (
      v_event.chapter_id,
      'entrada',
      'Eventos',
      v_event.name,
      v_desc,
      v_ticket_pay,
      v_paid_at,
      auth.uid(),
      _event_id
    )
    RETURNING id INTO v_ticket_cash_id;

    INSERT INTO public.member_charge_payments (
      chapter_id, charge_id, amount, paid_at, cash_entry_id, notes, created_by
    ) VALUES (
      v_event.chapter_id,
      v_charge.id,
      v_ticket_pay,
      v_paid_at,
      v_ticket_cash_id,
      'Recibo comanda',
      auth.uid()
    );

    v_ticket_due := round(v_ticket_due - v_ticket_pay, 2);
    IF v_ticket_due <= 0.001 THEN
      UPDATE public.member_charges
        SET status = 'pago',
            paid_at = v_paid_at,
            cash_entry_id = v_ticket_cash_id
        WHERE id = v_charge.id;
      v_ticket_due := 0;
    END IF;
  END IF;

  IF v_items_pay > 0.001 THEN
    v_desc := format('Comanda %s · %s', v_event.name, v_buyer);
    IF v_tender IN ('dinheiro', 'especie') THEN
      v_desc := v_desc || ' (espécie)';
    END IF;
    INSERT INTO public.cash_entries (
      chapter_id, kind, category, subcategory, description, amount, entry_date,
      created_by, event_id
    ) VALUES (
      v_event.chapter_id,
      'entrada',
      'Eventos',
      v_event.name,
      v_desc,
      v_items_pay,
      v_paid_at,
      auth.uid(),
      _event_id
    )
    RETURNING id INTO v_items_cash_id;

    UPDATE public.event_ticket_items
      SET cash_entry_id = v_items_cash_id
      WHERE id = ANY (v_item_ids);
  END IF;

  v_ticket_left := v_ticket_due;
  SELECT coalesce(sum(amount), 0) INTO v_items_left
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id
    AND event_id = _event_id
    AND cash_entry_id IS NULL;
  v_rem := round(v_ticket_left + v_items_left, 2);

  IF v_rem > 0.001 THEN
    IF v_ticket.seller_member_id IS NULL THEN
      RAISE EXCEPTION 'Informe o vendedor para gerar a cobrança do saldo';
    END IF;

    IF v_has_charge THEN
      IF v_items_left > 0.001 THEN
        UPDATE public.member_charges
          SET amount = round(coalesce(amount, 0) + v_items_left, 2),
              status = 'em_aberto',
              paid_at = NULL,
              cash_entry_id = NULL
          WHERE id = v_charge.id;
      END IF;
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

    DELETE FROM public.event_ticket_items
    WHERE ticket_id = _ticket_id
      AND event_id = _event_id
      AND cash_entry_id IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'fully_paid', v_rem <= 0.001,
    'amount', v_pay,
    'remaining', CASE WHEN v_rem <= 0.001 THEN 0 ELSE v_rem END,
    'charge_id', v_charge_id
  );
END;
$$;
