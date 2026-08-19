-- Liga cobrança em aberto a um lançamento órfão já existente no fluxo
-- (importação/manual), quando o match é único por valor + descrição + nome.
-- Evita "fantasma": dinheiro no caixa atual sem a cobrança quitada, e duplicata
-- se a tesouraria baixar a cobrança depois.

WITH charges AS (
  SELECT
    mc.id,
    mc.chapter_id,
    mc.kind,
    mc.description,
    mc.amount,
    mc.due_date,
    mc.created_by,
    regexp_split_to_array(trim(m.full_name), '[[:space:]]+') AS parts
  FROM public.member_charges mc
  JOIN public.members m ON m.id = mc.member_id
  WHERE mc.status = 'em_aberto'
    AND mc.cash_entry_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.member_charge_payments p
      WHERE p.charge_id = mc.id
    )
),
cands AS (
  SELECT
    c.id AS charge_id,
    c.chapter_id,
    c.amount,
    c.created_by,
    ce.id AS cash_id,
    ce.entry_date
  FROM charges c
  JOIN public.cash_entries ce
    ON ce.chapter_id = c.chapter_id
   AND ce.kind = c.kind
   AND round(ce.amount::numeric, 2) = round(c.amount::numeric, 2)
   AND position(lower(c.description) IN lower(ce.description)) > 0
   AND coalesce(array_length(c.parts, 1), 0) >= 1
   AND length(c.parts[1]) >= 2
   AND position(lower(c.parts[1]) IN lower(ce.description)) > 0
   AND (
     coalesce(array_length(c.parts, 1), 0) < 2
     OR (
       length(c.parts[array_length(c.parts, 1)]) >= 3
       AND position(lower(c.parts[array_length(c.parts, 1)]) IN lower(ce.description)) > 0
     )
     OR (
       length(c.parts[2]) >= 3
       AND position(lower(c.parts[2]) IN lower(ce.description)) > 0
     )
   )
   AND ce.entry_date BETWEEN (c.due_date - 180) AND (c.due_date + 90)
   AND NOT EXISTS (
     SELECT 1
     FROM public.member_charge_payments p
     WHERE p.cash_entry_id = ce.id
   )
   AND NOT EXISTS (
     SELECT 1
     FROM public.member_charges x
     WHERE x.cash_entry_id = ce.id
   )
   AND NOT EXISTS (
     SELECT 1
     FROM public.member_dues d
     WHERE d.cash_entry_id = ce.id
   )
),
uniq_charge AS (
  SELECT charge_id
  FROM cands
  GROUP BY charge_id
  HAVING count(*) = 1
),
uniq_cash AS (
  SELECT cash_id
  FROM cands
  GROUP BY cash_id
  HAVING count(*) = 1
),
picked AS (
  SELECT c.*
  FROM cands c
  JOIN uniq_charge uc ON uc.charge_id = c.charge_id
  JOIN uniq_cash uk ON uk.cash_id = c.cash_id
),
ins AS (
  INSERT INTO public.member_charge_payments (
    chapter_id,
    charge_id,
    amount,
    paid_at,
    cash_entry_id,
    notes,
    created_by
  )
  SELECT
    p.chapter_id,
    p.charge_id,
    p.amount,
    p.entry_date,
    p.cash_id,
    'Vinculado a lançamento já existente no fluxo',
    p.created_by
  FROM picked p
  RETURNING charge_id, cash_entry_id, paid_at
)
UPDATE public.member_charges mc
SET
  status = 'pago',
  paid_at = ins.paid_at,
  cash_entry_id = ins.cash_entry_id
FROM ins
WHERE mc.id = ins.charge_id
  AND mc.status = 'em_aberto';
