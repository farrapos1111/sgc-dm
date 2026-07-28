
-- helpers de comissão
CREATE OR REPLACE FUNCTION public.is_commission_member(_chapter_id uuid, _commission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    JOIN public.members m ON m.id = cm.member_id
    JOIN public.chapter_members ch ON ch.chapter_id = cm.chapter_id AND ch.active = true
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND ch.user_id = auth.uid()
      AND lower(m.full_name) = lower(coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '###'))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commission_president(_chapter_id uuid, _commission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.chapter_id = _chapter_id
      AND c.code = _commission_code
      AND cm.role IN ('presidente','vice')
      AND lower(m.full_name) = lower(coalesce((SELECT full_name FROM public.profiles WHERE id = auth.uid()), '###'))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_commission(_chapter_id uuid, _commission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_permission(_chapter_id, 'admin')
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
      OR public.is_commission_president(_chapter_id, _commission_code);
$$;

GRANT EXECUTE ON FUNCTION public.is_commission_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_commission_president(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_commission(uuid, text) TO authenticated;

-- comissão de sindicâncias
INSERT INTO public.commissions (id, code, label, sort_order)
VALUES (9, 'sindicancias', 'Sindicâncias', 9)
ON CONFLICT (code) DO NOTHING;

-- ===== TESOURARIA =====
CREATE TYPE public.cash_entry_kind AS ENUM ('entrada', 'saida');
CREATE TYPE public.due_status AS ENUM ('em_aberto', 'pago', 'isento');

CREATE TABLE public.cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  kind public.cash_entry_kind NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT current_date,
  receipt_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;
GRANT ALL ON public.cash_entries TO service_role;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_select" ON public.cash_entries FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "cash_write" ON public.cash_entries FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria')) WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));
CREATE TRIGGER cash_entries_updated_at BEFORE UPDATE ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.member_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  competence_year smallint NOT NULL,
  competence_month smallint NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.due_status NOT NULL DEFAULT 'em_aberto',
  paid_at date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, member_id, competence_year, competence_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_dues TO authenticated;
GRANT ALL ON public.member_dues TO service_role;
ALTER TABLE public.member_dues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dues_select" ON public.member_dues FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "dues_write" ON public.member_dues FOR ALL TO authenticated
  USING (public.has_permission(chapter_id, 'tesouraria')) WITH CHECK (public.has_permission(chapter_id, 'tesouraria'));
CREATE TRIGGER member_dues_updated_at BEFORE UPDATE ON public.member_dues FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== SINDICÂNCIAS =====
CREATE TYPE public.investigation_status AS ENUM ('aberta', 'em_andamento', 'aprovada', 'reprovada', 'arquivada');

CREATE TABLE public.investigation_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_birth_date date,
  candidate_phone text,
  candidate_email text,
  guardian_name text,
  referred_by text,
  notes text,
  status public.investigation_status NOT NULL DEFAULT 'aberta',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigation_files TO authenticated;
GRANT ALL ON public.investigation_files TO service_role;
ALTER TABLE public.investigation_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_files_select" ON public.investigation_files FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "inv_files_write" ON public.investigation_files FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'sindicancias')) WITH CHECK (public.can_manage_commission(chapter_id, 'sindicancias'));
CREATE TRIGGER inv_files_updated_at BEFORE UPDATE ON public.investigation_files FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.investigation_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.investigation_files(id) ON DELETE SET NULL,
  title text NOT NULL,
  responsible_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  status public.investigation_status NOT NULL DEFAULT 'aberta',
  opened_at date NOT NULL DEFAULT current_date,
  closed_at date,
  opinion text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investigation_processes TO authenticated;
GRANT ALL ON public.investigation_processes TO service_role;
ALTER TABLE public.investigation_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_proc_select" ON public.investigation_processes FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "inv_proc_write" ON public.investigation_processes FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'sindicancias')) WITH CHECK (public.can_manage_commission(chapter_id, 'sindicancias'));
CREATE TRIGGER inv_proc_updated_at BEFORE UPDATE ON public.investigation_processes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== HOSPITALARIA =====
CREATE TABLE public.hospitality_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  menu_date date NOT NULL DEFAULT current_date,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  items text,
  estimated_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_menus TO authenticated;
GRANT ALL ON public.hospitality_menus TO service_role;
ALTER TABLE public.hospitality_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp_menu_select" ON public.hospitality_menus FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "hosp_menu_write" ON public.hospitality_menus FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'hospitalaria')) WITH CHECK (public.can_manage_commission(chapter_id, 'hospitalaria'));
CREATE TRIGGER hosp_menu_updated_at BEFORE UPDATE ON public.hospitality_menus FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.hospitality_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  duty_date date NOT NULL DEFAULT current_date,
  role_label text NOT NULL DEFAULT 'Serviço',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitality_duties TO authenticated;
GRANT ALL ON public.hospitality_duties TO service_role;
ALTER TABLE public.hospitality_duties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp_duty_select" ON public.hospitality_duties FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY "hosp_duty_write" ON public.hospitality_duties FOR ALL TO authenticated
  USING (public.can_manage_commission(chapter_id, 'hospitalaria')) WITH CHECK (public.can_manage_commission(chapter_id, 'hospitalaria'));
CREATE TRIGGER hosp_duty_updated_at BEFORE UPDATE ON public.hospitality_duties FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
