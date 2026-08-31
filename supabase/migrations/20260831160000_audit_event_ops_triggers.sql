-- Auditoria de eventos: tipos de ingresso, vendas, mesas, alocação e check-ins.

CREATE OR REPLACE FUNCTION public.tg_audit_ticket_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter_id uuid;
  v_event_id uuid;
  v_action text;
  v_new jsonb;
  v_old jsonb;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  SELECT e.chapter_id INTO v_chapter_id FROM public.events e WHERE e.id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'ticket_type_insert';
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'name', NEW.name,
      'price', NEW.price,
      'quantity_total', NEW.quantity_total
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'ticket_types', NEW.id, v_new
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS NOT DISTINCT FROM NEW.name
       AND OLD.price IS NOT DISTINCT FROM NEW.price
       AND OLD.quantity_total IS NOT DISTINCT FROM NEW.quantity_total
    THEN
      RETURN NEW;
    END IF;
    v_action := 'ticket_type_update';
    v_old := jsonb_build_object(
      'name', OLD.name,
      'price', OLD.price,
      'quantity_total', OLD.quantity_total
    );
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'name', NEW.name,
      'price', NEW.price,
      'quantity_total', NEW.quantity_total,
      'old', v_old
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'ticket_types', NEW.id, v_old, v_new
    );
    RETURN NEW;
  ELSE
    v_action := 'ticket_type_delete';
    v_old := jsonb_build_object(
      'event_id', OLD.event_id,
      'name', OLD.name,
      'price', OLD.price,
      'quantity_total', OLD.quantity_total
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'ticket_types', OLD.id, v_old, v_old
    );
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ticket_types_audit ON public.ticket_types;
CREATE TRIGGER ticket_types_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_ticket_types();

CREATE OR REPLACE FUNCTION public.tg_audit_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter_id uuid;
  v_event_id uuid;
  v_action text;
  v_new jsonb;
  v_old jsonb;
  v_type_name text;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  SELECT e.chapter_id INTO v_chapter_id FROM public.events e WHERE e.id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT tt.name INTO v_type_name
    FROM public.ticket_types tt
    WHERE tt.id = NEW.ticket_type_id;
    v_action := 'ticket_sell';
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'ticket_id', NEW.id,
      'buyer_name', NEW.buyer_name,
      'buyer_email', NEW.buyer_email,
      'price_paid', NEW.price_paid,
      'status', NEW.status,
      'ticket_type_id', NEW.ticket_type_id,
      'ticket_type_name', v_type_name,
      'seller_member_id', NEW.seller_member_id,
      'item_name', COALESCE(v_type_name, 'Avulso'),
      'amount', NEW.price_paid
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'tickets', NEW.id, v_new
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.buyer_name IS NOT DISTINCT FROM NEW.buyer_name
       AND OLD.buyer_email IS NOT DISTINCT FROM NEW.buyer_email
       AND OLD.price_paid IS NOT DISTINCT FROM NEW.price_paid
       AND OLD.status IS NOT DISTINCT FROM NEW.status
       AND OLD.ticket_type_id IS NOT DISTINCT FROM NEW.ticket_type_id
       AND OLD.seller_member_id IS NOT DISTINCT FROM NEW.seller_member_id
    THEN
      RETURN NEW;
    END IF;
    SELECT tt.name INTO v_type_name
    FROM public.ticket_types tt
    WHERE tt.id = NEW.ticket_type_id;
    v_action := 'ticket_update';
    v_old := jsonb_build_object(
      'buyer_name', OLD.buyer_name,
      'price_paid', OLD.price_paid,
      'status', OLD.status,
      'ticket_type_id', OLD.ticket_type_id
    );
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'ticket_id', NEW.id,
      'buyer_name', NEW.buyer_name,
      'price_paid', NEW.price_paid,
      'status', NEW.status,
      'ticket_type_id', NEW.ticket_type_id,
      'ticket_type_name', v_type_name,
      'seller_member_id', NEW.seller_member_id,
      'item_name', COALESCE(v_type_name, 'Avulso'),
      'amount', NEW.price_paid,
      'old', v_old
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'tickets', NEW.id, v_old, v_new
    );
    RETURN NEW;
  ELSE
    SELECT tt.name INTO v_type_name
    FROM public.ticket_types tt
    WHERE tt.id = OLD.ticket_type_id;
    v_action := 'ticket_delete';
    v_old := jsonb_build_object(
      'event_id', OLD.event_id,
      'ticket_id', OLD.id,
      'buyer_name', OLD.buyer_name,
      'price_paid', OLD.price_paid,
      'status', OLD.status,
      'ticket_type_name', v_type_name,
      'item_name', COALESCE(v_type_name, 'Avulso'),
      'amount', OLD.price_paid
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'tickets', OLD.id, v_old, v_old
    );
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tickets_audit ON public.tickets;
CREATE TRIGGER tickets_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tickets();

