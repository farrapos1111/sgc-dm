-- Free tickets must not create member_charges; clean existing R$ 0 orphans.

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
SET search_path TO 'public'
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_type public.ticket_types%ROWTYPE;
  v_issued integer := 0;
  v_i integer;
  v_ticket_id uuid;
  v_charge_id uuid;
  v_qr text;
  v_buyer text;
  v_desc text;
  v_price numeric(12,2);
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
    SELECT * INTO v_type
    FROM public.ticket_types
    WHERE id = _ticket_type_id
      AND event_id = _event_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tipo de ingresso inválido';
    END IF;

    IF coalesce(v_type.quantity_total, 0) > 0 THEN
      SELECT count(*)::integer INTO v_issued
      FROM public.tickets
      WHERE ticket_type_id = _ticket_type_id
        AND status <> 'cancelado';
      IF (v_type.quantity_total - v_issued) < _quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente do tipo de ingresso (disponível: %)',
          greatest(v_type.quantity_total - v_issued, 0);
      END IF;
    END IF;
  END IF;

  v_price := round(_price_paid, 2);
  v_desc := format('Ingresso Evento %s - %s', v_event.name, v_buyer);

  FOR v_i IN 1.._quantity LOOP
    v_charge_id := NULL;

    IF v_price >= 0.01 THEN
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
        v_price,
        (timezone('America/Sao_Paulo', now()))::date,
        'em_aberto',
        auth.uid()
      )
      RETURNING id INTO v_charge_id;
    END IF;

    INSERT INTO public.tickets (
      event_id, ticket_type_id, buyer_name, buyer_email, price_paid,
      sold_by, seller_member_id, seller_charge_id
    ) VALUES (
      _event_id,
      _ticket_type_id,
      v_buyer,
      NULLIF(trim(_buyer_email), ''),
      v_price,
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

-- Remove cobranças R$ 0 sem pagamentos (ingressos gratuitos legado).
UPDATE public.tickets t
SET seller_charge_id = NULL
FROM public.member_charges c
WHERE t.seller_charge_id = c.id
  AND coalesce(c.amount, 0) < 0.01
  AND NOT EXISTS (
    SELECT 1 FROM public.member_charge_payments p WHERE p.charge_id = c.id
  );

DELETE FROM public.member_charges c
WHERE coalesce(c.amount, 0) < 0.01
  AND NOT EXISTS (
    SELECT 1 FROM public.member_charge_payments p WHERE p.charge_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.seller_charge_id = c.id
  );
