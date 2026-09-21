-- Ingressos baixados: editar atualiza charge/caixa (sem duplicar).
-- Baixas de comanda: reutilizam cash_entry ligado.
-- Limpeza conservadora de charges órfãs do bug update_sold_ticket.

-- ---------------------------------------------------------------------------
-- 1) update_sold_ticket: nunca orphan + nova charge quando já pago
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sold_ticket(
  _ticket_id uuid,
  _buyer_name text,
  _seller_member_id uuid,
  _ticket_type_id uuid,
  _price_paid numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_seller public.members%ROWTYPE;
  v_charge public.member_charges%ROWTYPE;
  v_has_charge boolean := false;
  v_type_price numeric(12,2);
  v_next_price numeric(12,2);
  v_paid_sum numeric(12,2) := 0;
  v_next_charge_id uuid;
  v_new_charge_id uuid;
  v_desc text;
  v_buyer text;
  v_due date;
  v_pay_id uuid;
  v_cash_id uuid;
  v_pay_amt numeric(12,2);
  v_delta numeric(12,2);
  r record;
BEGIN
  v_buyer := trim(coalesce(_buyer_name, ''));
  IF length(v_buyer) < 2 THEN
    RAISE EXCEPTION 'Nome do comprador inválido';
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível alterar ingresso cancelado';
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_ticket.event_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento do ingresso inválido';
  END IF;

  IF NOT public.can_manage_event_destructive(v_event.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o ingresso (MC ou presidente da Com. Eventos)';
  END IF;

  IF _seller_member_id IS NOT NULL THEN
    SELECT * INTO v_seller
    FROM public.members
    WHERE id = _seller_member_id
      AND chapter_id = v_event.chapter_id
      AND status = 'regular';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vendedor inválido neste capítulo';
    END IF;
  END IF;

  v_due := (timezone('America/Sao_Paulo', v_event.starts_at))::date;
  v_next_charge_id := v_ticket.seller_charge_id;

  IF v_ticket.seller_charge_id IS NOT NULL THEN
    SELECT * INTO v_charge
    FROM public.member_charges
    WHERE id = v_ticket.seller_charge_id
      AND deleted_at IS NULL
    FOR UPDATE;
    IF FOUND THEN
      v_has_charge := true;
    ELSE
      v_next_charge_id := NULL;
    END IF;
  END IF;

  IF _seller_member_id IS DISTINCT FROM v_ticket.seller_member_id THEN
    IF v_has_charge THEN
      SELECT coalesce(sum(amount), 0) INTO v_paid_sum
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id
        AND deleted_at IS NULL;

      IF v_paid_sum > 0 OR (v_charge.status = 'pago' AND coalesce(v_charge.amount, 0) > 0) THEN
        RAISE EXCEPTION 'Não é possível trocar o vendedor após pagamento da cobrança';
      END IF;

      IF _seller_member_id IS NULL THEN
        UPDATE public.member_charge_payments
          SET deleted_at = now()
          WHERE charge_id = v_charge.id AND deleted_at IS NULL;
        UPDATE public.member_charges
          SET deleted_at = now()
          WHERE id = v_charge.id AND deleted_at IS NULL;
        v_has_charge := false;
        v_next_charge_id := NULL;
      ELSE
        UPDATE public.member_charges
          SET member_id = _seller_member_id
          WHERE id = v_charge.id;
      END IF;
    END IF;

    UPDATE public.tickets
      SET seller_member_id = _seller_member_id,
          seller_charge_id = v_next_charge_id
      WHERE id = v_ticket.id;
    v_ticket.seller_member_id := _seller_member_id;
    v_ticket.seller_charge_id := v_next_charge_id;
  END IF;

  v_type_price := NULL;
  IF _ticket_type_id IS NOT NULL THEN
    SELECT price INTO v_type_price
    FROM public.ticket_types
    WHERE id = _ticket_type_id
      AND event_id = v_ticket.event_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tipo de ingresso inválido para este evento';
    END IF;
    v_type_price := coalesce(v_type_price, 0);
  END IF;

  IF _price_paid IS NOT NULL THEN
    v_next_price := greatest(0, round(_price_paid, 2));
  ELSIF v_type_price IS NOT NULL THEN
    v_next_price := round(v_type_price, 2);
  ELSE
    v_next_price := coalesce(v_ticket.price_paid, 0);
  END IF;

  v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);

  IF v_next_price > 0 THEN
    IF v_has_charge THEN
      SELECT coalesce(sum(amount), 0) INTO v_paid_sum
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id
        AND deleted_at IS NULL;

      -- Charge já quitada (ou com pagamentos): atualiza o mesmo lançamento.
      IF v_charge.status = 'pago' OR v_paid_sum > 0.001 THEN
        UPDATE public.member_charges
          SET amount = v_next_price,
              due_date = v_due,
              description = v_desc,
              status = 'pago',
              paid_at = coalesce(paid_at, (timezone('America/Sao_Paulo', now()))::date)
          WHERE id = v_charge.id;

        v_delta := round(v_next_price - v_paid_sum, 2);

        IF abs(v_delta) > 0.001 THEN
          SELECT id, amount, cash_entry_id
            INTO v_pay_id, v_pay_amt, v_cash_id
          FROM public.member_charge_payments
          WHERE charge_id = v_charge.id
            AND deleted_at IS NULL
          ORDER BY paid_at DESC, created_at DESC
          LIMIT 1;

          IF v_pay_id IS NOT NULL THEN
            UPDATE public.member_charge_payments
              SET amount = greatest(0.01, round(v_pay_amt + v_delta, 2))
              WHERE id = v_pay_id;

            IF v_cash_id IS NOT NULL THEN
              UPDATE public.cash_entries
                SET amount = greatest(0.01, round(amount + v_delta, 2)),
                    description = v_desc
                WHERE id = v_cash_id
                  AND deleted_at IS NULL;
            END IF;
          ELSIF v_charge.cash_entry_id IS NOT NULL THEN
            UPDATE public.cash_entries
              SET amount = v_next_price,
                  description = v_desc
              WHERE id = v_charge.cash_entry_id
                AND deleted_at IS NULL;
          END IF;
        ELSE
          -- Só descrição / metadados
          UPDATE public.cash_entries ce
            SET description = v_desc
            WHERE ce.deleted_at IS NULL
              AND (
                ce.id = v_charge.cash_entry_id
                OR ce.id IN (
                  SELECT mcp.cash_entry_id
                  FROM public.member_charge_payments mcp
                  WHERE mcp.charge_id = v_charge.id
                    AND mcp.deleted_at IS NULL
                    AND mcp.cash_entry_id IS NOT NULL
                )
              );
        END IF;

        -- Garante cash_entry_id na charge
        IF v_charge.cash_entry_id IS NULL THEN
          SELECT cash_entry_id INTO v_cash_id
          FROM public.member_charge_payments
          WHERE charge_id = v_charge.id
            AND deleted_at IS NULL
            AND cash_entry_id IS NOT NULL
          ORDER BY paid_at DESC, created_at DESC
          LIMIT 1;
          IF v_cash_id IS NOT NULL THEN
            UPDATE public.member_charges
              SET cash_entry_id = v_cash_id
              WHERE id = v_charge.id;
          END IF;
        END IF;

        v_next_charge_id := v_charge.id;
      ELSE
        -- Em aberto sem pagamentos: só ajusta amount
        UPDATE public.member_charges
          SET amount = v_next_price,
              due_date = v_due,
              description = v_desc,
              status = 'em_aberto',
              paid_at = NULL,
              cash_entry_id = NULL
          WHERE id = v_charge.id;
        v_next_charge_id := v_charge.id;
      END IF;
    ELSIF v_ticket.seller_member_id IS NOT NULL THEN
      INSERT INTO public.member_charges (
        chapter_id, member_id, kind, category, subcategory, description,
        amount, due_date, status, created_by
      ) VALUES (
        v_event.chapter_id,
        v_ticket.seller_member_id,
        'entrada',
        'Eventos',
        v_event.name,
        v_desc,
        v_next_price,
        v_due,
        'em_aberto',
        auth.uid()
      )
      RETURNING id INTO v_new_charge_id;
      v_next_charge_id := v_new_charge_id;
    END IF;
  ELSIF v_has_charge THEN
    -- Preço 0: estorna caixa + payments + charge, sem órfão pago
    SELECT coalesce(sum(amount), 0) INTO v_paid_sum
    FROM public.member_charge_payments
    WHERE charge_id = v_charge.id
      AND deleted_at IS NULL;

    FOR r IN
      SELECT id, cash_entry_id
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id
        AND deleted_at IS NULL
    LOOP
      IF r.cash_entry_id IS NOT NULL THEN
        UPDATE public.cash_entries
          SET deleted_at = now()
          WHERE id = r.cash_entry_id
            AND deleted_at IS NULL;
      END IF;
      UPDATE public.member_charge_payments
        SET deleted_at = now()
        WHERE id = r.id
          AND deleted_at IS NULL;
    END LOOP;

    IF v_charge.cash_entry_id IS NOT NULL THEN
      UPDATE public.cash_entries
        SET deleted_at = now()
        WHERE id = v_charge.cash_entry_id
          AND deleted_at IS NULL;
    END IF;

    UPDATE public.member_charges
      SET deleted_at = now()
      WHERE id = v_charge.id
        AND deleted_at IS NULL;

    v_next_charge_id := NULL;
  END IF;

  UPDATE public.tickets
    SET ticket_type_id = _ticket_type_id,
        price_paid = v_next_price,
        seller_charge_id = v_next_charge_id,
        buyer_name = v_buyer,
        seller_member_id = _seller_member_id
    WHERE id = v_ticket.id;

  IF v_next_charge_id IS NOT NULL THEN
    UPDATE public.member_charges
      SET description = v_desc,
          due_date = v_due
      WHERE id = v_next_charge_id
        AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'price_paid', v_next_price,
    'seller_charge_id', v_next_charge_id,
    'buyer_name', v_buyer
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) checkout: se já houver cash na charge, UPDATE; senão INSERT
-- ---------------------------------------------------------------------------
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
  v_existing_pay_id uuid;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id
    AND event_id = _event_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  PERFORM public.require_ticket_checkin(_ticket_id);

  SELECT * INTO v_event
  FROM public.events
  WHERE id = _event_id AND deleted_at IS NULL;
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
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobranca nao encontrada';
  END IF;

  IF v_charge.status = 'pago' THEN
    -- Idempotente: garante descrição/valor alinhados ao ingresso
    v_cash_desc := coalesce(nullif(trim(v_charge.description), ''), 'Cobranca');
    IF v_charge.cash_entry_id IS NOT NULL THEN
      UPDATE public.cash_entries
        SET amount = coalesce(v_charge.amount, amount),
            description = v_cash_desc
        WHERE id = v_charge.cash_entry_id
          AND deleted_at IS NULL;
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'fully_paid', true);
  END IF;
  IF v_charge.status = 'isento' THEN
    RAISE EXCEPTION 'Cobranca isenta nao pode ser quitada no checkout';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_already
  FROM public.member_charge_payments
  WHERE charge_id = v_charge.id
    AND deleted_at IS NULL;

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

  -- Reusa cash_entry órfão já ligado à charge (legado) se ainda não tiver payment
  v_entry_id := NULL;
  IF v_charge.cash_entry_id IS NOT NULL AND v_already < 0.001 THEN
    SELECT id INTO v_entry_id
    FROM public.cash_entries
    WHERE id = v_charge.cash_entry_id
      AND deleted_at IS NULL;
    IF v_entry_id IS NOT NULL THEN
      UPDATE public.cash_entries
        SET amount = v_pay,
            description = v_cash_desc,
            entry_date = v_paid_at,
            event_id = _event_id
        WHERE id = v_entry_id;
    END IF;
  END IF;

  IF v_entry_id IS NULL THEN
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
  END IF;

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
  )
  RETURNING id INTO v_existing_pay_id;

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

