-- Formulário público de atualização cadastral por ID DeMolay
-- RPCs SECURITY DEFINER liberadas para anon + authenticated

CREATE OR REPLACE FUNCTION public.lookup_member_cadastro_by_demolay_id(_demolay_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_member public.members%ROWTYPE;
  v_chapter_name text;
  v_guardians jsonb;
BEGIN
  IF v_id IS NULL OR length(v_id) < 3 THEN
    RAISE EXCEPTION 'Informe um ID DeMolay válido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE demolay_id = v_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado para este ID' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.name INTO v_chapter_name
  FROM public.chapters c
  WHERE c.id = v_member.chapter_id;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'full_name', g.full_name,
      'relationship', coalesce(g.relationship, ''),
      'phone', coalesce(g.phone, ''),
      'email', coalesce(g.email, ''),
      'cpf_last2', g.cpf_last2,
      'is_primary', g.is_primary
    ) ORDER BY g.is_primary DESC, g.full_name
  ), '[]'::jsonb)
  INTO v_guardians
  FROM public.guardians g
  WHERE g.member_id = v_member.id;

  RETURN jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id,
      'chapter_id', v_member.chapter_id,
      'chapter_name', v_chapter_name,
      'full_name', v_member.full_name,
      'birth_date', v_member.birth_date,
      'status', v_member.status,
      'kind', v_member.kind,
      'demolay_id', v_member.demolay_id,
      'masonic_id', v_member.masonic_id,
      'phone', coalesce(v_member.phone, ''),
      'email', coalesce(v_member.email, ''),
      'address', coalesce(v_member.address, '{}'::jsonb),
      'cpf_last2', v_member.cpf_last2,
      'rg_last2', v_member.rg_last2,
      'iniciacao_ordem', v_member.iniciacao_ordem,
      'exam_grau_iniciatico', v_member.exam_grau_iniciatico,
      'iniciacao_grau_demolay', v_member.iniciacao_grau_demolay,
      'exam_grau_demolay', v_member.exam_grau_demolay
    ),
    'guardians', v_guardians
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_member_cadastro_update(
  _demolay_id text,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address jsonb DEFAULT NULL,
  _cpf text DEFAULT NULL,
  _rg text DEFAULT NULL,
  _guardians jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_member public.members%ROWTYPE;
  v_cpf_clean text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_rg_clean text := regexp_replace(coalesce(_rg, ''), '\D', '', 'g');
  v_phone text := nullif(trim(coalesce(_phone, '')), '');
  v_email text := nullif(trim(coalesce(_email, '')), '');
  v_address jsonb := coalesce(_address, '{}'::jsonb);
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_g jsonb;
  v_g_id uuid;
  v_g_row public.guardians%ROWTYPE;
  v_g_cpf text;
  v_g_rel text;
  v_g_phone text;
  v_g_email text;
  v_g_changes jsonb;
  v_guardians_old jsonb := '[]'::jsonb;
  v_guardians_new jsonb := '[]'::jsonb;
  v_changed boolean := false;
BEGIN
  IF v_id IS NULL OR length(v_id) < 3 THEN
    RAISE EXCEPTION 'Informe um ID DeMolay válido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE demolay_id = v_id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado para este ID' USING ERRCODE = 'P0002';
  END IF;

  -- Telefone
  IF coalesce(v_member.phone, '') IS DISTINCT FROM coalesce(v_phone, '') THEN
    v_old := v_old || jsonb_build_object('phone', v_member.phone);
    v_new := v_new || jsonb_build_object('phone', v_phone);
    v_changed := true;
  END IF;

  -- Email
  IF coalesce(v_member.email, '') IS DISTINCT FROM coalesce(v_email, '') THEN
    v_old := v_old || jsonb_build_object('email', v_member.email);
    v_new := v_new || jsonb_build_object('email', v_email);
    v_changed := true;
  END IF;

  -- Endereço
  IF coalesce(v_member.address, '{}'::jsonb) IS DISTINCT FROM v_address THEN
    v_old := v_old || jsonb_build_object('address', coalesce(v_member.address, '{}'::jsonb));
    v_new := v_new || jsonb_build_object('address', v_address);
    v_changed := true;
  END IF;

  -- CPF (só se informado)
  IF length(v_cpf_clean) > 0 THEN
    v_old := v_old || jsonb_build_object('cpf_last2', v_member.cpf_last2);
    v_new := v_new || jsonb_build_object('cpf_last2', right(v_cpf_clean, 2));
    v_changed := true;
  END IF;

  -- RG (só se informado)
  IF length(v_rg_clean) > 0 THEN
    v_old := v_old || jsonb_build_object('rg_last2', v_member.rg_last2);
    v_new := v_new || jsonb_build_object('rg_last2', right(v_rg_clean, 2));
    v_changed := true;
  END IF;

  UPDATE public.members SET
    phone = v_phone,
    email = v_email,
    address = v_address,
    cpf_encrypted = CASE WHEN length(v_cpf_clean) > 0 THEN public.encrypt_pii(v_cpf_clean) ELSE cpf_encrypted END,
    cpf_last2 = CASE WHEN length(v_cpf_clean) >= 2 THEN right(v_cpf_clean, 2) ELSE cpf_last2 END,
    rg_encrypted = CASE WHEN length(v_rg_clean) > 0 THEN public.encrypt_pii(v_rg_clean) ELSE rg_encrypted END,
    rg_last2 = CASE WHEN length(v_rg_clean) >= 2 THEN right(v_rg_clean, 2) ELSE rg_last2 END,
    updated_at = now()
  WHERE id = v_member.id;

  -- Responsáveis: atualiza só relationship/cpf/phone/email (nome permanece)
  IF _guardians IS NOT NULL AND jsonb_typeof(_guardians) = 'array' THEN
    FOR v_g IN SELECT * FROM jsonb_array_elements(_guardians)
    LOOP
      BEGIN
        v_g_id := (v_g->>'id')::uuid;
      EXCEPTION WHEN others THEN
        CONTINUE;
      END;

      SELECT * INTO v_g_row FROM public.guardians
      WHERE id = v_g_id AND member_id = v_member.id;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      v_g_rel := coalesce(v_g->>'relationship', '');
      v_g_phone := nullif(trim(coalesce(v_g->>'phone', '')), '');
      v_g_email := nullif(trim(coalesce(v_g->>'email', '')), '');
      v_g_cpf := regexp_replace(coalesce(v_g->>'cpf', ''), '\D', '', 'g');
      v_g_changes := '{}'::jsonb;

      IF coalesce(v_g_row.relationship, '') IS DISTINCT FROM v_g_rel THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'relationship', jsonb_build_object('old', v_g_row.relationship, 'new', v_g_rel)
        );
      END IF;
      IF coalesce(v_g_row.phone, '') IS DISTINCT FROM coalesce(v_g_phone, '') THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'phone', jsonb_build_object('old', v_g_row.phone, 'new', v_g_phone)
        );
      END IF;
      IF coalesce(v_g_row.email, '') IS DISTINCT FROM coalesce(v_g_email, '') THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'email', jsonb_build_object('old', v_g_row.email, 'new', v_g_email)
        );
      END IF;
      IF length(v_g_cpf) > 0 THEN
        v_g_changes := v_g_changes || jsonb_build_object(
          'cpf_last2', jsonb_build_object('old', v_g_row.cpf_last2, 'new', right(v_g_cpf, 2))
        );
      END IF;

      IF v_g_changes <> '{}'::jsonb THEN
        v_changed := true;
        v_guardians_old := v_guardians_old || jsonb_build_array(jsonb_build_object(
          'id', v_g_row.id,
          'full_name', v_g_row.full_name,
          'before', jsonb_build_object(
            'relationship', v_g_row.relationship,
            'phone', v_g_row.phone,
            'email', v_g_row.email,
            'cpf_last2', v_g_row.cpf_last2
          )
        ));
        v_guardians_new := v_guardians_new || jsonb_build_array(jsonb_build_object(
          'id', v_g_row.id,
          'full_name', v_g_row.full_name,
          'changes', v_g_changes
        ));
      END IF;

      UPDATE public.guardians SET
        relationship = v_g_rel,
        phone = v_g_phone,
        email = v_g_email,
        cpf_encrypted = CASE WHEN length(v_g_cpf) > 0 THEN public.encrypt_pii(v_g_cpf) ELSE cpf_encrypted END,
        cpf_last2 = CASE WHEN length(v_g_cpf) >= 2 THEN right(v_g_cpf, 2) ELSE cpf_last2 END
      WHERE id = v_g_row.id;
    END LOOP;

    IF jsonb_array_length(v_guardians_new) > 0 THEN
      v_old := v_old || jsonb_build_object('guardians', v_guardians_old);
      v_new := v_new || jsonb_build_object('guardians', v_guardians_new);
    END IF;
  END IF;

  IF NOT v_changed THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'member_id', v_member.id);
  END IF;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, old_value, new_value
  ) VALUES (
    v_member.chapter_id,
    NULL,
    'member_cadastro_self_update',
    'members',
    v_member.id,
    v_old || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name),
    v_new || jsonb_build_object('demolay_id', v_member.demolay_id, 'full_name', v_member.full_name, 'source', 'formulario_publico')
  );

  RETURN jsonb_build_object('ok', true, 'changed', true, 'member_id', v_member.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_member_cadastro_by_demolay_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_member_cadastro_by_demolay_id(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_member_cadastro_update(text, text, text, jsonb, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_member_cadastro_update(text, text, text, jsonb, text, text, jsonb) TO anon, authenticated, service_role;
