-- Religa tickets restaurados do Dia dos Pais às cobranças já pagas
-- (member_charges + payments apontando para cash_entries existentes).
-- Não cria lançamentos nem altera amounts do caixa.
-- Idempotente: só tickets sem seller_charge_id.

DO $$
DECLARE
  v_event_id uuid := '725b06df-0076-408b-8364-ecd14f2688b1';
  v_n int;
BEGIN
  UPDATE public.tickets t
  SET
    seller_charge_id = mc.id,
    seller_member_id = coalesce(t.seller_member_id, mc.member_id)
  FROM public.member_charges mc
  WHERE t.event_id = v_event_id
    AND t.deleted_at IS NULL
    AND t.status <> 'cancelado'
    AND t.seller_charge_id IS NULL
    AND t.price_paid > 0
    AND mc.deleted_at IS NULL
    AND mc.status = 'pago'
    AND mc.description = 'Ingresso Evento Dia dos Pais - ' || t.buyer_name
    AND abs(mc.amount - t.price_paid) < 0.01
    AND NOT EXISTS (
      SELECT 1
      FROM public.tickets t2
      WHERE t2.seller_charge_id = mc.id
        AND t2.deleted_at IS NULL
    );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'relink ticket seller_charge_id: %', v_n;
END $$;