-- ---------------------------------------------------------------------------
-- 3) settle: já pago = no-op; ticket cash reutiliza se charge.cash_entry_id
-- ---------------------------------------------------------------------------
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
  WHERE id = _ticket_id AND event_id = _event_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  PERFORM public.require_ticket_checkin(_ticket_id);

  SELECT * INTO v_event
  FROM public.events
  WHERE id = _event_id AND deleted_at IS NULL;
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
      AND deleted_at IS NULL
    FOR UPDATE;
    IF FOUND AND v_charge.status <> 'isento' THEN
      v_has_charge := true;
      v_charge_id := v_charge.id;
      SELECT coalesce(sum(amount), 0) INTO v_paid_sum
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id
        AND deleted_at IS NULL;
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
    AND cash_entry_id IS NULL
    AND deleted_at IS NULL;

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
      AND deleted_at IS NULL
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

    v_ticket_cash_id := NULL;
    IF v_charge.cash_entry_id IS NOT NULL AND v_paid_sum < 0.001 THEN
      SELECT id INTO v_ticket_cash_id
      FROM public.cash_entries
      WHERE id = v_charge.cash_entry_id
        AND deleted_at IS NULL;
      IF v_ticket_cash_id IS NOT NULL THEN
        UPDATE public.cash_entries
          SET amount = v_ticket_pay,
              description = v_desc,
              entry_date = v_paid_at,
              event_id = _event_id
          WHERE id = v_ticket_cash_id;
      END IF;
    END IF;

    IF v_ticket_cash_id IS NULL THEN
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
    END IF;

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
      WHERE id = ANY (v_item_ids)
        AND deleted_at IS NULL;
  END IF;

  v_ticket_left := v_ticket_due;
  SELECT coalesce(sum(amount), 0) INTO v_items_left
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id
    AND event_id = _event_id
    AND cash_entry_id IS NULL
    AND deleted_at IS NULL;
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

    UPDATE public.event_ticket_items
      SET deleted_at = now()
      WHERE ticket_id = _ticket_id
        AND event_id = _event_id
        AND cash_entry_id IS NULL
        AND deleted_at IS NULL;
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

