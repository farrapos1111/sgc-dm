-- =========================================================
-- Extensões
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- Vault: chave simétrica para CPF/RG
-- =========================================================
DO $$
DECLARE
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sgcdm_pii_key') THEN
    v_key := encode(gen_random_bytes(32), 'base64');
    PERFORM vault.create_secret(v_key, 'sgcdm_pii_key', 'Chave simétrica AES para CPF/RG (SG-CDM)');
  END IF;
END $$;

-- =========================================================
-- Funções de criptografia PII
-- =========================================================
CREATE OR REPLACE FUNCTION public.encrypt_pii(_plain text)
RETURNS bytea
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  IF _plain IS NULL OR length(_plain) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'sgcdm_pii_key' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Chave sgcdm_pii_key não configurada no Vault';
  END IF;
  RETURN pgp_sym_encrypt(_plain, v_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(_cipher bytea)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  IF _cipher IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'sgcdm_pii_key' LIMIT 1;
  RETURN pgp_sym_decrypt(_cipher, v_key);
END;
$$;

REVOKE ALL ON FUNCTION public.encrypt_pii(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_pii(bytea) FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Helper para verificar múltiplos papéis
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_any_role(_chapter_id uuid, _role_names text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapter_members cm
    JOIN public.roles r ON r.id = cm.role_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.user_id = auth.uid()
      AND cm.active = true
      AND r.name = ANY(_role_names)
  );
$$;

-- =========================================================
-- Trigger genérico de updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- MEMBROS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.member_status AS ENUM ('ativo','inativo','senior','visitante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  cpf_encrypted bytea,
  cpf_last2 text,
  rg_encrypted bytea,
  rg_last2 text,
  phone text,
  email text,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.member_status NOT NULL DEFAULT 'ativo',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX members_chapter_idx ON public.members(chapter_id);
CREATE INDEX members_full_name_idx ON public.members(chapter_id, full_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated WITH CHECK (public.is_chapter_member(chapter_id));
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated USING (public.is_chapter_member(chapter_id)) WITH CHECK (public.is_chapter_member(chapter_id));
CREATE POLICY members_delete ON public.members FOR DELETE TO authenticated USING (
  public.has_any_role(chapter_id, ARRAY['mestre_conselheiro','escrivao','admin_regional'])
);
CREATE TRIGGER members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Guardians
CREATE TABLE public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  cpf_encrypted bytea,
  cpf_last2 text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardians_member_idx ON public.guardians(member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT ALL ON public.guardians TO service_role;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardians_select ON public.guardians FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = guardians.member_id AND public.is_chapter_member(m.chapter_id))
);
CREATE POLICY guardians_write ON public.guardians FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = guardians.member_id AND public.is_chapter_member(m.chapter_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = guardians.member_id AND public.is_chapter_member(m.chapter_id)));
CREATE TRIGGER guardians_updated BEFORE UPDATE ON public.guardians FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- LGPD consents
CREATE TABLE public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  guardian_id uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  consent_text_version text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  signed_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lgpd_consents_member_idx ON public.lgpd_consents(member_id);

GRANT SELECT, INSERT ON public.lgpd_consents TO authenticated;
GRANT ALL ON public.lgpd_consents TO service_role;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY lgpd_consents_select ON public.lgpd_consents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = lgpd_consents.member_id AND public.is_chapter_member(m.chapter_id))
);
CREATE POLICY lgpd_consents_insert ON public.lgpd_consents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.members m WHERE m.id = lgpd_consents.member_id AND public.is_chapter_member(m.chapter_id))
);

-- =========================================================
-- RPC: revela CPF/RG (com auditoria automática)
-- =========================================================
CREATE OR REPLACE FUNCTION public.reveal_member_pii(_member_id uuid, _field text)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NOT public.has_any_role(v_member.chapter_id, ARRAY['mestre_conselheiro','escrivao','tesoureiro','admin_regional']) THEN
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
$$;

REVOKE ALL ON FUNCTION public.reveal_member_pii(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_member_pii(uuid, text) TO authenticated;

-- =========================================================
-- EVENTOS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('rascunho','publicado','encerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('valido','cancelado','usado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.checkin_method AS ENUM ('qr','nome');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  goal_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'rascunho',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_chapter_idx ON public.events(chapter_id, starts_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));
CREATE POLICY events_write ON public.events FOR ALL TO authenticated
USING (public.is_chapter_member(chapter_id))
WITH CHECK (public.is_chapter_member(chapter_id));
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Ticket types
CREATE TABLE public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity_total integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_types_event_idx ON public.ticket_types(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_types TO authenticated;
GRANT ALL ON public.ticket_types TO service_role;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticket_types_all ON public.ticket_types FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND public.is_chapter_member(e.chapter_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND public.is_chapter_member(e.chapter_id)));

-- Tickets
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  buyer_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  buyer_name text NOT NULL,
  buyer_email text,
  qr_code text NOT NULL UNIQUE DEFAULT ('TKT-' || replace(gen_random_uuid()::text,'-','')),
  status public.ticket_status NOT NULL DEFAULT 'valido',
  price_paid numeric(12,2) NOT NULL DEFAULT 0,
  sold_at timestamptz NOT NULL DEFAULT now(),
  sold_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tickets_event_idx ON public.tickets(event_id);
CREATE INDEX tickets_qr_idx ON public.tickets(qr_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tickets_all ON public.tickets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND public.is_chapter_member(e.chapter_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = tickets.event_id AND public.is_chapter_member(e.chapter_id)));
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Event tables & seats
CREATE TABLE public.event_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  capacity integer NOT NULL DEFAULT 8,
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_tables_event_idx ON public.event_tables(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_tables TO authenticated;
GRANT ALL ON public.event_tables TO service_role;
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_tables_all ON public.event_tables FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tables.event_id AND public.is_chapter_member(e.chapter_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tables.event_id AND public.is_chapter_member(e.chapter_id)));

CREATE TABLE public.seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.event_tables(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(table_id, seat_number)
);
CREATE INDEX seats_table_idx ON public.seats(table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seats TO authenticated;
GRANT ALL ON public.seats TO service_role;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY seats_all ON public.seats FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.event_tables t
  JOIN public.events e ON e.id = t.event_id
  WHERE t.id = seats.table_id AND public.is_chapter_member(e.chapter_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.event_tables t
  JOIN public.events e ON e.id = t.event_id
  WHERE t.id = seats.table_id AND public.is_chapter_member(e.chapter_id)
));

-- Checkins
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by uuid,
  method public.checkin_method NOT NULL DEFAULT 'qr',
  UNIQUE(ticket_id)
);
CREATE INDEX checkins_event_idx ON public.checkins(event_id, checked_in_at DESC);
GRANT SELECT, INSERT, DELETE ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkins_all ON public.checkins FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = checkins.event_id AND public.is_chapter_member(e.chapter_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = checkins.event_id AND public.is_chapter_member(e.chapter_id)));

-- Realtime para checkins
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkins;