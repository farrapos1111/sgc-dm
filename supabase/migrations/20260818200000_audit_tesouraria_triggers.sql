-- Audit log automático da tesouraria: caixa e cobranças.

CREATE OR REPLACE FUNCTION public.tg_audit_cash_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'cash_entry_insert';
    v_new := jsonb_build_object(
      'kind', NEW.kind,
      'category', NEW.category,
      'subcategory', NEW.subcategory,
      'description', NEW.description,
      'amount', NEW.amount,
      'entry_date', NEW.entry_date,
      'event_id', NEW.event_id
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      NEW.chapter_id, auth.uid(), v_action, 'cash_entries', NEW.id, v_new
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.kind IS NOT DISTINCT FROM NEW.kind
       AND OLD.category IS NOT DISTINCT FROM NEW.category
       AND OLD.subcategory IS NOT DISTINCT FROM NEW.subcategory
       AND OLD.description IS NOT DISTINCT FROM NEW.description
       AND OLD.amount IS NOT DISTINCT FROM NEW.amount
       AND OLD.entry_date IS NOT DISTINCT FROM NEW.entry_date
       AND OLD.event_id IS NOT DISTINCT FROM NEW.event_id
       AND OLD.receipt_url IS NOT DISTINCT FROM NEW.receipt_url
    THEN
      RETURN NEW;
    END IF;
    v_action := 'cash_entry_update';
    v_old := jsonb_build_object(
      'kind', OLD.kind,
      'category', OLD.category,
      'subcategory', OLD.subcategory,
      'description', OLD.description,
      'amount', OLD.amount,
      'entry_date', OLD.entry_date
    );
    v_new := jsonb_build_object(
      'kind', NEW.kind,
      'category', NEW.category,
      'subcategory', NEW.subcategory,
      'description', NEW.description,
      'amount', NEW.amount,
      'entry_date', NEW.entry_date,
      'event_id', NEW.event_id
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      NEW.chapter_id, auth.uid(), v_action, 'cash_entries', NEW.id, v_old, v_new
    );
    RETURN NEW;
  ELSE
    v_action := 'cash_entry_delete';
    v_old := jsonb_build_object(
      'kind', OLD.kind,
      'category', OLD.category,
      'subcategory', OLD.subcategory,
      'description', OLD.description,
      'amount', OLD.amount,
      'entry_date', OLD.entry_date,
      'event_id', OLD.event_id
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      OLD.chapter_id, auth.uid(), v_action, 'cash_entries', OLD.id, v_old, v_old
    );
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS cash_entries_audit ON public.cash_entries;
CREATE TRIGGER cash_entries_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_cash_entries();

CREATE OR REPLACE FUNCTION public.tg_audit_member_charges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'charge_insert';
    v_new := jsonb_build_object(
      'member_id', NEW.member_id,
      'description', NEW.description,
      'amount', NEW.amount,
      'status', NEW.status,
      'category', NEW.category,
      'due_date', NEW.due_date
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      NEW.chapter_id, auth.uid(), v_action, 'member_charges', NEW.id, v_new
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS NOT DISTINCT FROM NEW.amount
       AND OLD.status IS NOT DISTINCT FROM NEW.status
       AND OLD.description IS NOT DISTINCT FROM NEW.description
       AND OLD.due_date IS NOT DISTINCT FROM NEW.due_date
       AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
       AND OLD.cash_entry_id IS NOT DISTINCT FROM NEW.cash_entry_id
    THEN
      RETURN NEW;
    END IF;
    v_action := 'charge_update';
    v_old := jsonb_build_object(
      'member_id', OLD.member_id,
      'description', OLD.description,
      'amount', OLD.amount,
      'status', OLD.status,
      'paid_at', OLD.paid_at
    );
    v_new := jsonb_build_object(
      'member_id', NEW.member_id,
      'description', NEW.description,
      'amount', NEW.amount,
      'status', NEW.status,
      'category', NEW.category,
      'due_date', NEW.due_date,
      'paid_at', NEW.paid_at
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      NEW.chapter_id, auth.uid(), v_action, 'member_charges', NEW.id, v_old, v_new
    );
    RETURN NEW;
  ELSE
    v_action := 'charge_delete';
    v_old := jsonb_build_object(
      'member_id', OLD.member_id,
      'description', OLD.description,
      'amount', OLD.amount,
      'status', OLD.status
    );
    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, old_value, new_value
    ) VALUES (
      OLD.chapter_id, auth.uid(), v_action, 'member_charges', OLD.id, v_old, v_old
    );
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS member_charges_audit ON public.member_charges;
CREATE TRIGGER member_charges_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.member_charges
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_member_charges();
