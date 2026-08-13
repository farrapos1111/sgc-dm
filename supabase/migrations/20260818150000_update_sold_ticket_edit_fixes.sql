-- Editar ingresso: vendedor anulável, tipo explícito; remove RPC legado.

DROP FUNCTION IF EXISTS public.update_sold_ticket_type(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.update_sold_ticket(uuid, text, uuid, uuid, numeric);

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
  v_charge_amt numeric(12,2);
  v_paid_sum numeric(12,2) := 0;
  v_next_charge_id uuid;
  v_new_charge_id uuid;
  v_desc text;
  v_buyer text;
BEGIN
  v_buyer := trim(coalesce(_buyer_name, ''));
  IF length(v_buyer) < 2 THEN
    RAISE EXCEPTION 'Nome do comprador inválido';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
  END IF;
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível alterar ingresso cancelado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
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

  v_next_charge_id := v_ticket.seller_charge_id;

  IF v_ticket.seller_charge_id IS NOT NULL THEN
    SELECT * INTO v_charge
    FROM public.member_charges
    WHERE id = v_ticket.seller_charge_id
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
      WHERE charge_id = v_charge.id;

      IF v_paid_sum > 0 OR (v_charge.status = 'pago' AND coalesce(v_charge.amount, 0) > 0) THEN
        RAISE EXCEPTION 'Não é possível trocar o vendedor após pagamento da cobrança';
      END IF;

      IF _seller_member_id IS NULL THEN
        DELETE FROM public.member_charge_payments WHERE charge_id = v_charge.id;
        DELETE FROM public.member_charges WHERE id = v_charge.id;
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
    WHERE id = _ticket_type_id AND event_id = v_ticket.event_id;
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

  IF v_next_price > 0 THEN
    IF v_has_charge THEN
      v_charge_amt := coalesce(v_charge.amount, 0);

      IF v_charge.status = 'pago' AND v_charge_amt > 0 THEN
        UPDATE public.tickets
          SET seller_charge_id = NULL
          WHERE id = v_ticket.id;
        v_next_charge_id := NULL;
        v_has_charge := false;

        IF v_ticket.seller_member_id IS NOT NULL THEN
          v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);
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
            (timezone('America/Sao_Paulo', now()))::date,
            'em_aberto',
            auth.uid()
          )
          RETURNING id INTO v_new_charge_id;
          v_next_charge_id := v_new_charge_id;
          v_has_charge := true;
        END IF;
      ELSE
        UPDATE public.member_charges
          SET amount = v_next_price,
              status = CASE
                WHEN status = 'pago' THEN 'em_aberto'
                ELSE status
              END,
              paid_at = CASE WHEN status = 'pago' THEN NULL ELSE paid_at END,
              cash_entry_id = CASE WHEN status = 'pago' THEN NULL ELSE cash_entry_id END
          WHERE id = v_charge.id;
        v_next_charge_id := v_charge.id;
      END IF;
    ELSIF v_ticket.seller_member_id IS NOT NULL THEN
      v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);
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
        (timezone('America/Sao_Paulo', now()))::date,
        'em_aberto',
        auth.uid()
      )
      RETURNING id INTO v_new_charge_id;
      v_next_charge_id := v_new_charge_id;
    END IF;
  ELSIF v_has_charge THEN
    SELECT coalesce(sum(amount), 0) INTO v_paid_sum
    FROM public.member_charge_payments
    WHERE charge_id = v_charge.id;

    IF v_paid_sum > 0 OR (v_charge.status = 'pago' AND coalesce(v_charge.amount, 0) > 0) THEN
      v_next_charge_id := NULL;
    ELSE
      DELETE FROM public.member_charge_payments WHERE charge_id = v_charge.id;
      DELETE FROM public.member_charges WHERE id = v_charge.id;
      v_next_charge_id := NULL;
    END IF;
  END IF;

  v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);

  UPDATE public.tickets
    SET ticket_type_id = _ticket_type_id,
        price_paid = v_next_price,
        seller_charge_id = v_next_charge_id,
        buyer_name = v_buyer,
        seller_member_id = _seller_member_id
    WHERE id = v_ticket.id;

  IF v_next_charge_id IS NOT NULL THEN
    UPDATE public.member_charges
      SET description = v_desc
      WHERE id = v_next_charge_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'price_paid', v_next_price,
    'seller_charge_id', v_next_charge_id,
    'buyer_name', v_buyer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sold_ticket(uuid, text, uuid, uuid, numeric) TO authenticated, service_role;
