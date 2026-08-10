-- Novos org_types (abelhinhas, arco_iris) + role_group/sort_order na junction de cargos.

-- chapters
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_org_type_check;
ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_org_type_check
  CHECK (
    org_type IS NULL
    OR org_type IN (
      'capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro',
      'abelhinhas', 'arco_iris'
    )
  );

COMMENT ON COLUMN public.chapters.org_type IS
  'Tipo: capitulo, bethel, loja, priorado, castelo, apj, outro, abelhinhas, arco_iris.';

-- platform_access_grants
ALTER TABLE public.platform_access_grants
  DROP CONSTRAINT IF EXISTS platform_access_grants_org_type_check;
ALTER TABLE public.platform_access_grants
  ADD CONSTRAINT platform_access_grants_org_type_check
  CHECK (org_type IN (
    'capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro',
    'abelhinhas', 'arco_iris'
  ));

-- platform_access_role_org_types
ALTER TABLE public.platform_access_role_org_types
  DROP CONSTRAINT IF EXISTS platform_access_role_org_types_org_type_check;
ALTER TABLE public.platform_access_role_org_types
  ADD CONSTRAINT platform_access_role_org_types_org_type_check
  CHECK (org_type IN (
    'capitulo', 'bethel', 'loja', 'priorado', 'castelo', 'apj', 'outro',
    'abelhinhas', 'arco_iris'
  ));

ALTER TABLE public.platform_access_role_org_types
  ADD COLUMN IF NOT EXISTS role_group text;

ALTER TABLE public.platform_access_role_org_types
  DROP CONSTRAINT IF EXISTS platform_access_role_org_types_role_group_check;
ALTER TABLE public.platform_access_role_org_types
  ADD CONSTRAINT platform_access_role_org_types_role_group_check
  CHECK (
    role_group IS NULL
    OR role_group IN ('ritualisticos', 'conselho', 'comissoes')
  );

ALTER TABLE public.platform_access_role_org_types
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- org_join_requests
ALTER TABLE public.org_join_requests
  DROP CONSTRAINT IF EXISTS org_join_requests_org_type_check;
ALTER TABLE public.org_join_requests
  ADD CONSTRAINT org_join_requests_org_type_check
  CHECK (org_type IN (
    'loja', 'bethel', 'capitulo', 'priorado', 'castelo', 'apj', 'outro',
    'abelhinhas', 'arco_iris'
  ));

-- Backfill role_group + sort_order a partir do cargo
UPDATE public.platform_access_role_org_types j
SET
  role_group = CASE
    WHEN j.org_type IN ('loja', 'apj', 'arco_iris', 'outro') THEN NULL
    WHEN r.match_kind = 'commission_president'
      OR r.match_code = 'presidente_comissao' THEN 'comissoes'
    WHEN r.match_code IN (
      'presidente_conselho_consultivo',
      'conselheiro_consultor',
      'presidente_conselho',
      'consultor'
    ) THEN 'conselho'
    ELSE 'ritualisticos'
  END,
  sort_order = coalesce(r.sort_order, 0)
FROM public.platform_access_roles r
WHERE r.id = j.role_id
  AND (j.role_group IS NULL OR j.sort_order = 0);

-- Aceitar novos tipos no RPC de pedido de adesão
CREATE OR REPLACE FUNCTION public.submit_org_join_request(
  _org_type text,
  _org_type_other text DEFAULT NULL,
  _name_number text DEFAULT NULL,
  _full_address text DEFAULT NULL,
  _founded_on date DEFAULT NULL,
  _active_members_band text DEFAULT NULL,
  _sponsoring_lodge text DEFAULT NULL,
  _responsible_name text DEFAULT NULL,
  _responsible_phone text DEFAULT NULL,
  _responsible_email text DEFAULT NULL,
  _responsible_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_type text := lower(nullif(trim(coalesce(_org_type, '')), ''));
  v_other text := nullif(trim(coalesce(_org_type_other, '')), '');
  v_name text := nullif(trim(coalesce(_name_number, '')), '');
  v_addr text := nullif(trim(coalesce(_full_address, '')), '');
  v_band text := nullif(trim(coalesce(_active_members_band, '')), '');
  v_lodge text := nullif(trim(coalesce(_sponsoring_lodge, '')), '');
  v_rname text := nullif(trim(coalesce(_responsible_name, '')), '');
  v_rphone text := nullif(trim(coalesce(_responsible_phone, '')), '');
  v_remail text := lower(nullif(trim(coalesce(_responsible_email, '')), ''));
  v_rrole text := nullif(trim(coalesce(_responsible_role, '')), '');
BEGIN
  IF v_type IS NULL OR v_type NOT IN (
    'loja', 'bethel', 'capitulo', 'priorado', 'castelo', 'apj', 'outro',
    'abelhinhas', 'arco_iris'
  ) THEN
    RAISE EXCEPTION 'Tipo de organização inválido' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'outro' THEN
    IF v_other IS NULL THEN
      RAISE EXCEPTION 'Informe o tipo de organização (Outro)' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_other := NULL;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Informe o nome/número' USING ERRCODE = '22023';
  END IF;
  IF v_addr IS NULL THEN
    RAISE EXCEPTION 'Informe o endereço completo' USING ERRCODE = '22023';
  END IF;
  IF _founded_on IS NULL THEN
    RAISE EXCEPTION 'Informe a data de fundação/instalação' USING ERRCODE = '22023';
  END IF;
  IF v_band IS NULL OR v_band NOT IN ('5-10', '10-25', '25-30', '30+') THEN
    RAISE EXCEPTION 'Faixa de membros ativos inválida' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'loja' THEN
    v_lodge := NULL;
  ELSIF v_lodge IS NULL THEN
    RAISE EXCEPTION 'Informe a loja patrocinadora' USING ERRCODE = '22023';
  END IF;

  IF v_rname IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_rphone IS NULL THEN
    RAISE EXCEPTION 'Informe o telefone do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_remail IS NULL OR v_remail !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido do responsável' USING ERRCODE = '22023';
  END IF;
  IF v_rrole IS NULL THEN
    RAISE EXCEPTION 'Informe o cargo do responsável' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.org_join_requests (
    org_type,
    org_type_other,
    name_number,
    full_address,
    founded_on,
    active_members_band,
    sponsoring_lodge,
    responsible_name,
    responsible_phone,
    responsible_email,
    responsible_role
  ) VALUES (
    v_type,
    v_other,
    v_name,
    v_addr,
    _founded_on,
    v_band,
    v_lodge,
    v_rname,
    v_rphone,
    v_remail,
    v_rrole
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$function$;
