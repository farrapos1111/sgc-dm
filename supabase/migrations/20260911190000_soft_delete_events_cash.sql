-- Soft delete obrigatório para dados sensíveis de eventos/caixa.
-- DELETE físico é convertido em deleted_at = now() (exceto app.allow_hard_delete=true).

-- 1) Colunas
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.event_ticket_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.cash_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.member_charges ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.member_charge_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.ticket_types ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.event_tables ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.event_finance_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.event_finance_categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tickets_alive_event_idx
  ON public.tickets (event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_ticket_items_alive_ticket_idx
  ON public.event_ticket_items (ticket_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cash_entries_alive_chapter_idx
  ON public.cash_entries (chapter_id, entry_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS events_alive_chapter_idx
  ON public.events (chapter_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.tickets.deleted_at IS 'Soft delete; NULL = ativo';
COMMENT ON COLUMN public.cash_entries.deleted_at IS 'Soft delete; NULL = ativo no caixa';

-- 2) Converte DELETE → soft delete (protege SQL Editor / service role / RPC legado)
CREATE OR REPLACE FUNCTION public.tg_soft_delete_instead_of_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow text := current_setting('app.allow_hard_delete', true);
  v_chapter_id uuid;
  v_action text;
BEGIN
  IF v_allow = 'true' THEN
    RETURN OLD;
  END IF;

  IF OLD.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    TG_TABLE_NAME
  ) USING OLD.id;

  -- Auditoria mínima para tabelas de evento/caixa
  BEGIN
    IF TG_TABLE_NAME = 'tickets' THEN
      SELECT e.chapter_id INTO v_chapter_id
      FROM public.events e WHERE e.id = OLD.event_id;
      v_action := 'ticket_delete';
    ELSIF TG_TABLE_NAME = 'event_ticket_items' THEN
      SELECT e.chapter_id INTO v_chapter_id
      FROM public.events e WHERE e.id = OLD.event_id;
      v_action := 'comanda_item_delete';
    ELSIF TG_TABLE_NAME = 'cash_entries' THEN
      v_chapter_id := OLD.chapter_id;
      v_action := 'cash_entry_delete';
    ELSIF TG_TABLE_NAME = 'events' THEN
      v_chapter_id := OLD.chapter_id;
      v_action := 'event_delete';
    ELSIF TG_TABLE_NAME = 'ticket_types' THEN
      SELECT e.chapter_id INTO v_chapter_id
      FROM public.events e WHERE e.id = OLD.event_id;
      v_action := 'ticket_type_delete';
    ELSE
      v_chapter_id := NULL;
      v_action := TG_TABLE_NAME || '_delete';
    END IF;

    IF v_chapter_id IS NOT NULL THEN
      INSERT INTO public.audit_logs (
        chapter_id, user_id, action, table_name, record_id, old_value, new_value
      ) VALUES (
        v_chapter_id,
        auth.uid(),
        v_action,
        TG_TABLE_NAME,
        OLD.id,
        to_jsonb(OLD),
        jsonb_build_object('deleted_at', now(), 'soft', true)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nunca impedir soft delete por falha de audit
  END;

  RETURN NULL; -- cancela DELETE físico
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tickets',
    'event_ticket_items',
    'cash_entries',
    'member_charges',
    'member_charge_payments',
    'checkins',
    'ticket_types',
    'events',
    'event_tables',
    'event_finance_items',
    'event_finance_categories'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_soft_delete ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_soft_delete
         BEFORE DELETE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.tg_soft_delete_instead_of_hard_delete()',
      t, t
    );
  END LOOP;
END $$;

-- 3) RPCs: soft delete explícito (sem apagar caixa “de verdade”)
CREATE OR REPLACE FUNCTION public.delete_event_ticket_item(_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_qty_int integer;
BEGIN
  SELECT * INTO v_line
  FROM public.event_ticket_items
  WHERE id = _line_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da comanda nao encontrado';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_line.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF v_line.cash_entry_id IS NOT NULL THEN
    IF NOT public.can_manage_event_destructive(v_event.chapter_id) THEN
      RAISE EXCEPTION 'Sem permissao para remover item ja baixado no caixa';
    END IF;
  ELSIF NOT (
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
      'cash_entry_id', v_line.cash_entry_id,
      'soft', true
    )
  );

  -- Soft delete do item; se baixado, soft delete do lançamento (sai do caixa sem sumir)
  UPDATE public.event_ticket_items
    SET deleted_at = now()
    WHERE id = v_line.id AND deleted_at IS NULL;

  IF v_line.cash_entry_id IS NOT NULL THEN
    UPDATE public.cash_entries
      SET deleted_at = now()
      WHERE id = v_line.cash_entry_id AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_line.id, 'soft', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_event_ticket(_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_line public.event_ticket_items%ROWTYPE;
  v_item public.event_finance_items%ROWTYPE;
  v_qty_int integer;
  v_cash_ids uuid[] := ARRAY[]::uuid[];
  v_lines_count integer := 0;
  v_seller_charge_id uuid;
  v_charge_cash_id uuid;
  v_pay record;
  v_seller_charge_removed boolean := false;
BEGIN
  PERFORM 1
  FROM public.event_ticket_items
  WHERE ticket_id = _ticket_id AND deleted_at IS NULL
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = _ticket_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ingresso nao encontrado';
  END IF;

  v_seller_charge_id := v_ticket.seller_charge_id;

  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento nao encontrado';
  END IF;

  IF NOT public.can_manage_event_destructive(v_event.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissao para excluir ingresso';
  END IF;

  FOR v_line IN
    SELECT * FROM public.event_ticket_items
    WHERE ticket_id = _ticket_id AND deleted_at IS NULL
    ORDER BY id
  LOOP
    v_lines_count := v_lines_count + 1;
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
      v_cash_ids := array_append(v_cash_ids, v_line.cash_entry_id);
    END IF;
  END LOOP;

  UPDATE public.event_ticket_items
    SET deleted_at = now()
    WHERE ticket_id = _ticket_id AND deleted_at IS NULL;

  IF array_length(v_cash_ids, 1) IS NOT NULL THEN
    UPDATE public.cash_entries
      SET deleted_at = now()
      WHERE id = ANY(v_cash_ids) AND deleted_at IS NULL;
  END IF;

  UPDATE public.seats SET ticket_id = NULL WHERE ticket_id = _ticket_id;
  UPDATE public.checkins
    SET deleted_at = now()
    WHERE ticket_id = _ticket_id AND deleted_at IS NULL;

  UPDATE public.tickets
    SET deleted_at = now()
    WHERE id = _ticket_id AND deleted_at IS NULL;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, old_value, new_value
  ) VALUES (
    v_event.chapter_id,
    auth.uid(),
    'ticket_delete',
    'tickets',
    _ticket_id,
    jsonb_build_object(
      'event_id', v_ticket.event_id,
      'ticket_id', v_ticket.id,
      'buyer_name', v_ticket.buyer_name,
      'price_paid', v_ticket.price_paid,
      'status', v_ticket.status
    ),
    jsonb_build_object('soft', true, 'deleted_at', now())
  );

  IF v_seller_charge_id IS NOT NULL THEN
    SELECT cash_entry_id INTO v_charge_cash_id
    FROM public.member_charges
    WHERE id = v_seller_charge_id AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      FOR v_pay IN
        SELECT cash_entry_id
        FROM public.member_charge_payments
        WHERE charge_id = v_seller_charge_id AND deleted_at IS NULL
      LOOP
        IF v_pay.cash_entry_id IS NOT NULL THEN
          v_cash_ids := array_append(v_cash_ids, v_pay.cash_entry_id);
        END IF;
      END LOOP;

      IF v_charge_cash_id IS NOT NULL THEN
        v_cash_ids := array_append(v_cash_ids, v_charge_cash_id);
      END IF;

      UPDATE public.member_charge_payments
        SET deleted_at = now()
        WHERE charge_id = v_seller_charge_id AND deleted_at IS NULL;

      UPDATE public.member_charges
        SET deleted_at = now()
        WHERE id = v_seller_charge_id AND deleted_at IS NULL;

      IF array_length(v_cash_ids, 1) IS NOT NULL THEN
        UPDATE public.cash_entries
          SET deleted_at = now()
          WHERE id = ANY(v_cash_ids) AND deleted_at IS NULL;
      END IF;

      v_seller_charge_removed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', _ticket_id,
    'comanda_items_removed', v_lines_count,
    'seller_charge_removed', v_seller_charge_removed,
    'soft', true
  );
END;
$function$;

-- Helper para purge administrativo (hard delete consciente)
CREATE OR REPLACE FUNCTION public.allow_hard_delete_in_transaction()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_hard_delete', 'true', true);
END;
$$;

REVOKE ALL ON FUNCTION public.allow_hard_delete_in_transaction() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_hard_delete_in_transaction() TO service_role;

-- 4) Esconde soft-deleted na API (authenticated) sem reescrever todas as queries
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tickets',
    'event_ticket_items',
    'cash_entries',
    'member_charges',
    'member_charge_payments',
    'checkins',
    'ticket_types',
    'events',
    'event_tables',
    'event_finance_items',
    'event_finance_categories'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_hide_deleted ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_hide_deleted ON public.%I
         AS RESTRICTIVE FOR SELECT TO authenticated
         USING (deleted_at IS NULL)',
      t, t
    );
  END LOOP;
END $$;
