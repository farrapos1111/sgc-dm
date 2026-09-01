-- Participantes de comissão (membro, auxiliar sênior, vice, presidente): view nas telas do setor.

ALTER TABLE public.platform_access_roles
  DROP CONSTRAINT IF EXISTS platform_access_roles_match_kind_check;
ALTER TABLE public.platform_access_roles
  ADD CONSTRAINT platform_access_roles_match_kind_check
  CHECK (
    match_kind IN (
      'position',
      'role_fallback',
      'commission_president',
      'commission_member',
      'account_role'
    )
  );

INSERT INTO public.platform_access_roles (key, label, is_system, match_kind, match_code, sort_order)
VALUES (
  'commission_member',
  'Participantes de Comissão',
  true,
  'commission_member',
  NULL,
  95
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  is_system = EXCLUDED.is_system,
  match_kind = EXCLUDED.match_kind,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.platform_access_screens (id, label, sort_order)
VALUES
  ('hospitalaria_cardapios', 'Cardápios (Hospitalaria)', 145),
  ('hospitalaria_escala', 'Escala (Hospitalaria)', 146)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

DO $$
DECLARE
  v_role_id uuid;
  v_org text;
  v_s text;
  v_orgs text[];
BEGIN
  SELECT id INTO v_role_id
  FROM public.platform_access_roles
  WHERE key = 'commission_member';

  v_orgs := public._org_type_values();

  FOREACH v_org IN ARRAY v_orgs
  LOOP
    FOREACH v_s IN ARRAY ARRAY[
      'eventos', 'eventos_checkins',
      'sindicancias_fichas', 'sindicancias', 'sindicancias_config',
      'hospitalaria_cardapios', 'hospitalaria_escala'
    ]
    LOOP
      INSERT INTO public.platform_access_grants (
        role_id, org_type, screen_id, can_view, can_edit, can_create, can_delete
      )
      VALUES (v_role_id, v_org, v_s, true, false, false, false)
      ON CONFLICT (role_id, org_type, screen_id) DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_edit = false,
        can_create = false,
        can_delete = false;
    END LOOP;
  END LOOP;
END $$;

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
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.term_year = public.current_term_year()
      AND cm.term_semester = public.current_term_semester()
      AND c.code = _commission_code
      AND cm.role::text = ANY(_roles)
      AND public.is_chapter_member(_chapter_id)
      AND public.is_linked_member(cm.member_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_matching_role_ids(_chapter_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[] := ARRAY[]::uuid[];
  v_role_name text;
  v_year int;
  v_semester int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN v_ids;
  END IF;

  v_year := public.current_term_year();
  v_semester := public.current_term_semester();

  SELECT r.name INTO v_role_name
  FROM public.chapter_members cm
  JOIN public.roles r ON r.id = cm.role_id
  WHERE cm.user_id = v_uid
    AND cm.chapter_id = _chapter_id
    AND cm.active IS TRUE
  LIMIT 1;

  IF v_role_name = 'admin_total' THEN
    RETURN v_ids;
  END IF;

  v_ids := v_ids || ARRAY(
    SELECT id FROM public.platform_access_roles
    WHERE match_kind = 'role_fallback' AND match_code = 'membro'
  );

  IF v_role_name IS NOT NULL THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles
      WHERE match_kind = 'account_role' AND match_code = v_role_name
    );
  END IF;

  v_ids := v_ids || ARRAY(
    SELECT DISTINCT par.id
    FROM public.platform_access_roles par
    JOIN public.positions p ON p.code = par.match_code
    JOIN public.member_positions mp ON mp.position_id = p.id
    JOIN public.members m ON m.id = mp.member_id
    WHERE par.match_kind = 'position'
      AND mp.chapter_id = _chapter_id
      AND mp.term_year = v_year
      AND mp.term_semester = v_semester
      AND mp.ended_at IS NULL
      AND m.user_id = v_uid
  );

  IF EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.term_year = v_year
      AND cm.term_semester = v_semester
      AND cm.role = 'presidente'
      AND m.user_id = v_uid
  ) THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles
      WHERE match_kind = 'commission_president'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.commission_members cm
    WHERE cm.chapter_id = _chapter_id
      AND cm.term_year = v_year
      AND cm.term_semester = v_semester
      AND public.is_linked_member(cm.member_id)
  ) THEN
    v_ids := v_ids || ARRAY(
      SELECT id FROM public.platform_access_roles
      WHERE match_kind = 'commission_member'
    );
  END IF;

  RETURN (SELECT ARRAY(SELECT DISTINCT unnest(v_ids)));
END;
$$;
