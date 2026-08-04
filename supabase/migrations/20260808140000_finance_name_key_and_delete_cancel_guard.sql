-- name_key normalizado (trim + lower + espaços colapsados) para upsert atômico
-- de categorias/itens; alinhamento de ingresso cancelado em delete da comanda.

CREATE OR REPLACE FUNCTION public.finance_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(both from regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.tg_set_finance_name_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name_key := public.finance_name_key(NEW.name);
  RETURN NEW;
END;
$$;

ALTER TABLE public.event_finance_categories
  ADD COLUMN IF NOT EXISTS name_key text;

ALTER TABLE public.event_finance_items
  ADD COLUMN IF NOT EXISTS name_key text;

UPDATE public.event_finance_categories
SET name_key = public.finance_name_key(name)
WHERE name_key IS NULL OR name_key <> public.finance_name_key(name);

UPDATE public.event_finance_items
SET name_key = public.finance_name_key(name)
WHERE name_key IS NULL OR name_key <> public.finance_name_key(name);

-- Desambigua colisões da chave normalizada antes do UNIQUE
WITH d AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY event_id, name_key ORDER BY created_at, id
         ) AS rn
  FROM public.event_finance_categories
)
UPDATE public.event_finance_categories c
SET name = c.name || ' (' || substring(c.id::text, 1, 8) || ')'
FROM d
WHERE c.id = d.id AND d.rn > 1;

UPDATE public.event_finance_categories
SET name_key = public.finance_name_key(name);

WITH d AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY category_id, name_key ORDER BY created_at, id
         ) AS rn
  FROM public.event_finance_items
)
UPDATE public.event_finance_items i
SET name = i.name || ' (' || substring(i.id::text, 1, 8) || ')'
FROM d
WHERE i.id = d.id AND d.rn > 1;

UPDATE public.event_finance_items
SET name_key = public.finance_name_key(name);

ALTER TABLE public.event_finance_categories
  ALTER COLUMN name_key SET NOT NULL;

ALTER TABLE public.event_finance_items
  ALTER COLUMN name_key SET NOT NULL;

DROP INDEX IF EXISTS public.event_finance_categories_unique;
CREATE UNIQUE INDEX event_finance_categories_unique
  ON public.event_finance_categories (event_id, name_key);

DROP INDEX IF EXISTS public.event_finance_items_unique;
CREATE UNIQUE INDEX event_finance_items_unique
  ON public.event_finance_items (category_id, name_key);

DROP TRIGGER IF EXISTS tg_event_finance_categories_name_key
  ON public.event_finance_categories;
CREATE TRIGGER tg_event_finance_categories_name_key
  BEFORE INSERT OR UPDATE OF name ON public.event_finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_finance_name_key();

DROP TRIGGER IF EXISTS tg_event_finance_items_name_key
  ON public.event_finance_items;
CREATE TRIGGER tg_event_finance_items_name_key
  BEFORE INSERT OR UPDATE OF name ON public.event_finance_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_finance_name_key();

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
  -- Mesma regra de update_event_ticket_item: não alterar comanda de ingresso cancelado.
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
