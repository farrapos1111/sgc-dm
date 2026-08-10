-- Public organization join requests (from login form).

CREATE TABLE IF NOT EXISTS public.org_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_type text NOT NULL
    CHECK (org_type IN (
      'loja', 'bethel', 'capitulo', 'priorado', 'castelo', 'apj', 'outro'
    )),
  org_type_other text NULL,
  name_number text NOT NULL,
  full_address text NOT NULL,
  founded_on date NOT NULL,
  active_members_band text NOT NULL
    CHECK (active_members_band IN ('5-10', '10-25', '25-30', '30+')),
  sponsoring_lodge text NULL,
  responsible_name text NOT NULL,
  responsible_phone text NOT NULL,
  responsible_email text NOT NULL,
  responsible_role text NOT NULL,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped')),
  email_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_join_requests_outro_ck CHECK (
    (org_type = 'outro' AND nullif(trim(org_type_other), '') IS NOT NULL)
    OR (org_type <> 'outro' AND org_type_other IS NULL)
  ),
  CONSTRAINT org_join_requests_lodge_ck CHECK (
    (org_type = 'loja' AND sponsoring_lodge IS NULL)
    OR (org_type <> 'loja' AND nullif(trim(sponsoring_lodge), '') IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS org_join_requests_created_at_idx
  ON public.org_join_requests (created_at DESC);

ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;

-- No direct client access; inserts via SECURITY DEFINER RPC only.

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
    'loja', 'bethel', 'capitulo', 'priorado', 'castelo', 'apj', 'outro'
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
    responsible_role,
    email_status
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
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_org_join_request(
  text, text, text, text, date, text, text, text, text, text, text
) TO anon, authenticated;
