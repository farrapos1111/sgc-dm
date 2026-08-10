-- Migra Hospitalária → Filantropia e remove o valor do enum.

UPDATE public.calendar_events
SET event_type = 'filantropia'
WHERE event_type::text = 'hospitalaria';

DO $$
DECLARE
  has_hospitalaria boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'calendar_event_type' AND e.enumlabel = 'hospitalaria'
  ) INTO has_hospitalaria;

  IF has_hospitalaria THEN
    ALTER TYPE public.calendar_event_type RENAME TO calendar_event_type_old;

    CREATE TYPE public.calendar_event_type AS ENUM (
      'sessao_ritualistica',
      'sessao_administrativa',
      'evento',
      'filantropia',
      'entretenimento',
      'sindicancia'
    );

    ALTER TABLE public.calendar_events
      ALTER COLUMN event_type TYPE public.calendar_event_type
      USING event_type::text::public.calendar_event_type;

    DROP TYPE public.calendar_event_type_old;
  END IF;
END $$;
