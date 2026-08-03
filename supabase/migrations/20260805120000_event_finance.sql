-- Financeiro de eventos: categorias, itens (subcategorias), comanda por ingresso

-- 1. Categorias financeiras do evento (ex: Rifas, Bar)
CREATE TABLE public.event_finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX event_finance_categories_unique
  ON public.event_finance_categories (event_id, lower(name));
CREATE INDEX event_finance_categories_event_idx
  ON public.event_finance_categories (event_id);
CREATE INDEX event_finance_categories_chapter_idx
  ON public.event_finance_categories (chapter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_finance_categories TO authenticated;
GRANT ALL ON public.event_finance_categories TO service_role;
ALTER TABLE public.event_finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_finance_categories_select
  ON public.event_finance_categories FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

CREATE POLICY event_finance_categories_write
  ON public.event_finance_categories FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, 'eventos')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, 'eventos')
  );

CREATE TRIGGER set_updated_at_event_finance_categories
  BEFORE UPDATE ON public.event_finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Itens / subcategorias (ex: Cerveja, Rifa do Carro)
CREATE TABLE public.event_finance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.event_finance_categories(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_price numeric(12,2),
  track_stock boolean NOT NULL DEFAULT false,
  stock_qty integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_finance_items_stock_nonneg
    CHECK (stock_qty IS NULL OR stock_qty >= 0)
);

CREATE UNIQUE INDEX event_finance_items_unique
  ON public.event_finance_items (category_id, lower(name));
CREATE INDEX event_finance_items_event_idx
  ON public.event_finance_items (event_id);
CREATE INDEX event_finance_items_chapter_idx
  ON public.event_finance_items (chapter_id, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_finance_items TO authenticated;
GRANT ALL ON public.event_finance_items TO service_role;
ALTER TABLE public.event_finance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_finance_items_select
  ON public.event_finance_items FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

CREATE POLICY event_finance_items_write
  ON public.event_finance_items FOR ALL TO authenticated
  USING (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, 'eventos')
  )
  WITH CHECK (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'tesouraria')
    OR public.can_manage_commission(chapter_id, 'eventos')
  );

CREATE TRIGGER set_updated_at_event_finance_items
  BEFORE UPDATE ON public.event_finance_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Vínculos estruturais em cash_entries
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_finance_item_id uuid REFERENCES public.event_finance_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cash_entries_event_idx
  ON public.cash_entries (event_id);
CREATE INDEX IF NOT EXISTS cash_entries_event_item_idx
  ON public.cash_entries (event_finance_item_id);

-- 4. Linhas da comanda (1 comanda = 1 ingresso)
CREATE TABLE public.event_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.event_finance_items(id) ON DELETE RESTRICT,
  qty numeric(12,2) NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_ticket_items_ticket_idx ON public.event_ticket_items (ticket_id);
CREATE INDEX event_ticket_items_event_idx ON public.event_ticket_items (event_id);
CREATE INDEX event_ticket_items_item_idx ON public.event_ticket_items (item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ticket_items TO authenticated;
GRANT ALL ON public.event_ticket_items TO service_role;
ALTER TABLE public.event_ticket_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_ticket_items_select
  ON public.event_ticket_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND public.can_read_chapter(e.chapter_id)
    )
  );

CREATE POLICY event_ticket_items_write
  ON public.event_ticket_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND (
          public.has_permission(e.chapter_id, 'admin')
          OR public.has_permission(e.chapter_id, 'tesouraria')
          OR public.can_manage_commission(e.chapter_id, 'eventos')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND (
          public.has_permission(e.chapter_id, 'admin')
          OR public.has_permission(e.chapter_id, 'tesouraria')
          OR public.can_manage_commission(e.chapter_id, 'eventos')
        )
    )
  );

-- 5. RPC atômica: adicionar item na comanda + cash_entry + baixa de estoque
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

  RETURN jsonb_build_object(
    'id', v_line_id,
    'cash_entry_id', v_cash_id,
    'amount', v_amount,
    'unit_price', v_price,
    'qty', _qty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_ticket_item(uuid, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_event_ticket_item(uuid, uuid, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_event_ticket_item(uuid, uuid, numeric, numeric, text) TO service_role;
