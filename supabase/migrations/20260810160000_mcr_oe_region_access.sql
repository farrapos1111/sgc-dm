-- MCR/OE: poderes regionais (capítulos/membros), cargo ritualístico único e transferência

-- 1) Catálogo de cargos regionais
INSERT INTO public.positions (id, code, label, scope, sort_order) VALUES
  (26, 'mestre_conselheiro_regional', 'Mestre Conselheiro Regional', 'regional', 40),
  (27, 'oficial_executivo', 'Oficial Executivo', 'regional', 41)
ON CONFLICT (id) DO UPDATE
  SET code = EXCLUDED.code,
      label = EXCLUDED.label,
      scope = EXCLUDED.scope,
      sort_order = EXCLUDED.sort_order;

-- 2) member_positions: region_id + ended_at
ALTER TABLE public.member_positions
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.regions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

DROP INDEX IF EXISTS public.member_positions_unique_single_seat;
CREATE UNIQUE INDEX member_positions_unique_single_seat
  ON public.member_positions (chapter_id, position_id, term_year, term_semester)
  WHERE position_id <> 25 AND ended_at IS NULL AND region_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS member_positions_unique_regional_active
  ON public.member_positions (region_id, position_id)
  WHERE region_id IS NOT NULL AND ended_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_leaderships_unique_region_role_active
  ON public.org_leaderships (region_id, org_role)
  WHERE active AND region_id IS NOT NULL AND org_role IN ('mcr', 'oe');

