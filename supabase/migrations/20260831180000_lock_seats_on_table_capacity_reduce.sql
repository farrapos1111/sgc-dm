-- Trava assentos (FOR UPDATE) ao reduzir capacidade; DELETE só assentos livres.

CREATE OR REPLACE FUNCTION public.update_event_table_with_seats(
  _table_id uuid,
  _label text,
  _capacity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_table public.event_tables%ROWTYPE;
  v_old integer;
  v_i integer;
  v_occupied integer;
BEGIN
  IF _label IS NULL OR length(trim(_label)) < 1 OR length(trim(_label)) > 40 THEN
    RAISE EXCEPTION 'Nome da mesa inválido';
  END IF;
  IF _capacity IS NULL OR _capacity < 1 OR _capacity > 30 THEN
    RAISE EXCEPTION 'Capacidade inválida';
  END IF;

  SELECT * INTO v_table
  FROM public.event_tables
  WHERE id = _table_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mesa não encontrada';
  END IF;

  v_old := coalesce(v_table.capacity, 0);

  IF _capacity < v_old THEN
    -- Trava assentos da mesa para evitar corrida com assignSeat.
    PERFORM 1
    FROM public.seats
    WHERE table_id = _table_id
    FOR UPDATE;

    SELECT count(*)::integer INTO v_occupied
    FROM public.seats
    WHERE table_id = _table_id
      AND seat_number > _capacity
      AND ticket_id IS NOT NULL;
    IF v_occupied > 0 THEN
      RAISE EXCEPTION
        'Não é possível reduzir para % lugares: % assento(s) ocupado(s) seriam removidos. Libere-os antes.',
        _capacity, v_occupied;
    END IF;

    DELETE FROM public.seats
    WHERE table_id = _table_id
      AND seat_number > _capacity
      AND ticket_id IS NULL;
  END IF;

  -- Garante assentos 1..capacity (cria faltantes ao aumentar ou alinhar).
  FOR v_i IN 1.._capacity LOOP
    INSERT INTO public.seats (table_id, seat_number)
    VALUES (_table_id, v_i)
    ON CONFLICT (table_id, seat_number) DO NOTHING;
  END LOOP;

  UPDATE public.event_tables
  SET label = trim(_label),
      capacity = _capacity
  WHERE id = _table_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', _table_id,
    'label', trim(_label),
    'capacity', _capacity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_event_table_with_seats(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_event_table_with_seats(uuid, text, integer) TO authenticated, service_role;
