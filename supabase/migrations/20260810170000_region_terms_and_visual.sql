-- Prazos MCR (1 ano) / OE (2 anos) + visual de regiões

ALTER TABLE public.org_leaderships
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE public.member_positions
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#9E1B32',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.org_leaderships.starts_on IS 'Início da vigência do cargo regional/estadual';
COMMENT ON COLUMN public.org_leaderships.ends_on IS 'Fim da vigência (MCR=1 ano, OE=2 anos)';

-- Oficiais regionais só contam na vigência
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
      AND (l.starts_on IS NULL OR l.starts_on <= (timezone('America/Sao_Paulo', now()))::date)
      AND (l.ends_on IS NULL OR l.ends_on >= (timezone('America/Sao_Paulo', now()))::date)
  );
$$;

-- GME / MCR / OE podem atualizar visual da própria região
DROP POLICY IF EXISTS regions_update_visual ON public.regions;
CREATE POLICY regions_update_visual ON public.regions
  FOR UPDATE TO authenticated
  USING (
    public.is_gme(state_id)
    OR public.is_active_region_office(id, ARRAY['mcr', 'oe']::public.org_role[])
  )
  WITH CHECK (
    public.is_gme(state_id)
    OR public.is_active_region_office(id, ARRAY['mcr', 'oe']::public.org_role[])
  );

-- transfer_region_office com vigência
CREATE OR REPLACE FUNCTION public.transfer_region_office(
  _target_member_id uuid,
  _org_role public.org_role,
  _region_id uuid,
  _starts_on date DEFAULT NULL
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
  v_starts date;
  v_ends date;
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

  v_position_id := CASE _org_role WHEN 'mcr' THEN 26 WHEN 'oe' THEN 27 END;
  v_starts := coalesce(_starts_on, (v_now)::date);
  -- MCR: 1 ano; OE: 2 anos (mesmo dia do mês no fim)
  v_ends := CASE _org_role
    WHEN 'mcr' THEN (v_starts + interval '1 year')::date
    WHEN 'oe' THEN (v_starts + interval '2 years')::date
  END;

  v_term_year := extract(year from v_starts)::smallint;
  v_term_semester := CASE WHEN extract(month from v_starts)::int <= 6 THEN 1 ELSE 2 END;

  UPDATE public.org_leaderships
     SET active = false, updated_at = now(),
         ends_on = LEAST(coalesce(ends_on, v_starts - 1), v_starts - 1)
   WHERE region_id = _region_id
     AND org_role = _org_role
     AND active;

  UPDATE public.member_positions
     SET ended_at = now(), updated_at = now(),
         ends_on = LEAST(coalesce(ends_on, v_starts - 1), v_starts - 1)
   WHERE region_id = _region_id
     AND position_id = v_position_id
     AND ended_at IS NULL;

  INSERT INTO public.org_leaderships (
    user_id, org_role, state_id, region_id, active, term_year, term_semester,
    starts_on, ends_on
  ) VALUES (
    v_member.user_id, _org_role, NULL, _region_id, true, v_term_year, v_term_semester,
    v_starts, v_ends
  )
  RETURNING id INTO v_leadership_id;

  INSERT INTO public.member_positions (
    chapter_id, member_id, position_id, term_year, term_semester,
    region_id, created_by, notes, starts_on, ends_on
  ) VALUES (
    v_member.chapter_id, v_member.id, v_position_id, v_term_year, v_term_semester,
    _region_id, auth.uid(), 'Nomeação regional', v_starts, v_ends
  )
  RETURNING id INTO v_position_row_id;

  RETURN jsonb_build_object(
    'leadership_id', v_leadership_id,
    'member_position_id', v_position_row_id,
    'user_id', v_member.user_id,
    'starts_on', v_starts,
    'ends_on', v_ends
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid, date) TO authenticated, service_role;

-- Compat: overload antiga (3 args) chama a nova
CREATE OR REPLACE FUNCTION public.transfer_region_office(
  _target_member_id uuid,
  _org_role public.org_role,
  _region_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.transfer_region_office(_target_member_id, _org_role, _region_id, NULL::date);
$$;

REVOKE ALL ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_region_office(uuid, public.org_role, uuid) TO authenticated, service_role;

-- Bootstrap / correção MCR 107722: 10/10/2025 — 10/10/2026
UPDATE public.org_leaderships l
SET
  starts_on = '2025-10-10'::date,
  ends_on = '2026-10-10'::date,
  updated_at = now()
FROM public.members m
WHERE m.user_id = l.user_id
  AND lower(trim(coalesce(m.demolay_id, ''))) = '107722'
  AND l.org_role = 'mcr'
  AND l.active
  AND l.region_id = '2e8cd989-1f7a-4516-96fa-6895bb59e360';

UPDATE public.member_positions mp
SET
  starts_on = '2025-10-10'::date,
  ends_on = '2026-10-10'::date,
  updated_at = now()
FROM public.members m
WHERE m.id = mp.member_id
  AND lower(trim(coalesce(m.demolay_id, ''))) = '107722'
  AND mp.position_id = 26
  AND mp.ended_at IS NULL
  AND mp.region_id = '2e8cd989-1f7a-4516-96fa-6895bb59e360';

CREATE OR REPLACE FUNCTION public.is_region_leader(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.chapters c
    JOIN public.org_leaderships l ON l.region_id = c.region_id
    WHERE c.id = _chapter_id
      AND l.user_id = auth.uid()
      AND l.active = true
      AND l.org_role IN ('mcr','oe')
      AND (l.starts_on IS NULL OR l.starts_on <= (timezone('America/Sao_Paulo', now()))::date)
      AND (l.ends_on IS NULL OR l.ends_on >= (timezone('America/Sao_Paulo', now()))::date)
  );
$function$;
