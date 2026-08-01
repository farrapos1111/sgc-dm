-- Mesa + assentos em uma única transação (RPC).
CREATE OR REPLACE FUNCTION public.create_event_table_with_seats(
  _event_id uuid,
  _label text,
  _capacity integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
  v_i integer;
BEGIN
  IF _capacity IS NULL OR _capacity < 1 OR _capacity > 500 THEN
    RAISE EXCEPTION 'Capacidade inválida';
  END IF;

  INSERT INTO public.event_tables (event_id, label, capacity)
  VALUES (_event_id, _label, _capacity)
  RETURNING id INTO v_table_id;

  FOR v_i IN 1.._capacity LOOP
    INSERT INTO public.seats (table_id, seat_number)
    VALUES (v_table_id, v_i);
  END LOOP;

  RETURN v_table_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_event_table_with_seats(uuid, text, integer) TO authenticated;

-- DELETE de eventos: só admin / comissoes / secretaria (demais writes seguem para membros).
DROP POLICY IF EXISTS events_write ON public.events;

CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_chapter_member(chapter_id));

CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_chapter_member(chapter_id))
  WITH CHECK (public.is_chapter_member(chapter_id));

CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (
    public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'comissoes')
    OR public.has_permission(chapter_id, 'secretaria')
  );

-- Comissões: vínculo canônico via is_linked_member(cm.member_id).
CREATE OR REPLACE FUNCTION public.is_commission_member(_chapter_id uuid, _commission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
      AND public.is_chapter_member(_chapter_id)
      AND public.is_linked_member(cm.member_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commission_president(_chapter_id uuid, _commission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
      AND cm.role IN ('presidente', 'vice')
      AND public.is_chapter_member(_chapter_id)
      AND public.is_linked_member(cm.member_id)
  );
$$;
