-- Cobranças avulsas + pagamentos parciais (idempotente para bancos que ainda
-- não aplicaram 20260729170000_member_charges)

CREATE TABLE IF NOT EXISTS public.member_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind public.cash_entry_kind NOT NULL DEFAULT 'entrada',
  category text NOT NULL DEFAULT 'Outras',
  subcategory text,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT current_date,
  status public.due_status NOT NULL DEFAULT 'em_aberto',
  paid_at date,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_charges_chapter_idx
  ON public.member_charges (chapter_id, due_date DESC);
CREATE INDEX IF NOT EXISTS member_charges_member_idx
  ON public.member_charges (member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_charges TO authenticated;
GRANT ALL ON public.member_charges TO service_role;
ALTER TABLE public.member_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_charges_select ON public.member_charges;
CREATE POLICY member_charges_select ON public.member_charges
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS member_charges_write ON public.member_charges;
CREATE POLICY member_charges_write ON public.member_charges
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria'))
  WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));

DROP TRIGGER IF EXISTS member_charges_updated_at ON public.member_charges;
CREATE TRIGGER member_charges_updated_at
  BEFORE UPDATE ON public.member_charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Pagamentos parciais (espelho no fluxo de caixa)
CREATE TABLE IF NOT EXISTS public.member_charge_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  charge_id uuid NOT NULL REFERENCES public.member_charges(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT current_date,
  cash_entry_id uuid REFERENCES public.cash_entries(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_charge_payments_charge_idx
  ON public.member_charge_payments (charge_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS member_charge_payments_chapter_idx
  ON public.member_charge_payments (chapter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_charge_payments TO authenticated;
GRANT ALL ON public.member_charge_payments TO service_role;
ALTER TABLE public.member_charge_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_charge_payments_select ON public.member_charge_payments;
CREATE POLICY member_charge_payments_select ON public.member_charge_payments
  FOR SELECT TO authenticated
  USING (public.can_read_chapter(chapter_id));

DROP POLICY IF EXISTS member_charge_payments_write ON public.member_charge_payments;
CREATE POLICY member_charge_payments_write ON public.member_charge_payments
  FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria'))
  WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));

-- Backfill: cobranças já pagas com cash_entry viram um pagamento integral
INSERT INTO public.member_charge_payments (
  chapter_id, charge_id, amount, paid_at, cash_entry_id, created_by
)
SELECT
  c.chapter_id,
  c.id,
  c.amount,
  coalesce(c.paid_at, current_date),
  c.cash_entry_id,
  c.created_by
FROM public.member_charges c
WHERE c.status = 'pago'
  AND c.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.member_charge_payments p WHERE p.charge_id = c.id
  );
