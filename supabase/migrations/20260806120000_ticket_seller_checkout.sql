-- Vendedor do ingresso + cobrança no perfil; audit em adições de comanda

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS seller_member_id uuid
    REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_charge_id uuid
    REFERENCES public.member_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_seller_member_idx
  ON public.tickets (seller_member_id);
CREATE INDEX IF NOT EXISTS tickets_seller_charge_idx
  ON public.tickets (seller_charge_id);

-- Venda atômica: N ingressos + N cobranças vinculadas ao membro vendedor
CREATE OR REPLACE FUNCTION public.sell_event_tickets_with_charges(
  _event_id uuid,
  _seller_member_id uuid,
  _buyer_name text,
  _buyer_email text,
  _ticket_type_id uuid,
  _price_paid numeric,
  _quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_i integer;
  v_ticket_id uuid;
  v_charge_id uuid;
  v_qr text;
  v_buyer text;
  v_desc text;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 50 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  IF _price_paid IS NULL OR _price_paid < 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;
  v_buyer := trim(_buyer_name);
  IF v_buyer IS NULL OR length(v_buyer) < 2 THEN
    RAISE EXCEPTION 'Nome do comprador inválido';
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
    RAISE EXCEPTION 'Sem permissão para vender ingresso';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE id = _seller_member_id
    AND chapter_id = v_event.chapter_id
    AND status = 'regular';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendedor inválido neste capítulo';
  END IF;

  IF _ticket_type_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ticket_types
      WHERE id = _ticket_type_id AND event_id = _event_id
    ) THEN
      RAISE EXCEPTION 'Tipo de ingresso inválido';
    END IF;
  END IF;

  v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);

  FOR v_i IN 1.._quantity LOOP
    INSERT INTO public.member_charges (
      chapter_id, member_id, kind, category, subcategory, description,
      amount, due_date, status, created_by
    ) VALUES (
      v_event.chapter_id,
      _seller_member_id,
      'entrada',
      'Eventos',
      v_event.name,
      v_desc,
      round(_price_paid, 2),
      (timezone('America/Sao_Paulo', now()))::date,
      'em_aberto',
      auth.uid()
    )
    RETURNING id INTO v_charge_id;

    INSERT INTO public.tickets (
      event_id, ticket_type_id, buyer_name, buyer_email, price_paid,
      sold_by, seller_member_id, seller_charge_id
    ) VALUES (
      _event_id,
      _ticket_type_id,
      v_buyer,
      NULLIF(trim(_buyer_email), ''),
      round(_price_paid, 2),
      auth.uid(),
      _seller_member_id,
      v_charge_id
    )
    RETURNING id, qr_code INTO v_ticket_id, v_qr;

    v_rows := v_rows || jsonb_build_array(
      jsonb_build_object(
        'id', v_ticket_id,
        'qr_code', v_qr,
        'buyer_name', v_buyer,
        'seller_charge_id', v_charge_id
      )
    );
  END LOOP;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.sell_event_tickets_with_charges(
  uuid, uuid, text, text, uuid, numeric, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_event_tickets_with_charges(
  uuid, uuid, text, text, uuid, numeric, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_event_tickets_with_charges(
  uuid, uuid, text, text, uuid, numeric, integer
) TO service_role;

-- Audit em cada adição de item na comanda
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
  v_cash_id uuid;
  v_line_id uuid;
  v_desc text;
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

  v_desc := COALESCE(
    NULLIF(trim(_description), ''),
    format('Comanda %s · %s × %s', v_ticket.buyer_name, v_item.name, _qty::text)
  );

  INSERT INTO public.cash_entries (
    chapter_id, kind, category, subcategory, description, amount, entry_date,
    event_id, event_finance_item_id, created_by
  ) VALUES (
    v_event.chapter_id, 'entrada', 'Eventos', v_item.name, v_desc, v_amount,
    (timezone('America/Sao_Paulo', now()))::date,
    v_event.id, v_item.id, auth.uid()
  )
  RETURNING id INTO v_cash_id;

  INSERT INTO public.event_ticket_items (
    event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_by
  ) VALUES (
    v_event.id, v_ticket.id, v_item.id, _qty, v_price, v_amount, v_cash_id, auth.uid()
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
      'event_name', v_event.name
    )
  );

  RETURN jsonb_build_object(
    'id', v_line_id,
    'cash_entry_id', v_cash_id,
    'amount', v_amount,
    'unit_price', v_price,
    'qty', _qty
  );
END;
$$;
