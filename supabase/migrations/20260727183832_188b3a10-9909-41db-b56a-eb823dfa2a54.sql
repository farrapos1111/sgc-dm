-- 1) Rename status value visitante -> macom
ALTER TYPE public.member_status RENAME VALUE 'visitante' TO 'macom';

-- 2) Roles: substitute list and migrate
UPDATE public.roles SET name = 'admin_total', label = 'Administrador Total' WHERE id = 7;
UPDATE public.roles SET name = 'consultor', label = 'Consultor' WHERE id = 6;
INSERT INTO public.roles (id, name, label) VALUES (8, 'presidente_conselho', 'Presidente do Conselho')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, label = EXCLUDED.label;

-- refresh policies/functions that referenced the old role names
CREATE OR REPLACE FUNCTION public.reveal_member_pii(_member_id uuid, _field text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member public.members%ROWTYPE;
  v_plain text;
BEGIN
  IF _field NOT IN ('cpf','rg') THEN
    RAISE EXCEPTION 'Campo inválido: %', _field;
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF NOT public.has_any_role(v_member.chapter_id, ARRAY['mestre_conselheiro','escrivao','tesoureiro','admin_total']) THEN
    RAISE EXCEPTION 'Sem permissão para revelar PII' USING ERRCODE = '42501';
  END IF;

  IF _field = 'cpf' THEN
    v_plain := public.decrypt_pii(v_member.cpf_encrypted);
  ELSE
    v_plain := public.decrypt_pii(v_member.rg_encrypted);
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (v_member.chapter_id, auth.uid(), 'pii_reveal', 'members', v_member.id,
          jsonb_build_object('field', _field));

  RETURN v_plain;
END;
$function$;

DROP POLICY IF EXISTS members_delete ON public.members;
CREATE POLICY members_delete ON public.members FOR DELETE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']));

DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events FOR DELETE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']));

DROP POLICY IF EXISTS calendar_events_update ON public.calendar_events;
CREATE POLICY calendar_events_update ON public.calendar_events FOR UPDATE TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']));

-- 3) Positions reference table
CREATE TABLE public.positions (
  id smallint PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  scope text NOT NULL DEFAULT 'capitulo',
  sort_order smallint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY positions_select ON public.positions FOR SELECT TO authenticated USING (true);

INSERT INTO public.positions (id, code, label, scope, sort_order) VALUES
 (1,'mestre_conselheiro','Mestre Conselheiro','capitulo',1),
 (2,'primeiro_conselheiro','Primeiro Conselheiro','capitulo',2),
 (3,'segundo_conselheiro','Segundo Conselheiro','capitulo',3),
 (4,'escrivao','Escrivão','capitulo',4),
 (5,'tesoureiro','Tesoureiro','capitulo',5),
 (6,'mestre_cerimonias','Mestre de Cerimônias','capitulo',6),
 (7,'orador','Orador','capitulo',7),
 (8,'hospitaleiro','Hospitaleiro','capitulo',8),
 (9,'capelao','Capelão','capitulo',9),
 (10,'primeiro_diacono','Primeiro Diácono','capitulo',10),
 (11,'segundo_diacono','Segundo Diácono','capitulo',11),
 (12,'primeiro_mordomo','Primeiro Mordomo','capitulo',12),
 (13,'segundo_mordomo','Segundo Mordomo','capitulo',13),
 (14,'porta_bandeira','Porta Bandeira','capitulo',14),
 (15,'sentinela','Sentinela','capitulo',15),
 (16,'organista','Organista','capitulo',16),
 (17,'primeiro_preceptor','Primeiro Preceptor','capitulo',17),
 (18,'segundo_preceptor','Segundo Preceptor','capitulo',18),
 (19,'terceiro_preceptor','Terceiro Preceptor','capitulo',19),
 (20,'quarto_preceptor','Quarto Preceptor','capitulo',20),
 (21,'quinto_preceptor','Quinto Preceptor','capitulo',21),
 (22,'sexto_preceptor','Sexto Preceptor','capitulo',22),
 (23,'setimo_preceptor','Sétimo Preceptor','capitulo',23),
 (24,'presidente_conselho_consultivo','Presidente do Conselho Consultivo','consultivo',30),
 (25,'conselheiro_consultor','Conselheiro Consultor','consultivo',31);

-- 4) Member positions (with term)
CREATE TABLE public.member_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  position_id smallint NOT NULL REFERENCES public.positions(id),
  term_year smallint NOT NULL,
  term_semester smallint NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, position_id, term_year, term_semester)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_positions TO authenticated;