-- ---------------------------------------------------------------------------
-- 4) pay_item: already_paid atualiza descrição; senão INSERT
-- ---------------------------------------------------------------------------
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
  SELECT * INTO v_line
  FROM public.event_ticket_items
  WHERE id = _line_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda não encontrado';
  END IF;

  SELECT * INTO v_item
  FROM public.event_finance_items
  WHERE id = v_line.item_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item financeiro não encontrado';
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = v_line.ticket_id AND deleted_at IS NULL;
  v_buyer := coalesce(nullif(trim(v_ticket.buyer_name), ''), 'participante');

  v_desc := format(
    'Comanda %s · %s × %s',
    v_buyer,
    v_item.name,
    v_line.qty::text
  );

  IF v_line.cash_entry_id IS NOT NULL THEN
    UPDATE public.cash_entries
      SET amount = v_line.amount,
          description = v_desc
      WHERE id = v_line.cash_entry_id
        AND deleted_at IS NULL;
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'cash_entry_id', v_line.cash_entry_id,
      'amount', v_line.amount,
      'remaining', 0
    );
  END IF;

  PERFORM public.require_ticket_checkin(v_line.ticket_id);

  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_line.event_id AND deleted_at IS NULL;
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

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = v_line.ticket_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
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
        AND deleted_at IS NULL
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

