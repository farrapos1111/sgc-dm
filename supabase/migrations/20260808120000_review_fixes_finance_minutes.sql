-- Review fixes: patch_chapter_settings allowlist, checkout atômico,
-- guarda de comanda paga, estoque de tipos, item inativo em update,
-- remoção do fallback de senha pública "senha".

CREATE OR REPLACE FUNCTION public.patch_chapter_settings(
  _chapter_id uuid,
  _patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_key text;
  v_val jsonb;
  v_old jsonb;
  v_allowed text[] := ARRAY[
    'sindicancia_chave_template',
    'sindicancia_parecer_template',
    'pix_key',
    'pix_qr_path',
    'chave_template',
    'minute_passwords'
  ];
BEGIN
  IF NOT (
    public.has_permission(_chapter_id, 'admin')
    OR public.has_permission(_chapter_id, 'tesouraria')
    OR public.has_any_role(
      _chapter_id,
      ARRAY[
        'mestre_conselheiro',
        'admin_total',
        'escrivao',
        'presidente_conselho',
        'tesoureiro'
      ]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar configurações'
      USING ERRCODE = '42501';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch inválido';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Chave de configuração não permitida: %', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT coalesce(c.settings, '{}'::jsonb)
  INTO v_settings
  FROM public.chapters c
  WHERE c.id = _chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    v_old := v_settings -> v_key;

    IF v_val IS NULL
       OR v_val = 'null'::jsonb
       OR v_val = '""'::jsonb
    THEN
      v_settings := v_settings - v_key;
    ELSE
      v_settings := jsonb_set(v_settings, ARRAY[v_key], v_val, true);
    END IF;

    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      _chapter_id,
      auth.uid(),
      'settings_patch',
      'chapters',
      _chapter_id,
      jsonb_build_object(
        'key', v_key,
        'old', v_old,
        'new', CASE
          WHEN v_val IS NULL OR v_val = 'null'::jsonb OR v_val = '""'::jsonb
          THEN NULL
          ELSE v_val
        END
      )
    );
  END LOOP;

  UPDATE public.chapters
  SET settings = v_settings
  WHERE id = _chapter_id;

  RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.minute_expected_public_password(
  _settings jsonb,
  _kind public.minute_kind
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text := _kind::text;
  v_pass text;
BEGIN
  v_pass := nullif(
    trim(coalesce((_settings -> 'minute_passwords' ->> v_kind), '')),
    ''
  );
  RETURN v_pass;
END;
$function$;

CREATE OR REPLACE FUNCTION public.checkout_event_ticket_comanda(
  _event_id uuid,
  _ticket_id uuid,
  _paid_at date DEFAULT NULL
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
  v_paid_at date := coalesce(
    _paid_at,
    (timezone('America/Sao_Paulo', now()))::date
  );
  v_already numeric(12,2) := 0;
  v_remaining numeric(12,2) := 0;
  v_entry_id uuid;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id
    AND event_id = _event_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso não encontrado';
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
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
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
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;

  INSERT INTO public.cash_entries (
    chapter_id, kind, category, subcategory, description, amount, entry_date,
    created_by, event_id
  ) VALUES (
    v_event.chapter_id,
    v_charge.kind,
    v_charge.category,
    v_charge.subcategory,
    v_charge.description,
    v_remaining,
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
    v_remaining,
    v_paid_at,
    v_entry_id,
    'Checkout comanda / quitação ingresso',
    auth.uid()
  );

  UPDATE public.member_charges
    SET status = 'pago',
        paid_at = v_paid_at,
        cash_entry_id = v_entry_id
    WHERE id = v_charge.id;

  RETURN jsonb_build_object('ok', true, 'already_paid', false);
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_event_ticket_comanda(uuid, uuid, date) TO service_role;

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
  v_type public.ticket_types%ROWTYPE;
  v_issued integer := 0;
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

  IF v_ticket.seller_charge_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.member_charges
       WHERE id = v_ticket.seller_charge_id AND status = 'pago'
     )
  THEN
    RAISE EXCEPTION 'Comanda já quitada — não é possível alterar';
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
  v_desc text;
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
  IF v_ticket.seller_charge_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.member_charges
       WHERE id = v_ticket.seller_charge_id AND status = 'pago'
     )
  THEN
    RAISE EXCEPTION 'Comanda já quitada — não é possível alterar';
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
  v_desc := format(
    'Comanda %s · %s × %s',
    COALESCE(v_ticket.buyer_name, 'participante'),
    v_item.name,
    v_new_qty::text
  );

  UPDATE public.event_ticket_items
    SET qty = v_new_qty,
        unit_price = v_new_price,
        amount = v_new_amount
    WHERE id = v_line.id;

  IF v_line.cash_entry_id IS NOT NULL THEN
    UPDATE public.cash_entries
      SET amount = v_new_amount,
          subcategory = v_item.name,
          description = v_desc,
          event_finance_item_id = v_item.id,
          event_id = v_event.id
      WHERE id = v_line.cash_entry_id;
  END IF;

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
  IF v_ticket.seller_charge_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.member_charges
       WHERE id = v_ticket.seller_charge_id AND status = 'pago'
     )
  THEN
    RAISE EXCEPTION 'Comanda já quitada — não é possível alterar';
  END IF;

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

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  RETURN jsonb_build_object('ok', true, 'id', _line_id);
END;
$$;
