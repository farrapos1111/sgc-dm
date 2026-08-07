-- Remove ingressos de eventos encerrados há mais de 30 dias (check-in / QR).
-- Preserva lançamentos de caixa e cobranças de vendedor; só some o ingresso.

CREATE OR REPLACE FUNCTION public.purge_expired_event_tickets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ids uuid[];
  v_count integer := 0;
BEGIN
  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.tickets t
  JOIN public.events e ON e.id = t.event_id
  WHERE (timezone('America/Sao_Paulo', COALESCE(e.ends_at, e.starts_at)))::date
        < (timezone('America/Sao_Paulo', now()))::date - 30;

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.event_ticket_items
  SET cash_entry_id = NULL
  WHERE ticket_id = ANY(v_ids);

  DELETE FROM public.event_ticket_items WHERE ticket_id = ANY(v_ids);
  UPDATE public.seats SET ticket_id = NULL WHERE ticket_id = ANY(v_ids);
  DELETE FROM public.checkins WHERE ticket_id = ANY(v_ids);

  UPDATE public.tickets
  SET seller_charge_id = NULL
  WHERE id = ANY(v_ids);

  DELETE FROM public.tickets WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.purge_expired_event_tickets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_event_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_event_tickets() TO service_role;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'purge-expired-event-tickets';

    PERFORM cron.schedule(
      'purge-expired-event-tickets',
      '20 3 * * *',
      'SELECT public.purge_expired_event_tickets();'
    );
  END IF;
END
$do$;

SELECT public.purge_expired_event_tickets();
