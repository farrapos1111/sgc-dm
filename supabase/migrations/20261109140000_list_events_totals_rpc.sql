-- Totais por evento calculados no banco (antes: o servidor baixava todos os
-- tickets/caixa/cobranças/pagamentos e somava em JS; listas > 1000 linhas eram
-- truncadas em silêncio pelo PostgREST).
--
-- Regras idênticas às de listEvents:
--  * tickets_sold: ingressos não cancelados.
--  * raised: valor pago das cobranças de vendedor dos ingressos não cancelados
--    (pago = soma dos pagamentos; cobrança legada 'pago' sem pagamentos = valor total;
--    limitado ao valor da cobrança) + entradas de caixa da categoria 'Eventos'
--    até _today que NÃO sejam quitação de cobrança.
--  * spent: saídas de caixa da categoria 'Eventos' até _today.
-- SECURITY INVOKER: RLS (inclusive *_hide_deleted) continua filtrando as linhas.

CREATE OR REPLACE FUNCTION public.list_events_totals(_chapter_id uuid, _today date)
RETURNS TABLE (
  event_id uuid,
  raised numeric,
  spent numeric,
  tickets_sold integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT e.id FROM public.events e WHERE e.chapter_id = _chapter_id
  ),
  tk AS (
    SELECT t.event_id, t.status, t.seller_charge_id
      FROM public.tickets t
      JOIN ev ON ev.id = t.event_id
  ),
  ch AS (
    SELECT c.id, c.status, COALESCE(c.amount, 0) AS amount, c.cash_entry_id
      FROM public.member_charges c
     WHERE c.id IN (SELECT seller_charge_id FROM tk WHERE seller_charge_id IS NOT NULL)
  ),
  pays AS (
    SELECT p.charge_id, SUM(p.amount) AS total
      FROM public.member_charge_payments p
     WHERE p.charge_id IN (SELECT id FROM ch)
     GROUP BY p.charge_id
  ),
  paid AS (
    SELECT ch.id,
           LEAST(
             CASE WHEN COALESCE(pays.total, 0) = 0 AND ch.status = 'pago' AND ch.amount > 0
                  THEN ch.amount
                  ELSE COALESCE(pays.total, 0) END,
             ch.amount
           ) AS paid
      FROM ch
      LEFT JOIN pays ON pays.charge_id = ch.id
  ),
  tk_tot AS (
    SELECT tk.event_id,
           COUNT(*) FILTER (WHERE tk.status IS DISTINCT FROM 'cancelado') AS cnt,
           COALESCE(SUM(paid.paid) FILTER (WHERE tk.status IS DISTINCT FROM 'cancelado'), 0) AS raised
      FROM tk
      LEFT JOIN paid ON paid.id = tk.seller_charge_id
     GROUP BY tk.event_id
  ),
  cash_tot AS (
    SELECT ce.event_id,
           COALESCE(SUM(ce.amount) FILTER (WHERE ce.kind = 'saida'), 0) AS spent,
           COALESCE(SUM(ce.amount) FILTER (
             WHERE ce.kind = 'entrada'
               AND NOT EXISTS (SELECT 1 FROM public.member_charge_payments p WHERE p.cash_entry_id = ce.id)
               AND NOT EXISTS (SELECT 1 FROM ch WHERE ch.cash_entry_id = ce.id)
           ), 0) AS raised
      FROM public.cash_entries ce
      JOIN ev ON ev.id = ce.event_id
     WHERE ce.category = 'Eventos'
       AND ce.kind IN ('entrada', 'saida')
       AND ce.entry_date <= _today
     GROUP BY ce.event_id
  )
  SELECT ev.id,
         COALESCE(tk_tot.raised, 0) + COALESCE(cash_tot.raised, 0),
         COALESCE(cash_tot.spent, 0),
         COALESCE(tk_tot.cnt, 0)::integer
    FROM ev
    LEFT JOIN tk_tot ON tk_tot.event_id = ev.id
    LEFT JOIN cash_tot ON cash_tot.event_id = ev.id;
$$;

REVOKE ALL ON FUNCTION public.list_events_totals(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_events_totals(uuid, date) TO authenticated;
