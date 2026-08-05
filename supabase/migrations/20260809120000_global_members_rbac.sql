-- =========================================================
-- Membros globais, capítulo de iniciação, solicitações e RBAC
-- chapter_id em members = capítulo originário (dono do cadastro mestre)
-- =========================================================

-- 1) initiation_chapter_id
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS initiation_chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.members.chapter_id IS
  'Capítulo originário (dono do cadastro mestre). Afiliações adicionais ficam em member_chapter_affiliations.';
COMMENT ON COLUMN public.members.initiation_chapter_id IS
  'Capítulo de iniciação do membro (selecionável).';

CREATE INDEX IF NOT EXISTS members_initiation_chapter_idx
  ON public.members (initiation_chapter_id)
  WHERE initiation_chapter_id IS NOT NULL;

-- Default: iniciação = originário para registros existentes
UPDATE public.members
   SET initiation_chapter_id = chapter_id
 WHERE initiation_chapter_id IS NULL;

-- 2) demolay_id único (normalizado)
DO $$
DECLARE
  v_dups text;
BEGIN
  SELECT string_agg(d, ', ' ORDER BY d) INTO v_dups
  FROM (
    SELECT lower(trim(demolay_id)) AS d
    FROM public.members
    WHERE demolay_id IS NOT NULL AND length(trim(demolay_id)) > 0
    GROUP BY lower(trim(demolay_id))
    HAVING count(*) > 1
  ) t;
  IF v_dups IS NOT NULL THEN
    RAISE EXCEPTION
      'Não é possível criar UNIQUE em demolay_id: duplicatas encontradas (%). Consolide antes.',
      v_dups;
  END IF;
END $$;

UPDATE public.members
   SET demolay_id = nullif(trim(demolay_id), '')
 WHERE demolay_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS members_demolay_id_unique
  ON public.members (lower(trim(demolay_id)))
  WHERE demolay_id IS NOT NULL AND length(trim(demolay_id)) > 0;

