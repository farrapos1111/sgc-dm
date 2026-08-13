-- Auditoria de qualquer mudança no grupo Tesouraria
-- (fluxo, mensalidades, atrasados, cobranças + categorias).

CREATE OR REPLACE FUNCTION public.tg_audit_tesouraria_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_chapter uuid;
  v_id uuid;
  v_member uuid;
BEGIN
  v_action := TG_TABLE_NAME || '_' || lower(TG_OP);

  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW) - 'updated_at';
    v_id := NEW.id;
    v_chapter := NEW.chapter_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD) - 'updated_at';
    v_new := to_jsonb(NEW) - 'updated_at';
    IF v_old IS NOT DISTINCT FROM v_new THEN
      RETURN NEW;
    END IF;
    v_id := NEW.id;
    v_chapter := NEW.chapter_id;
  ELSE
    v_old := to_jsonb(OLD) - 'updated_at';
    v_new := v_old;
    v_id := OLD.id;
    v_chapter := OLD.chapter_id;
  END IF;

  IF v_chapter IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'member_charge_payments' THEN
    SELECT mc.member_id INTO v_member
    FROM public.member_charges mc
    WHERE mc.id = COALESCE(
      (v_new->>'charge_id')::uuid,
      (v_old->>'charge_id')::uuid
    );
    IF v_member IS NOT NULL THEN
      IF v_new IS NOT NULL THEN
        v_new := v_new || jsonb_build_object('member_id', v_member);
      END IF;
      IF v_old IS NOT NULL THEN
        v_old := v_old || jsonb_build_object('member_id', v_member);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, old_value, new_value
  ) VALUES (
    v_chapter, auth.uid(), v_action, TG_TABLE_NAME, v_id, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS cash_categories_audit ON public.cash_categories;
CREATE TRIGGER cash_categories_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tesouraria_row();

DROP TRIGGER IF EXISTS cash_subcategories_audit ON public.cash_subcategories;
CREATE TRIGGER cash_subcategories_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cash_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tesouraria_row();

DROP TRIGGER IF EXISTS member_charge_payments_audit ON public.member_charge_payments;
CREATE TRIGGER member_charge_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.member_charge_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tesouraria_row();

DROP TRIGGER IF EXISTS member_dues_audit ON public.member_dues;
CREATE TRIGGER member_dues_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.member_dues
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tesouraria_row();

DROP TRIGGER IF EXISTS member_dues_manual_inclusions_audit ON public.member_dues_manual_inclusions;
CREATE TRIGGER member_dues_manual_inclusions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.member_dues_manual_inclusions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_tesouraria_row();