GRANT ALL ON public.member_positions TO service_role;
ALTER TABLE public.member_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_positions_select ON public.member_positions FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));
CREATE POLICY member_positions_write ON public.member_positions FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total']));
CREATE TRIGGER member_positions_set_updated_at BEFORE UPDATE ON public.member_positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_validate_member_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_scope text;
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = NEW.member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  IF v_member.chapter_id <> NEW.chapter_id THEN
    RAISE EXCEPTION 'Membro não pertence a este capítulo';
  END IF;
  IF NEW.term_semester NOT IN (1,2) THEN
    RAISE EXCEPTION 'Semestre deve ser 1 ou 2';
  END IF;
  SELECT scope INTO v_scope FROM public.positions WHERE id = NEW.position_id;
  IF v_scope = 'consultivo' THEN
    IF v_member.birth_date IS NULL OR v_member.birth_date > (current_date - interval '21 years') THEN
      RAISE EXCEPTION 'Cargos do Conselho Consultivo exigem 21 anos ou mais';
    END IF;
  ELSE
    IF v_member.exam_grau_demolay IS NULL THEN
      RAISE EXCEPTION 'Somente membros com grau DeMolay podem assumir cargos do capítulo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_positions_validate BEFORE INSERT OR UPDATE ON public.member_positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_member_position();

-- 5) Commissions
CREATE TABLE public.commissions (
  id smallint PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissions_select ON public.commissions FOR SELECT TO authenticated USING (true);

INSERT INTO public.commissions (id, code, label, sort_order) VALUES
 (1,'midia','Mídia',1),
 (2,'novos_membros','Novos Membros',2),
 (3,'manutencao','Manutenção',3),
 (4,'eventos','Eventos',4),
 (5,'entretenimento','Entretenimento',5),
 (6,'hospitalaria','Hospitalaria',6),
 (7,'auditoria','Auditoria',7),
 (8,'financas','Finanças',8);

CREATE TYPE public.commission_role AS ENUM ('presidente','vice','membro','auxiliar_senior');

CREATE TABLE public.commission_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  commission_id smallint NOT NULL REFERENCES public.commissions(id),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role public.commission_role NOT NULL DEFAULT 'membro',
  term_year smallint NOT NULL,
  term_semester smallint NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, commission_id, member_id, term_year, term_semester)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_members TO authenticated;
GRANT ALL ON public.commission_members TO service_role;
ALTER TABLE public.commission_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_members_select ON public.commission_members FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));
CREATE POLICY commission_members_write ON public.commission_members FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','presidente_comissao']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_total','presidente_comissao']));
CREATE TRIGGER commission_members_set_updated_at BEFORE UPDATE ON public.commission_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_validate_commission_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter uuid;
BEGIN
  SELECT chapter_id INTO v_chapter FROM public.members WHERE id = NEW.member_id;
  IF v_chapter IS NULL OR v_chapter <> NEW.chapter_id THEN
    RAISE EXCEPTION 'Membro não pertence a este capítulo';
  END IF;
  IF NEW.term_semester NOT IN (1,2) THEN
    RAISE EXCEPTION 'Semestre deve ser 1 ou 2';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER commission_members_validate BEFORE INSERT OR UPDATE ON public.commission_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_commission_member();

-- 6) Automatic status rules
CREATE OR REPLACE FUNCTION public.recalc_member_status(_chapter_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Senior DeMolay automatically at 21 years old
  UPDATE public.members
     SET status = 'senior'
   WHERE status = 'ativo'
     AND birth_date IS NOT NULL
     AND birth_date <= (current_date - interval '21 years')
     AND (_chapter_id IS NULL OR chapter_id = _chapter_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Inativo after 12 months of overdue dues: prepared, disabled until the
  -- financial module exists (no dues table yet).

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.recalc_member_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_member_status(uuid) TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('recalc-member-status-daily', '15 3 * * *', $$SELECT public.recalc_member_status();$$);

-- 7) Permission helper
CREATE OR REPLACE FUNCTION public.has_permission(_chapter_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _perm
    WHEN 'secretaria' THEN public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao'])
    WHEN 'tesouraria' THEN public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','tesoureiro'])
    WHEN 'comissoes'  THEN public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_comissao'])
    WHEN 'conselho'   THEN public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','consultor','presidente_conselho'])
    WHEN 'admin'      THEN public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro'])
    ELSE public.is_chapter_member(_chapter_id)
  END;
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- 8) Guardians: support up to two per member
CREATE UNIQUE INDEX guardians_one_primary_per_member
  ON public.guardians (member_id) WHERE is_primary;