-- ---------------------------------------------------------------------------
-- 5) update_event_ticket_item: se baixado, UPDATE do cash_entry ligado
-- ---------------------------------------------------------------------------
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
  v_desc text;
  v_buyer text;
  v_shared integer;
BEGIN
  SELECT * INTO v_line
  FROM public.event_ticket_items
  WHERE id = _line_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda nao encontrado';
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = v_line.event_id AND deleted_at IS NULL;
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

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = v_line.ticket_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
  END IF;

  SELECT * INTO v_item
  FROM public.event_finance_items
  WHERE id = v_line.item_id
    AND deleted_at IS NULL
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

  -- Item já baixado: reflete no caixa (fonte da verdade)
  IF v_line.cash_entry_id IS NOT NULL THEN
    v_buyer := coalesce(nullif(trim(v_ticket.buyer_name), ''), 'participante');
    v_desc := format(
      'Comanda %s · %s × %s',
      v_buyer,
      v_item.name,
      v_new_qty::text
    );

    SELECT count(*)::integer INTO v_shared
    FROM public.event_ticket_items
    WHERE cash_entry_id = v_line.cash_entry_id
      AND deleted_at IS NULL;

    IF v_shared <= 1 THEN
      UPDATE public.cash_entries
        SET amount = v_new_amount,
            description = v_desc,
            event_finance_item_id = v_item.id
        WHERE id = v_line.cash_entry_id
          AND deleted_at IS NULL;
    ELSE
      -- Lote compartilhado (settle): ajusta o total do cash pela diferença
      UPDATE public.cash_entries
        SET amount = greatest(0.01, round(amount - v_line.amount + v_new_amount, 2))
        WHERE id = v_line.cash_entry_id
          AND deleted_at IS NULL;
    END IF;
  END IF;

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
      ),
      'cash_entry_id', v_line.cash_entry_id
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