-- 3) Helpers
CREATE OR REPLACE FUNCTION public.is_active_region_office(
  _region_id uuid,
  _roles public.org_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _region_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_leaderships l
    WHERE l.user_id = auth.uid()
      AND l.active
      AND l.region_id = _region_id
      AND l.org_role = ANY (_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_region_chapter(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = _chapter_id
      AND (
        public.is_gme(c.state_id)
        OR (
          c.region_id IS NOT NULL
          AND public.is_active_region_office(c.region_id, ARRAY['mcr', 'oe']::public.org_role[])
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_chapter_in_scope(
  _state_id uuid,
  _region_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_gme(_state_id)
      OR (
        _region_id IS NOT NULL
        AND public.is_active_region_office(_region_id, ARRAY['mcr', 'oe']::public.org_role[])
      );
$$;

REVOKE ALL ON FUNCTION public.is_active_region_office(uuid, public.org_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_region_office(uuid, public.org_role[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_manage_region_chapter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_region_chapter(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_write_chapter_in_scope(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_chapter_in_scope(uuid, uuid) TO authenticated, service_role;

-- 4) Chapters policies
DROP POLICY IF EXISTS chapters_insert_gme ON public.chapters;
CREATE POLICY chapters_insert_gme ON public.chapters FOR INSERT TO authenticated
  WITH CHECK (public.can_write_chapter_in_scope(state_id, region_id));

DROP POLICY IF EXISTS chapters_update_gme ON public.chapters;
CREATE POLICY chapters_update_gme ON public.chapters FOR UPDATE TO authenticated
  USING (public.can_write_chapter_in_scope(state_id, region_id))
  WITH CHECK (public.can_write_chapter_in_scope(state_id, region_id));

-- 5) Members RLS
DROP POLICY IF EXISTS members_insert ON public.members;
CREATE POLICY members_insert ON public.members FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_region_chapter(chapter_id)
    OR (
      public.is_chapter_member(chapter_id)
      AND (
        public.has_permission(chapter_id, 'secretaria')
        OR public.has_permission(chapter_id, 'admin')
      )
    )
  );

DROP POLICY IF EXISTS members_update ON public.members;
CREATE POLICY members_update ON public.members FOR UPDATE TO authenticated
  USING (
    public.can_manage_region_chapter(chapter_id)
    OR (
      public.is_chapter_member(chapter_id)
      AND (
        public.has_permission(chapter_id, 'secretaria')
        OR public.has_permission(chapter_id, 'admin')
        OR public.has_permission(chapter_id, 'conselho')
      )
    )
  )
  WITH CHECK (
    public.can_manage_region_chapter(chapter_id)
    OR (
      public.is_chapter_member(chapter_id)
      AND (
        public.has_permission(chapter_id, 'secretaria')
        OR public.has_permission(chapter_id, 'admin')
        OR public.has_permission(chapter_id, 'conselho')
      )
    )
  );

-- 6) create/update_member_with_pii — permitir gestores regionais
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
  v_region_mgr boolean := public.can_manage_region_chapter(_chapter_id);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _chapter_id IS NULL OR nullif(trim(coalesce(_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes';
  END IF;
  IF NOT v_region_mgr THEN
    IF NOT public.is_chapter_member(_chapter_id) THEN
      RAISE EXCEPTION 'Sem permissão neste capítulo' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_permission(_chapter_id, 'secretaria')
       AND NOT public.has_permission(_chapter_id, 'admin') THEN
      RAISE EXCEPTION 'Sem permissão para criar membros' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_demolay IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.members
    WHERE demolay_id IS NOT NULL AND lower(trim(demolay_id)) = lower(v_demolay)
  ) THEN
    RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
  END IF;

  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      IF v_demolay IS NOT NULL THEN
        RAISE EXCEPTION 'ID DeMolay já cadastrado para outro membro';
      END IF;
      RAISE;
  END;

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
  _demolay_id text DEFAULT NULL::text, _masonic_id text DEFAULT NULL::text,
  _initiation_chapter_id uuid DEFAULT NULL::uuid)
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
  v_region_mgr boolean;
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = _member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  v_region_mgr := public.can_manage_region_chapter(v_member.chapter_id);

  IF NOT v_region_mgr THEN
    IF NOT public.is_chapter_member(v_member.chapter_id) THEN
      RAISE EXCEPTION 'Somente o capítulo originário pode editar os dados cadastrais' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_permission(v_member.chapter_id, 'secretaria')
       AND NOT public.has_permission(v_member.chapter_id, 'admin')
       AND NOT public.has_permission(v_member.chapter_id, 'conselho') THEN
      RAISE EXCEPTION 'Sem permissão para editar este membro' USING ERRCODE = '42501';
    END IF;
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

-- 7) Trigger: cargos regionais
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

  IF v_scope = 'regional' THEN
    IF NEW.region_id IS NULL THEN
      RAISE EXCEPTION 'Cargos regionais exigem região e só podem ser atribuídos via transferência oficial';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = NEW.chapter_id AND c.region_id = NEW.region_id
    ) THEN
      RAISE EXCEPTION 'O membro precisa pertencer a um capítulo da região do cargo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.region_id IS NOT NULL THEN
    RAISE EXCEPTION 'region_id só é permitido em cargos regionais';
  END IF;

  IF v_scope = 'consultivo' THEN
    IF v_member.birth_date IS NULL OR v_member.birth_date > (current_date - interval '21 years') THEN
      RAISE EXCEPTION 'Cargos do Conselho Consultivo exigem 21 anos ou mais';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 8) org_leaderships: leitura para oficiais da mesma região
DROP POLICY IF EXISTS org_leaderships_select_region_office ON public.org_leaderships;
CREATE POLICY org_leaderships_select_region_office ON public.org_leaderships
  FOR SELECT TO authenticated
  USING (
    region_id IS NOT NULL
    AND public.is_active_region_office(region_id, ARRAY['mcr', 'oe']::public.org_role[])
  );

-- 9) RPC transfer_region_office
CREATE OR REPLACE FUNCTION public.transfer_region_office(
  _target_member_id uuid,
  _org_role public.org_role,
  _region_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_region public.regions%ROWTYPE;
  v_position_id smallint;
  v_term_year smallint;
  v_term_semester smallint;
  v_now timestamptz := timezone('America/Sao_Paulo', now());
  v_can_appoint boolean := false;
  v_leadership_id uuid;
  v_position_row_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _org_role NOT IN ('mcr', 'oe') THEN
    RAISE EXCEPTION 'Papel inválido para cargo regional';
  END IF;
  IF _region_id IS NULL OR _target_member_id IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes';
  END IF;

  SELECT * INTO v_region FROM public.regions WHERE id = _region_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Região não encontrada'; END IF;

  -- Hierarquia: GME → ambos; MCR → MCR; OE → OE e MCR
  IF public.is_gme(v_region.state_id) THEN
    v_can_appoint := true;
  ELSIF _org_role = 'mcr' AND (
    public.is_active_region_office(_region_id, ARRAY['mcr']::public.org_role[])
    OR public.is_active_region_office(_region_id, ARRAY['oe']::public.org_role[])
  ) THEN
    v_can_appoint := true;
  ELSIF _org_role = 'oe' AND public.is_active_region_office(_region_id, ARRAY['oe']::public.org_role[]) THEN
    v_can_appoint := true;
  END IF;

  IF NOT v_can_appoint THEN
    RAISE EXCEPTION 'Sem permissão para nomear este cargo nesta região' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = _target_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  IF v_member.user_id IS NULL THEN
    RAISE EXCEPTION 'O membro precisa ter conta vinculada (user_id) antes da nomeação';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = v_member.chapter_id AND c.region_id = _region_id
  ) THEN
    RAISE EXCEPTION 'O nomeado deve ser membro de um capítulo desta região';
  END IF;

  v_position_id := CASE _org_role
    WHEN 'mcr' THEN 26
    WHEN 'oe' THEN 27
  END;

  v_term_year := extract(year from v_now)::smallint;
  v_term_semester := CASE WHEN extract(month from v_now)::int <= 6 THEN 1 ELSE 2 END;

  -- Desativa liderança anterior do mesmo papel+região
  UPDATE public.org_leaderships
     SET active = false, updated_at = now()
   WHERE region_id = _region_id
     AND org_role = _org_role
     AND active;

  -- Encerra cargo ritualístico ativo anterior
  UPDATE public.member_positions
     SET ended_at = now(), updated_at = now()
   WHERE region_id = _region_id
     AND position_id = v_position_id
     AND ended_at IS NULL;

  INSERT INTO public.org_leaderships (
    user_id, org_role, state_id, region_id, active, term_year, term_semester
  ) VALUES (
    v_member.user_id, _org_role, NULL, _region_id, true, v_term_year, v_term_semester
  )
  RETURNING id INTO v_leadership_id;

  INSERT INTO public.member_positions (
    chapter_id, member_id, position_id, term_year, term_semester,
    region_id, created_by, notes
  ) VALUES (
    v_member.chapter_id, v_member.id, v_position_id, v_term_year, v_term_semester,
    _region_id, auth.uid(), 'Nomeação regional'
  )
  RETURNING id INTO v_position_row_id;

  RETURN jsonb_build_object(
    'leadership_id', v_leadership_id,
    'member_position_id', v_position_row_id,
    'user_id', v_member.user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid) TO authenticated, service_role;

-- 10) Bootstrap MCR Serra — Demolay 107722
DO $$
DECLARE
  v_region_id uuid := '2e8cd989-1f7a-4516-96fa-6895bb59e360'; -- Serra
  v_member public.members%ROWTYPE;
  v_now timestamptz := timezone('America/Sao_Paulo', now());
  v_year smallint;
  v_sem smallint;
BEGIN
  SELECT * INTO v_member
  FROM public.members
  WHERE demolay_id IS NOT NULL AND lower(trim(demolay_id)) = '107722'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE 'Bootstrap MCR: membro 107722 não encontrado — pulando';
    RETURN;
  END IF;
  IF v_member.user_id IS NULL THEN
    RAISE NOTICE 'Bootstrap MCR: membro 107722 sem user_id — pulando';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chapters c
    WHERE c.id = v_member.chapter_id AND c.region_id = v_region_id
  ) THEN
    RAISE NOTICE 'Bootstrap MCR: membro 107722 fora da Serra — pulando';
    RETURN;
  END IF;

  v_year := extract(year from v_now)::smallint;
  v_sem := CASE WHEN extract(month from v_now)::int <= 6 THEN 1 ELSE 2 END;

  UPDATE public.org_leaderships
     SET active = false, updated_at = now()
   WHERE region_id = v_region_id AND org_role = 'mcr' AND active;

  UPDATE public.member_positions
     SET ended_at = now(), updated_at = now()
   WHERE region_id = v_region_id AND position_id = 26 AND ended_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_leaderships
    WHERE user_id = v_member.user_id AND org_role = 'mcr' AND region_id = v_region_id AND active
  ) THEN
    INSERT INTO public.org_leaderships (
      user_id, org_role, state_id, region_id, active, term_year, term_semester
    ) VALUES (
      v_member.user_id, 'mcr', NULL, v_region_id, true, v_year, v_sem
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.member_positions
    WHERE member_id = v_member.id AND position_id = 26 AND region_id = v_region_id AND ended_at IS NULL
  ) THEN
    INSERT INTO public.member_positions (
      chapter_id, member_id, position_id, term_year, term_semester,
      region_id, notes
    ) VALUES (
      v_member.chapter_id, v_member.id, 26, v_year, v_sem,
      v_region_id, 'Bootstrap MCR Serra'
    );
  END IF;
END;
$$;
