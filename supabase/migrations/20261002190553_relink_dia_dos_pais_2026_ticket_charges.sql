-- Religa ingressos do Dia dos Pais às cobranças já pagas cujo título
-- inclui o semestre (2026/02). A religação anterior só casava
-- "Dia dos Pais - Nome", então estes ficaram sem seller_charge_id
-- e a comanda seguia em aberto mesmo com o caixa quitado.

UPDATE public.tickets t
SET
  seller_charge_id = mc.id,
  seller_member_id = coalesce(t.seller_member_id, mc.member_id)
FROM public.member_charges mc
WHERE t.event_id = '725b06df-0076-408b-8364-ecd14f2688b1'
  AND t.deleted_at IS NULL
  AND t.status <> 'cancelado'
  AND t.seller_charge_id IS NULL
  AND t.price_paid > 0
  AND mc.deleted_at IS NULL
  AND mc.status = 'pago'
  AND mc.description = 'Ingresso Evento Dia dos Pais 2026/02 - ' || t.buyer_name
  AND abs(mc.amount - t.price_paid) < 0.01
  AND NOT EXISTS (
    SELECT 1
    FROM public.tickets t2
    WHERE t2.seller_charge_id = mc.id
      AND t2.deleted_at IS NULL
  );
