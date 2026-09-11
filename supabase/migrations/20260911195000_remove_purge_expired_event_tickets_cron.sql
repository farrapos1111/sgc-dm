-- Remove o cron que apagava fisicamente ingressos após 30 dias do evento.
-- Causou perda de registro de eventos (ex.: Dia dos Pais em 08/09/2026).

DO $$
BEGIN
  PERFORM cron.unschedule('purge-expired-event-tickets');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

-- Fallback por jobid caso o nome não bata.
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%purge_expired_event_tickets%'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.purge_expired_event_tickets();
