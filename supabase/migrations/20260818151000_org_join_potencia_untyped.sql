-- Aceita potência sem potencia_org_types (mesma semântica de lodgePotencias).

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
  _responsible_role text DEFAULT NULL,
  _potencia_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
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
  v_recent integer;
  v_sponsor_kind text;
BEGIN
  IF v_type IS NULL OR v_type <> ALL (public._org_type_values()) THEN
    RAISE EXCEPTION 'Tipo de organização inválido' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_type_defs d
    WHERE d.org_type = v_type AND d.join_enabled
  ) THEN
    RAISE EXCEPTION 'Tipo de organização não liberado para cadastro' USING ERRCODE = '22023';
  END IF;

  IF _potencia_id IS NULL THEN
    RAISE EXCEPTION 'Informe a potência' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.potencias p WHERE p.id = _potencia_id AND p.active) THEN
    RAISE EXCEPTION 'Potência inválida' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.potencia_org_types pot WHERE pot.potencia_id = _potencia_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.potencia_org_types pot
    WHERE pot.potencia_id = _potencia_id AND pot.org_type = v_type
  ) THEN
    RAISE EXCEPTION 'Este tipo não é suportado pela potência escolhida' USING ERRCODE = '22023';
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

  SELECT d.form_schema->>'sponsor_kind' INTO v_sponsor_kind
  FROM public.org_type_defs d WHERE d.org_type = v_type;

  IF v_sponsor_kind IS NULL OR v_type IN ('loja', 'alumni') THEN
    v_lodge := NULL;
  ELSIF v_lodge IS NULL THEN
    IF v_sponsor_kind = 'capitulo' THEN
      RAISE EXCEPTION 'Informe o capítulo patrocinador' USING ERRCODE = '22023';
    ELSE
      RAISE EXCEPTION 'Informe a loja patrocinadora' USING ERRCODE = '22023';
    END IF;
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

  SELECT count(*)::integer INTO v_recent
  FROM public.org_join_requests
  WHERE created_at > now() - interval '1 hour'
    AND (
      lower(responsible_email) = v_remail
      OR responsible_phone = v_rphone
    );
  IF coalesce(v_recent, 0) >= 3 THEN
    RAISE EXCEPTION 'Muitas solicitações. Tente novamente mais tarde.'
      USING ERRCODE = 'P0001';
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
    responsible_role,
    potencia_id
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
    v_rrole,
    _potencia_id
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text, uuid
) TO anon, authenticated;
