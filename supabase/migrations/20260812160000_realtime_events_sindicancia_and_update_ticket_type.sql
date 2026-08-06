-- Realtime: comanda, tickets, votação sindicância
-- RPC atômica: update_sold_ticket_type (troca tipo + sync cobrança vendedor)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'Publication supabase_realtime não existe; pulando ADD TABLE.';
  ELSE
    BEGIN
      IF to_regclass('public.event_ticket_items') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.event_ticket_items;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      IF to_regclass('public.tickets') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      IF to_regclass('public.sindicancia_votes') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sindicancia_votes;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
    BEGIN
      IF to_regclass('public.sindicancia_details') IS NOT NULL THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sindicancia_details;
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;

  BEGIN
    ALTER TABLE IF EXISTS public.event_ticket_items REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.tickets REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.checkins REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.sindicancia_votes REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    ALTER TABLE IF EXISTS public.sindicancia_details REPLICA IDENTITY FULL;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.update_sold_ticket_type(
  _ticket_id uuid,
  _ticket_type_id uuid DEFAULT NULL,
  _price_paid numeric DEFAULT NULL
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
  v_has_charge boolean := false;
  v_type_price numeric(12,2);
  v_next_price numeric(12,2);
  v_charge_amt numeric(12,2);
  v_paid_sum numeric(12,2) := 0;
  v_next_charge_id uuid;
  v_new_charge_id uuid;
  v_desc text;
BEGIN
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
    RAISE EXCEPTION 'Sem permissão para alterar o tipo de ingresso (MC ou presidente da Com. Eventos)';
  END IF;

  v_type_price := NULL;
  IF _ticket_type_id IS NOT NULL THEN
    SELECT price INTO v_type_price
    FROM public.ticket_types
    WHERE id = _ticket_type_id AND event_id = v_ticket.event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tipo de ingresso inválido para este evento';
    END IF;
    v_type_price := COALESCE(v_type_price, 0);
  END IF;

  IF _price_paid IS NOT NULL THEN
    v_next_price := GREATEST(0, round(_price_paid, 2));
  ELSIF v_type_price IS NOT NULL THEN
    v_next_price := round(v_type_price, 2);
  ELSE
    v_next_price := COALESCE(v_ticket.price_paid, 0);
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

  IF v_next_price > 0 THEN
    IF v_has_charge THEN
      v_charge_amt := COALESCE(v_charge.amount, 0);

      IF v_charge.status = 'pago' AND v_charge_amt > 0 THEN
        -- Pagamento antecipado já quitado: preserva histórico e cria nova cobrança.
        UPDATE public.tickets
          SET seller_charge_id = NULL
          WHERE id = v_ticket.id;
        v_next_charge_id := NULL;

        IF v_ticket.seller_member_id IS NOT NULL THEN
          v_desc := format('Ingresso Evento %s - %s', v_event.name, v_ticket.buyer_name);
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
      v_desc := format('Ingresso Evento %s - %s', v_event.name, v_ticket.buyer_name);
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
    SELECT COALESCE(SUM(amount), 0) INTO v_paid_sum
    FROM public.member_charge_payments
    WHERE charge_id = v_charge.id;

    IF v_paid_sum > 0 OR (v_charge.status = 'pago' AND COALESCE(v_charge.amount, 0) > 0) THEN
      v_next_charge_id := NULL;
    ELSE
      DELETE FROM public.member_charge_payments WHERE charge_id = v_charge.id;
      DELETE FROM public.member_charges WHERE id = v_charge.id;
      v_next_charge_id := NULL;
    END IF;
  END IF;

  UPDATE public.tickets
    SET ticket_type_id = _ticket_type_id,
        price_paid = v_next_price,
        seller_charge_id = v_next_charge_id
    WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'ok', true,
    'price_paid', v_next_price,
    'seller_charge_id', v_next_charge_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_sold_ticket_type(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sold_ticket_type(uuid, uuid, numeric) TO authenticated, service_role;