REVOKE ALL ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.settle_event_ticket_comanda(uuid, uuid, date, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_event_ticket_comanda(uuid, uuid, date, numeric, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.pay_event_ticket_item(uuid, date, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_event_ticket_item(uuid, date, text, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_event_ticket_item(uuid, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_ticket_item(uuid, numeric, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Limpeza conservadora de fantasmas do bug update_sold_ticket
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_keep_paid numeric(12,2);
  v_orphan_cash uuid;
BEGIN
  FOR r IN
    WITH orphan_paid AS (
      SELECT
        mc.id AS orphan_id,
        mc.member_id,
        mc.chapter_id,
        mc.subcategory AS event_name,
        mc.cash_entry_id,
        mc.description,
        mc.amount
      FROM public.member_charges mc
      WHERE mc.deleted_at IS NULL
        AND mc.status = 'pago'
        AND mc.category = 'Eventos'
        AND mc.description ILIKE 'Ingresso Evento%'
        AND NOT EXISTS (
          SELECT 1
          FROM public.tickets t
          WHERE t.seller_charge_id = mc.id
            AND t.deleted_at IS NULL
        )
    )
    SELECT
      o.orphan_id,
      o.cash_entry_id AS orphan_cash_id,
      t.id AS ticket_id,
      t.seller_charge_id AS keep_charge_id,
      t.buyer_name,
      cur.status AS keep_status
    FROM orphan_paid o
    JOIN public.events e
      ON e.chapter_id = o.chapter_id
      AND e.name = o.event_name
      AND e.deleted_at IS NULL
    JOIN public.tickets t
      ON t.event_id = e.id
      AND t.seller_member_id = o.member_id
      AND t.deleted_at IS NULL
      AND t.seller_charge_id IS DISTINCT FROM o.orphan_id
      AND o.description ILIKE '%' || coalesce(nullif(trim(t.buyer_name), ''), '___nomatch___') || '%'
    JOIN public.member_charges cur
      ON cur.id = t.seller_charge_id
      AND cur.deleted_at IS NULL
    WHERE cur.category = 'Eventos'
  LOOP
    SELECT coalesce(sum(amount), 0) INTO v_keep_paid
    FROM public.member_charge_payments
    WHERE charge_id = r.keep_charge_id
      AND deleted_at IS NULL;

    IF v_keep_paid > 0.001 OR r.keep_status = 'pago' THEN
      -- Ticket já foi baixado de novo: soft-delete o órfão e seu caixa
      FOR v_orphan_cash IN
        SELECT DISTINCT x
        FROM unnest(ARRAY[
          r.orphan_cash_id,
          (SELECT mcp.cash_entry_id
           FROM public.member_charge_payments mcp
           WHERE mcp.charge_id = r.orphan_id
             AND mcp.deleted_at IS NULL
             AND mcp.cash_entry_id IS NOT NULL
           LIMIT 1)
        ]) AS x
        WHERE x IS NOT NULL
      LOOP
        UPDATE public.cash_entries
          SET deleted_at = now()
          WHERE id = v_orphan_cash
            AND deleted_at IS NULL;
      END LOOP;

      UPDATE public.member_charge_payments
        SET deleted_at = now()
        WHERE charge_id = r.orphan_id
          AND deleted_at IS NULL;

      UPDATE public.member_charges
        SET deleted_at = now()
        WHERE id = r.orphan_id
          AND deleted_at IS NULL;
    ELSE
      -- Charge nova em aberto sem pagamento: religa o ticket ao órfão pago
      UPDATE public.tickets
        SET seller_charge_id = r.orphan_id
        WHERE id = r.ticket_id
          AND deleted_at IS NULL;

      UPDATE public.member_charges
        SET deleted_at = now()
        WHERE id = r.keep_charge_id
          AND deleted_at IS NULL
          AND status = 'em_aberto'
          AND NOT EXISTS (
            SELECT 1
            FROM public.member_charge_payments mcp
            WHERE mcp.charge_id = r.keep_charge_id
              AND mcp.deleted_at IS NULL
          );
    END IF;
  END LOOP;
END;
$$;
