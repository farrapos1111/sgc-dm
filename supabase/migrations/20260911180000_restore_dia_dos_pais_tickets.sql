-- Restaura ingressos/comandas do evento Dia dos Pais a partir do audit_logs.
-- Pagamentos: religa cash_entry_id existente; se o lançamento foi excluído,
-- cria placeholder amount=0 (marcado) só para FK/status "pago" — sem reinflar o caixa.

DO $$
DECLARE
  v_event_id uuid := '725b06df-0076-408b-8364-ecd14f2688b1';
  v_chapter_id uuid;
  v_cat_bar uuid;
  v_ticket record;
  v_type_id uuid;
  v_add record;
  v_pay record;
  v_line public.event_ticket_items%ROWTYPE;
  v_cash_id uuid;
  v_cash_exists boolean;
  v_del_kind text;
  v_del_category text;
  v_del_subcategory text;
  v_del_description text;
  v_del_entry_date date;
  v_rem numeric;
  v_tickets_n int := 0;
  v_items_n int := 0;
  v_paid_n int := 0;
  v_placeholder_n int := 0;
BEGIN
  SELECT chapter_id INTO v_chapter_id FROM public.events WHERE id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Evento Dia dos Pais não encontrado';
  END IF;

  -- Idempotência: se já há tickets restaurados, aborta
  IF EXISTS (SELECT 1 FROM public.tickets WHERE event_id = v_event_id) THEN
    RAISE EXCEPTION 'Evento já possui ingressos; restore abortado (rode só com tabela vazia)';
  END IF;

  ALTER TABLE public.tickets DISABLE TRIGGER tickets_audit;
  ALTER TABLE public.cash_entries DISABLE TRIGGER cash_entries_audit;

  -- Recria itens de comanda apagados (Refri / Vinho) com os UUIDs originais
  SELECT id INTO v_cat_bar
  FROM public.event_finance_categories
  WHERE event_id = v_event_id
    AND name_key = public.finance_name_key('Bar / Bebidas (restaurado)')
  LIMIT 1;

  IF v_cat_bar IS NULL THEN
    INSERT INTO public.event_finance_categories (event_id, chapter_id, name, sort_order)
    VALUES (v_event_id, v_chapter_id, 'Bar / Bebidas (restaurado)', 50)
    RETURNING id INTO v_cat_bar;
  END IF;

  INSERT INTO public.event_finance_items (
    id, category_id, event_id, chapter_id, name, unit_price, track_stock, stock_qty, active
  ) VALUES
    ('9bc478a5-c74c-41ff-ac92-82ae8086505b', v_cat_bar, v_event_id, v_chapter_id, 'Refri', 5, false, NULL, true),
    ('f8ca63cf-0cc8-4328-9708-0cddd16c111a', v_cat_bar, v_event_id, v_chapter_id, 'Vinho', 20, false, NULL, true)
  ON CONFLICT (id) DO NOTHING;

  -- 1) Ingressos a partir de ticket_delete
  FOR v_ticket IN
    SELECT DISTINCT ON ((old_value->>'ticket_id')::uuid)
      (old_value->>'ticket_id')::uuid AS ticket_id,
      old_value->>'buyer_name' AS buyer_name,
      COALESCE((old_value->>'price_paid')::numeric, 0) AS price_paid,
      COALESCE(old_value->>'status', 'valido') AS status,
      old_value->>'ticket_type_name' AS ticket_type_name,
      created_at
    FROM public.audit_logs
    WHERE action = 'ticket_delete'
      AND old_value->>'event_id' = v_event_id::text
    ORDER BY (old_value->>'ticket_id')::uuid, created_at
  LOOP
    SELECT id INTO v_type_id
    FROM public.ticket_types
    WHERE event_id = v_event_id
      AND name = v_ticket.ticket_type_name
    LIMIT 1;

    INSERT INTO public.tickets (
      id, event_id, ticket_type_id, buyer_name, buyer_email,
      status, price_paid, sold_at, seller_member_id, seller_charge_id
    ) VALUES (
      v_ticket.ticket_id,
      v_event_id,
      v_type_id,
      COALESCE(NULLIF(trim(v_ticket.buyer_name), ''), 'Sem nome'),
      NULL,
      v_ticket.status::public.ticket_status,
      v_ticket.price_paid,
      '2026-08-08 18:30:00-03'::timestamptz,
      NULL,
      NULL
    );
    v_tickets_n := v_tickets_n + 1;
  END LOOP;

  -- 2) Linhas de comanda a partir de comanda_item_add
  FOR v_add IN
    SELECT
      id AS audit_id,
      (new_value->>'ticket_id')::uuid AS ticket_id,
      (new_value->>'item_id')::uuid AS item_id,
      COALESCE((new_value->>'qty')::numeric, 1) AS qty,
      COALESCE((new_value->>'unit_price')::numeric, 0) AS unit_price,
      COALESCE((new_value->>'amount')::numeric, 0) AS amount,
      created_at
    FROM public.audit_logs
    WHERE action = 'comanda_item_add'
      AND new_value->>'event_id' = v_event_id::text
    ORDER BY created_at, id
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = v_add.ticket_id) THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_finance_items i WHERE i.id = v_add.item_id) THEN
      RAISE EXCEPTION 'Item de comanda % ausente', v_add.item_id;
    END IF;

    INSERT INTO public.event_ticket_items (
      event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_at
    ) VALUES (
      v_event_id,
      v_add.ticket_id,
      v_add.item_id,
      v_add.qty,
      v_add.unit_price,
      v_add.amount,
      NULL,
      v_add.created_at
    );
    v_items_n := v_items_n + 1;
  END LOOP;

  -- 3) Aplicar pagamentos (comanda_item_pay) sem criar entradas financeiras novas
  FOR v_pay IN
    SELECT
      a.id AS audit_id,
      (a.new_value->>'ticket_id')::uuid AS ticket_id,
      (a.new_value->>'item_id')::uuid AS item_id,
      COALESCE((a.new_value->>'amount')::numeric, 0) AS amount,
      (a.new_value->>'cash_entry_id')::uuid AS cash_entry_id,
      a.new_value->>'item_name' AS item_name,
      a.new_value->>'paid_at' AS paid_at,
      a.new_value->>'tender' AS tender,
      a.created_at
    FROM public.audit_logs a
    WHERE a.action = 'comanda_item_pay'
      AND a.new_value->>'ticket_id' IN (
        SELECT old_value->>'ticket_id'
        FROM public.audit_logs
        WHERE action = 'ticket_delete'
          AND old_value->>'event_id' = v_event_id::text
      )
    ORDER BY a.created_at, a.id
  LOOP
    -- Linha ainda não paga, preferindo match de amount
    SELECT * INTO v_line
    FROM public.event_ticket_items eti
    WHERE eti.ticket_id = v_pay.ticket_id
      AND eti.item_id = v_pay.item_id
      AND eti.cash_entry_id IS NULL
    ORDER BY
      CASE WHEN eti.amount = v_pay.amount THEN 0 ELSE 1 END,
      eti.created_at,
      eti.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      -- fallback: qualquer linha do ticket/item (já paga parcialmente?)
      CONTINUE;
    END IF;

    v_cash_id := v_pay.cash_entry_id;
    SELECT EXISTS (
      SELECT 1 FROM public.cash_entries ce WHERE ce.id = v_cash_id
    ) INTO v_cash_exists;

    IF NOT v_cash_exists THEN
      -- Placeholder amount=0: status pago na comanda sem reinflar o caixa
      SELECT
        old_value->>'kind',
        old_value->>'category',
        old_value->>'subcategory',
        old_value->>'description',
        NULLIF(old_value->>'entry_date', '')::date
      INTO
        v_del_kind,
        v_del_category,
        v_del_subcategory,
        v_del_description,
        v_del_entry_date
      FROM public.audit_logs
      WHERE action = 'cash_entry_delete'
        AND record_id = v_cash_id
      ORDER BY created_at DESC
      LIMIT 1;

      INSERT INTO public.cash_entries (
        id, chapter_id, kind, category, subcategory, description,
        amount, entry_date, event_id, event_finance_item_id, qty
      ) VALUES (
        v_cash_id,
        v_chapter_id,
        COALESCE(v_del_kind, 'entrada')::public.cash_entry_kind,
        COALESCE(v_del_category, 'Eventos'),
        v_del_subcategory,
        format(
          '[restaurado-sem-reentrada] %s',
          COALESCE(v_del_description, v_pay.item_name, 'Comanda')
        ),
        0,
        COALESCE(v_del_entry_date, NULLIF(v_pay.paid_at, '')::date, DATE '2026-08-08'),
        v_event_id,
        v_pay.item_id,
        NULL
      );
      v_placeholder_n := v_placeholder_n + 1;
    END IF;

    IF v_pay.amount > 0 AND v_pay.amount < v_line.amount - 0.001 THEN
      v_rem := v_line.amount - v_pay.amount;
      UPDATE public.event_ticket_items
      SET amount = v_pay.amount,
          cash_entry_id = v_cash_id
      WHERE id = v_line.id;

      INSERT INTO public.event_ticket_items (
        event_id, ticket_id, item_id, qty, unit_price, amount, cash_entry_id, created_at
      ) VALUES (
        v_event_id,
        v_line.ticket_id,
        v_line.item_id,
        GREATEST(v_line.qty * (v_rem / NULLIF(v_line.amount, 0)), 0.01),
        v_line.unit_price,
        v_rem,
        NULL,
        v_line.created_at
      );
    ELSE
      UPDATE public.event_ticket_items
      SET cash_entry_id = v_cash_id,
          amount = CASE
            WHEN v_pay.amount > 0 THEN v_pay.amount
            ELSE amount
          END
      WHERE id = v_line.id;
    END IF;

    v_paid_n := v_paid_n + 1;
  END LOOP;

  ALTER TABLE public.tickets ENABLE TRIGGER tickets_audit;
  ALTER TABLE public.cash_entries ENABLE TRIGGER cash_entries_audit;

  RAISE NOTICE
    'Restore Dia dos Pais: tickets=%, itens_comanda=%, pagamentos_aplicados=%, placeholders_caixa_0=%',
    v_tickets_n, v_items_n, v_paid_n, v_placeholder_n;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.tickets ENABLE TRIGGER tickets_audit;
    ALTER TABLE public.cash_entries ENABLE TRIGGER cash_entries_audit;
    RAISE;
END $$;
