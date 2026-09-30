-- Cobranças de ingresso em aberto sem ticket vivo e sem pagamento
-- (resíduo de edições antigas que desligavam a cobrança do ingresso).

UPDATE public.member_charges mc
SET deleted_at = now()
WHERE mc.deleted_at IS NULL
  AND mc.status = 'em_aberto'
  AND mc.description ILIKE 'Ingresso Evento%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.seller_charge_id = mc.id
      AND t.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.member_charge_payments p
    WHERE p.charge_id = mc.id
      AND p.deleted_at IS NULL
  );
