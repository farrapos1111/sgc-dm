-- Forward fixes: redact minute_passwords in audit, reject canceled tickets on
-- checkout, audit comanda update/delete. update_event_ticket_item continues to
-- allow inactive finance items so legacy comanda lines remain editable.

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
        'old', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
          ELSE v_old
        END,
        'new', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
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
  IF v_ticket.status = 'cancelado' THEN
    RAISE EXCEPTION 'Ingresso cancelado';
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

  -- Itens inativos são permitidos na atualização para corrigir linhas antigas.
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
      )
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

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'comanda_item_delete',
    'event_ticket_items',
    v_line.id,
    jsonb_build_object(
      'ticket_id', v_line.ticket_id,
      'item_id', v_line.item_id,
      'qty', v_line.qty,
      'unit_price', v_line.unit_price,
      'amount', v_line.amount,
      'cash_entry_id', v_line.cash_entry_id
    )
  );

  IF v_line.cash_entry_id IS NOT NULL THEN
    DELETE FROM public.cash_entries WHERE id = v_line.cash_entry_id;
  END IF;

  DELETE FROM public.event_ticket_items WHERE id = v_line.id;

  RETURN jsonb_build_object('ok', true, 'id', _line_id);
END;
$$;