-- 3) Afiliações N:N
CREATE TABLE IF NOT EXISTS public.member_chapter_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS member_chapter_affiliations_chapter_idx
  ON public.member_chapter_affiliations (chapter_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS member_chapter_affiliations_member_idx
  ON public.member_chapter_affiliations (member_id);

COMMENT ON TABLE public.member_chapter_affiliations IS
  'Vínculo N:N membro ↔ capítulo. Cargos/histórico ficam em member_positions/commission_members.';

DROP TRIGGER IF EXISTS member_chapter_affiliations_updated ON public.member_chapter_affiliations;
CREATE TRIGGER member_chapter_affiliations_updated
  BEFORE UPDATE ON public.member_chapter_affiliations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.member_chapter_affiliations (member_id, chapter_id, active, joined_at, created_by)
SELECT m.id, m.chapter_id, true, coalesce(m.created_at, now()), m.created_by
FROM public.members m
ON CONFLICT (member_id, chapter_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_chapter_affiliations TO authenticated;
GRANT ALL ON public.member_chapter_affiliations TO service_role;
ALTER TABLE public.member_chapter_affiliations ENABLE ROW LEVEL SECURITY;

-- 4) Solicitações de alteração de dados mestres
DO $$ BEGIN
  CREATE TYPE public.member_change_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.member_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  requesting_chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  origin_chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status public.member_change_request_status NOT NULL DEFAULT 'pending',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_change_requests_origin_pending_idx
  ON public.member_change_requests (origin_chapter_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS member_change_requests_member_idx
  ON public.member_change_requests (member_id, created_at DESC);

DROP TRIGGER IF EXISTS member_change_requests_updated ON public.member_change_requests;
CREATE TRIGGER member_change_requests_updated
  BEFORE UPDATE ON public.member_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.member_change_requests TO authenticated;
GRANT ALL ON public.member_change_requests TO service_role;
ALTER TABLE public.member_change_requests ENABLE ROW LEVEL SECURITY;

-- 5) Helpers
CREATE OR REPLACE FUNCTION public.current_term_year()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT extract(year from (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;
$$;

CREATE OR REPLACE FUNCTION public.current_term_semester()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN extract(month from (now() AT TIME ZONE 'America/Sao_Paulo'))::integer <= 6 THEN 1
    ELSE 2
  END;
$$;

CREATE OR REPLACE FUNCTION public.member_visible_in_chapter(_member_id uuid, _chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id AND m.chapter_id = _chapter_id
  )
  OR EXISTS (
    SELECT 1 FROM public.member_chapter_affiliations a
    WHERE a.member_id = _member_id
      AND a.chapter_id = _chapter_id
      AND a.active
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_member(_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = _member_id
      AND (
        public.can_read_chapter(m.chapter_id)
        OR EXISTS (
          SELECT 1 FROM public.member_chapter_affiliations a
          WHERE a.member_id = m.id
            AND a.active
            AND public.can_read_chapter(a.chapter_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_current_position(_chapter_id uuid, _codes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.member_positions mp ON mp.member_id = m.id
    JOIN public.positions p ON p.id = mp.position_id
    WHERE m.user_id = auth.uid()
      AND mp.chapter_id = _chapter_id
      AND mp.term_year = public.current_term_year()
      AND mp.term_semester = public.current_term_semester()
      AND p.code = ANY(_codes)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_commission_role(
  _chapter_id uuid,
  _commission_code text,
  _roles text[] DEFAULT ARRAY['presidente','vice','membro','auxiliar_senior']
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.commission_members cm ON cm.member_id = m.id
    JOIN public.commissions c ON c.id = cm.commission_id
    WHERE m.user_id = auth.uid()
      AND cm.chapter_id = _chapter_id
      AND cm.term_year = public.current_term_year()
      AND cm.term_semester = public.current_term_semester()
      AND c.code = _commission_code
      AND cm.role::text = ANY(_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.current_term_year() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_term_semester() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.member_visible_in_chapter(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_current_position(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_commission_role(uuid, text, text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_term_year() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_term_semester() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.member_visible_in_chapter(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_current_position(uuid, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_commission_role(uuid, text, text[]) TO authenticated, service_role;

-- 6) has_permission ampliado (roles + cargos do termo)
CREATE OR REPLACE FUNCTION public.has_permission(_chapter_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _perm
    WHEN 'admin' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'secretaria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','escrivao','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'tesouraria' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','tesoureiro'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','tesoureiro','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'comissoes' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_comissao'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','escrivao','presidente_conselho_consultivo','conselheiro_consultor']
         )
      OR public.has_any_role(_chapter_id, ARRAY['consultor','presidente_conselho'])
    WHEN 'conselho' THEN
      public.has_any_role(_chapter_id, ARRAY['admin_total','mestre_conselheiro','consultor','presidente_conselho'])
      OR public.has_current_position(
           _chapter_id,
           ARRAY['mestre_conselheiro','presidente_conselho_consultivo','conselheiro_consultor']
         )
    WHEN 'visualizar' THEN
      public.is_chapter_member(_chapter_id)
      OR public.has_current_position(
           _chapter_id,
           ARRAY['primeiro_conselheiro','segundo_conselheiro']
         )
    WHEN 'visualizar_total' THEN
      public.has_any_role(_chapter_id, ARRAY[
        'admin_total','mestre_conselheiro','escrivao','tesoureiro',
        'consultor','presidente_conselho','presidente_comissao'
      ])
      OR public.has_current_position(
           _chapter_id,
           ARRAY[
             'mestre_conselheiro','escrivao','tesoureiro',
             'presidente_conselho_consultivo','conselheiro_consultor',
             'primeiro_conselheiro','segundo_conselheiro'
           ]
         )
    ELSE public.is_chapter_member(_chapter_id)
  END;
$$;

-- 7) RLS members: leitura por afiliação; update só no originário com secretaria/admin
DROP POLICY IF EXISTS members_select ON public.members;
CREATE POLICY members_select ON public.members FOR SELECT TO authenticated
  USING (public.can_read_member(id));

DROP POLICY IF EXISTS members_insert ON public.members;
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND public.has_permission(chapter_id, 'secretaria')
  );

DROP POLICY IF EXISTS members_update ON public.members;
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated
  USING (
    public.is_chapter_member(chapter_id)
    AND (
      public.has_permission(chapter_id, 'secretaria')
      OR public.has_permission(chapter_id, 'admin')
      OR public.has_permission(chapter_id, 'conselho')
    )
  )
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND (
      public.has_permission(chapter_id, 'secretaria')
      OR public.has_permission(chapter_id, 'admin')
      OR public.has_permission(chapter_id, 'conselho')
    )
  );

-- 8) RLS affiliations
DROP POLICY IF EXISTS mca_select ON public.member_chapter_affiliations;
CREATE POLICY mca_select ON public.member_chapter_affiliations FOR SELECT TO authenticated
  USING (
    public.can_read_chapter(chapter_id)
    OR public.can_read_member(member_id)
  );

DROP POLICY IF EXISTS mca_insert ON public.member_chapter_affiliations;
CREATE POLICY mca_insert ON public.member_chapter_affiliations FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND public.has_permission(chapter_id, 'secretaria')
  );

DROP POLICY IF EXISTS mca_update ON public.member_chapter_affiliations;
CREATE POLICY mca_update ON public.member_chapter_affiliations FOR UPDATE TO authenticated
  USING (
    public.is_chapter_member(chapter_id)
    AND public.has_permission(chapter_id, 'secretaria')
  )
  WITH CHECK (
    public.is_chapter_member(chapter_id)
    AND public.has_permission(chapter_id, 'secretaria')
  );

DROP POLICY IF EXISTS mca_delete ON public.member_chapter_affiliations;
CREATE POLICY mca_delete ON public.member_chapter_affiliations FOR DELETE TO authenticated
  USING (
    public.is_chapter_member(chapter_id)
    AND public.has_permission(chapter_id, 'admin')
  );

-- 9) RLS change requests
DROP POLICY IF EXISTS mcr_select ON public.member_change_requests;
CREATE POLICY mcr_select ON public.member_change_requests FOR SELECT TO authenticated
  USING (
    public.is_chapter_member(origin_chapter_id)
    OR public.is_chapter_member(requesting_chapter_id)
  );

DROP POLICY IF EXISTS mcr_insert ON public.member_change_requests;
CREATE POLICY mcr_insert ON public.member_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chapter_member(requesting_chapter_id)
    AND public.has_permission(requesting_chapter_id, 'secretaria')
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS mcr_update ON public.member_change_requests;
CREATE POLICY mcr_update ON public.member_change_requests FOR UPDATE TO authenticated
  USING (
    public.is_chapter_member(origin_chapter_id)
    AND (
      public.has_permission(origin_chapter_id, 'secretaria')
      OR public.has_permission(origin_chapter_id, 'admin')
    )
  )
  WITH CHECK (
    public.is_chapter_member(origin_chapter_id)
    AND (
      public.has_permission(origin_chapter_id, 'secretaria')
      OR public.has_permission(origin_chapter_id, 'admin')
    )
  );

-- 10) Lista de capítulos para select (iniciação)
CREATE OR REPLACE FUNCTION public.list_chapters_for_select()
RETURNS TABLE (id uuid, name text, number text, city text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.number, c.city
  FROM public.chapters c
  WHERE c.active = true
    AND auth.uid() IS NOT NULL
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.list_chapters_for_select() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chapters_for_select() TO authenticated, service_role;

-- 11) Lookup por demolay_id (para vínculo)
CREATE OR REPLACE FUNCTION public.lookup_member_by_demolay_id(_demolay_id text, _for_chapter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_member public.members%ROWTYPE;
  v_affiliated boolean;
  v_positions jsonb;
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.is_chapter_member(_for_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(_for_chapter_id, 'secretaria')
     AND NOT public.has_permission(_for_chapter_id, 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para buscar membros' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE demolay_id IS NOT NULL
    AND lower(trim(demolay_id)) = lower(v_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.member_chapter_affiliations a
    WHERE a.member_id = v_member.id
      AND a.chapter_id = _for_chapter_id
      AND a.active
  ) INTO v_affiliated;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'label', p.label,
      'term_year', mp.term_year,
      'term_semester', mp.term_semester,
      'chapter_name', ch.name,
      'chapter_number', ch.number
    )
    ORDER BY mp.term_year DESC, mp.term_semester DESC
  ), '[]'::jsonb)
  INTO v_positions
  FROM public.member_positions mp
  JOIN public.positions p ON p.id = mp.position_id
  JOIN public.chapters ch ON ch.id = mp.chapter_id
  WHERE mp.member_id = v_member.id;

  RETURN jsonb_build_object(
    'id', v_member.id,
    'chapter_id', v_member.chapter_id,
    'initiation_chapter_id', v_member.initiation_chapter_id,
    'full_name', v_member.full_name,
    'birth_date', v_member.birth_date,
    'status', v_member.status,
    'kind', v_member.kind,
    'phone', v_member.phone,
    'email', v_member.email,
    'address', v_member.address,
    'demolay_id', v_member.demolay_id,
    'masonic_id', v_member.masonic_id,
    'exam_grau_iniciatico', v_member.exam_grau_iniciatico,
    'exam_grau_demolay', v_member.exam_grau_demolay,
    'iniciacao_ordem', v_member.iniciacao_ordem,
    'iniciacao_grau_demolay', v_member.iniciacao_grau_demolay,
    'already_affiliated', v_affiliated,
    'position_history', v_positions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_member_by_demolay_id(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_member_by_demolay_id(text, uuid) TO authenticated, service_role;

-- 12) Afiliar membro existente a um capítulo
CREATE OR REPLACE FUNCTION public.affiliate_member_to_chapter(_member_id uuid, _chapter_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_chapter_member(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(_chapter_id, 'secretaria')
     AND NOT public.has_permission(_chapter_id, 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para afiliar membros' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = _member_id) THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  INSERT INTO public.member_chapter_affiliations (member_id, chapter_id, active, created_by)
  VALUES (_member_id, _chapter_id, true, auth.uid())
  ON CONFLICT (member_id, chapter_id) DO UPDATE
    SET active = true,
        left_at = NULL,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.affiliate_member_to_chapter(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_member_to_chapter(uuid, uuid) TO authenticated, service_role;

-- 13) Atualizar create/update_member_with_pii com initiation + afiliação + demolay unique
DROP FUNCTION IF EXISTS public.create_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  jsonb, text, date, date, date, date, text, text
);
DROP FUNCTION IF EXISTS public.update_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  date, date, jsonb, date, date, text, text
);

CREATE OR REPLACE FUNCTION public.create_member_with_pii(
  _chapter_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status, _kind member_kind,
  _guardian jsonb, _consent_text_version text,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date,
  _demolay_id text DEFAULT NULL, _masonic_id text DEFAULT NULL,
  _initiation_chapter_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
  v_guardian_id uuid;
  v_cpf_clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_rg_clean  text := regexp_replace(coalesce(_rg,''),  '\D', '', 'g');
  v_g_cpf_clean text;
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_init uuid := coalesce(_initiation_chapter_id, _chapter_id);
BEGIN
  IF NOT public.is_chapter_member(_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
  END IF;

  IF v_demolay IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE demolay_id IS NOT NULL AND lower(trim(demolay_id)) = lower(v_demolay)
  ) THEN
    RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
  END IF;

  INSERT INTO public.members(
    chapter_id, initiation_chapter_id, full_name, birth_date,
    cpf_encrypted, cpf_last2, rg_encrypted, rg_last2,
    phone, email, address, status, kind, created_by,
    exam_grau_iniciatico, exam_grau_demolay, iniciacao_ordem, iniciacao_grau_demolay,
    demolay_id, masonic_id
  ) VALUES (
    _chapter_id, v_init, _full_name, _birth_date,
    CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) END,
    CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) END,
    CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) END,
    CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) END,
    _phone, _email, coalesce(_address, '{}'::jsonb),
    coalesce(_status, 'regular'), coalesce(_kind, 'demolay_ativo'), auth.uid(),
    _exam_grau_iniciatico, _exam_grau_demolay, _iniciacao_ordem, _iniciacao_grau_demolay,
    v_demolay,
    nullif(trim(coalesce(_masonic_id, '')), '')
  ) RETURNING id INTO v_member_id;

  INSERT INTO public.member_chapter_affiliations (member_id, chapter_id, active, created_by)
  VALUES (v_member_id, _chapter_id, true, auth.uid())
  ON CONFLICT (member_id, chapter_id) DO NOTHING;

  IF _guardian IS NOT NULL AND (_guardian ? 'full_name') AND length(coalesce(_guardian->>'full_name','')) > 0 THEN
    v_g_cpf_clean := regexp_replace(coalesce(_guardian->>'cpf',''), '\D', '', 'g');
    INSERT INTO public.guardians(
      member_id, full_name, relationship,
      cpf_encrypted, cpf_last2, phone, email, is_primary
    ) VALUES (
      v_member_id,
      _guardian->>'full_name',
      _guardian->>'relationship',
      CASE WHEN length(v_g_cpf_clean) > 0 THEN public.encrypt_pii(v_g_cpf_clean) END,
      CASE WHEN length(v_g_cpf_clean) >= 2 THEN right(v_g_cpf_clean, 2) END,
      _guardian->>'phone',
      _guardian->>'email',
      true
    ) RETURNING id INTO v_guardian_id;
  END IF;

  IF _consent_text_version IS NOT NULL AND length(_consent_text_version) > 0 THEN
    INSERT INTO public.lgpd_consents(
      member_id, guardian_id, consent_text_version, signed_by_user_id
    ) VALUES (
      v_member_id, v_guardian_id, _consent_text_version, auth.uid()
    );
  END IF;

  RETURN v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_with_pii(
  _member_id uuid, _full_name text, _birth_date date, _cpf text, _rg text, _phone text,
  _email text, _address jsonb, _status member_status, _kind member_kind,
  _exam_grau_iniciatico date DEFAULT NULL::date, _exam_grau_demolay date DEFAULT NULL::date,
  _guardians jsonb DEFAULT NULL::jsonb,
  _iniciacao_ordem date DEFAULT NULL::date, _iniciacao_grau_demolay date DEFAULT NULL::date,
  _demolay_id text DEFAULT NULL, _masonic_id text DEFAULT NULL,
  _initiation_chapter_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_member public.members%ROWTYPE;
  v_cpf_clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  v_rg_clean  text := regexp_replace(coalesce(_rg,''),  '\D', '', 'g');
  v_g jsonb;
  v_g_cpf text;
  v_is_primary boolean := true;
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;
  -- Somente o capítulo originário pode editar dados mestres
  IF NOT public.is_chapter_member(v_member.chapter_id) THEN
    RAISE EXCEPTION 'Somente o capítulo originário pode editar os dados cadastrais' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(v_member.chapter_id, 'secretaria')
     AND NOT public.has_permission(v_member.chapter_id, 'admin')
     AND NOT public.has_permission(v_member.chapter_id, 'conselho') THEN
    RAISE EXCEPTION 'Sem permissão para editar este membro' USING ERRCODE = '42501';
  END IF;

  IF v_demolay IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE id <> _member_id
      AND demolay_id IS NOT NULL
      AND lower(trim(demolay_id)) = lower(v_demolay)
  ) THEN
    RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
  END IF;

  UPDATE public.members SET
    full_name = _full_name,
    birth_date = _birth_date,
    phone = _phone,
    email = _email,
    address = coalesce(_address, '{}'::jsonb),
    status = coalesce(_status, v_member.status),
    kind = coalesce(_kind, v_member.kind),
    exam_grau_iniciatico = _exam_grau_iniciatico,
    exam_grau_demolay = _exam_grau_demolay,
    iniciacao_ordem = _iniciacao_ordem,
    iniciacao_grau_demolay = _iniciacao_grau_demolay,
    demolay_id = v_demolay,
    masonic_id = nullif(trim(coalesce(_masonic_id, '')), ''),
    initiation_chapter_id = coalesce(_initiation_chapter_id, initiation_chapter_id),
    cpf_encrypted = CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) ELSE cpf_encrypted END,
    cpf_last2 = CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) ELSE cpf_last2 END,
    rg_encrypted = CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) ELSE rg_encrypted END,
    rg_last2 = CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) ELSE rg_last2 END,
    updated_at = now()
  WHERE id = _member_id;

  IF _guardians IS NOT NULL AND jsonb_typeof(_guardians) = 'array' THEN
    DELETE FROM public.guardians WHERE member_id = _member_id;
    FOR v_g IN SELECT * FROM jsonb_array_elements(_guardians)
    LOOP
      IF length(coalesce(v_g->>'full_name','')) > 0 THEN
        v_g_cpf := regexp_replace(coalesce(v_g->>'cpf',''), '\D', '', 'g');
        INSERT INTO public.guardians(member_id, full_name, relationship, cpf_encrypted, cpf_last2, phone, email, is_primary)
        VALUES (
          _member_id,
          v_g->>'full_name',
          v_g->>'relationship',
          CASE WHEN length(v_g_cpf) > 0 THEN public.encrypt_pii(v_g_cpf) END,
          CASE WHEN length(v_g_cpf) >= 2 THEN right(v_g_cpf, 2) END,
          v_g->>'phone',
          v_g->>'email',
          v_is_primary
        );
        v_is_primary := false;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (chapter_id, user_id, action, table_name, record_id, new_value)
  VALUES (v_member.chapter_id, auth.uid(), 'member_update', 'members', _member_id,
          jsonb_build_object('full_name', _full_name, 'status', _status, 'kind', _kind));

  RETURN _member_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  jsonb, text, date, date, date, date, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  jsonb, text, date, date, date, date, text, text, uuid
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  date, date, jsonb, date, date, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_with_pii(
  uuid, text, date, text, text, text, text, jsonb, public.member_status, public.member_kind,
  date, date, jsonb, date, date, text, text, uuid
) TO authenticated, service_role;

-- Manter grants das assinaturas antigas (Postgres permite overload; callers novos usam a com uuid)
-- Re-grant assinaturas anteriores se ainda existirem (não dropar para evitar downtime em deploys parciais)
