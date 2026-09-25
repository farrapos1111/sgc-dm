-- Ingresso já baixado: não apagar caixa ao editar preço para R$ 0 (ex.: tipo Custo).
-- Exige estorno explícito no fluxo de caixa.

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

  -- Já baixado + preço 0 (ex. tipo Custo): NÃO remove o caixa.
  -- Permite só trocar tipo/comprador mantendo o valor pago.
  IF v_has_charge THEN
    SELECT coalesce(sum(amount), 0) INTO v_paid_sum
    FROM public.member_charge_payments
    WHERE charge_id = v_charge.id
      AND deleted_at IS NULL;

    IF (v_charge.status = 'pago' OR v_paid_sum > 0.001)
       AND v_next_price <= 0.001
       AND coalesce(v_ticket.price_paid, 0) > 0.001 THEN
      v_next_price := round(coalesce(v_ticket.price_paid, 0), 2);
    END IF;

    IF (v_charge.status = 'pago' OR v_paid_sum > 0.001) AND v_next_price <= 0.001 THEN
      RAISE EXCEPTION
        'Ingresso já baixado no fluxo de caixa. Não é possível zerar o preço por aqui. Exclua o lançamento no fluxo de caixa para estornar, ou mantenha um valor maior que zero.';
    END IF;
  END IF;

  v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);

  IF v_next_price > 0 THEN
    IF v_has_charge THEN
      SELECT coalesce(sum(amount), 0) INTO v_paid_sum
      FROM public.member_charge_payments
      WHERE charge_id = v_charge.id
        AND deleted_at IS NULL;

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
    -- Preço 0 sem pagamento: só remove cobrança em aberto (nunca toca caixa)
    SELECT coalesce(sum(amount), 0) INTO v_paid_sum
    FROM public.member_charge_payments
    WHERE charge_id = v_charge.id
      AND deleted_at IS NULL;

    IF v_paid_sum > 0.001 OR v_charge.status = 'pago' THEN
      RAISE EXCEPTION
        'Ingresso já baixado no fluxo de caixa. Não é possível zerar o preço por aqui. Exclua o lançamento no fluxo de caixa para estornar, ou mantenha um valor maior que zero.';
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

REVOKE ALL ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) IS
  'Atualiza ingresso vendido. Se já baixado, ajusta cash_entry existente; nunca remove caixa ao zerar preço (use exclusão no fluxo).';