CREATE OR REPLACE FUNCTION public.tg_audit_event_tables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter_id uuid;
  v_event_id uuid;
  v_action text;
  v_new jsonb;
  v_old jsonb;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);
  SELECT e.chapter_id INTO v_chapter_id FROM public.events e WHERE e.id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'event_table_insert';
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'label', NEW.label,
      'capacity', NEW.capacity,
      'item_name', NEW.label
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'event_tables', NEW.id, v_new
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.label IS NOT DISTINCT FROM NEW.label
       AND OLD.capacity IS NOT DISTINCT FROM NEW.capacity
    THEN
      RETURN NEW;
    END IF;
    v_action := 'event_table_update';
    v_old := jsonb_build_object(
      'label', OLD.label,
      'capacity', OLD.capacity
    );
    v_new := jsonb_build_object(
      'event_id', NEW.event_id,
      'label', NEW.label,
      'capacity', NEW.capacity,
      'item_name', NEW.label,
      'old', v_old
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'event_tables', NEW.id, v_old, v_new
    );
    RETURN NEW;
  ELSE
    v_action := 'event_table_delete';
    v_old := jsonb_build_object(
      'event_id', OLD.event_id,
      'label', OLD.label,
      'capacity', OLD.capacity,
      'item_name', OLD.label
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      v_chapter_id, auth.uid(), v_action, 'event_tables', OLD.id, v_old, v_old
    );
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS event_tables_audit ON public.event_tables;
CREATE TRIGGER event_tables_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.event_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_event_tables();

-- Só alocação/liberação (mudança de ticket_id). Criação em massa de assentos é silenciosa.
CREATE OR REPLACE FUNCTION public.tg_audit_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter_id uuid;
  v_event_id uuid;
  v_table_label text;
  v_action text;
  v_buyer text;
  v_new jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF OLD.ticket_id IS NOT DISTINCT FROM NEW.ticket_id THEN
    RETURN NEW;
  END IF;

  SELECT et.event_id, et.label
  INTO v_event_id, v_table_label
  FROM public.event_tables et
  WHERE et.id = NEW.table_id;
  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.chapter_id INTO v_chapter_id FROM public.events e WHERE e.id = v_event_id;
  IF v_chapter_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.ticket_id IS NULL THEN
    v_action := 'seat_unassign';
    SELECT t.buyer_name INTO v_buyer FROM public.tickets t WHERE t.id = OLD.ticket_id;
    v_new := jsonb_build_object(
      'event_id', v_event_id,
      'table_id', NEW.table_id,
      'table_label', v_table_label,
      'seat_id', NEW.id,
      'seat_number', NEW.seat_number,
      'ticket_id', OLD.ticket_id,
      'buyer_name', v_buyer,
      'item_name', format('%s · assento %s', COALESCE(v_table_label, 'Mesa'), NEW.seat_number)
    );
  ELSE
    v_action := 'seat_assign';
    SELECT t.buyer_name INTO v_buyer FROM public.tickets t WHERE t.id = NEW.ticket_id;
    v_new := jsonb_build_object(
      'event_id', v_event_id,
      'table_id', NEW.table_id,
      'table_label', v_table_label,
      'seat_id', NEW.id,
      'seat_number', NEW.seat_number,
      'ticket_id', NEW.ticket_id,
      'buyer_name', v_buyer,
      'item_name', format('%s · assento %s', COALESCE(v_table_label, 'Mesa'), NEW.seat_number)
    );
  END IF;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_chapter_id, auth.uid(), v_action, 'seats', NEW.id, v_new
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seats_audit ON public.seats;
CREATE TRIGGER seats_audit
  AFTER UPDATE ON public.seats
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_seats();

CREATE OR REPLACE FUNCTION public.tg_audit_checkins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter_id uuid;
  v_buyer text;
  v_new jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT e.chapter_id INTO v_chapter_id FROM public.events e WHERE e.id = NEW.event_id;
  IF v_chapter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.buyer_name INTO v_buyer FROM public.tickets t WHERE t.id = NEW.ticket_id;

  v_new := jsonb_build_object(
    'event_id', NEW.event_id,
    'ticket_id', NEW.ticket_id,
    'buyer_name', v_buyer,
    'method', NEW.method,
    'item_name', COALESCE(v_buyer, 'Convidado')
  );

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_chapter_id, auth.uid(), 'ticket_checkin', 'checkins', NEW.id, v_new
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_audit ON public.checkins;
CREATE TRIGGER checkins_audit
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_checkins();
