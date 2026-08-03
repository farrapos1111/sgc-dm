-- Restringe patch_chapter_settings a allowlist + audit_logs.
-- Tokens / settings de SECURITY DEFINER não podem ser alterados por este RPC.

CREATE OR REPLACE FUNCTION public.patch_chapter_settings(
  _chapter_id uuid,
  _patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_key text;
  v_val jsonb;
  v_old jsonb;
  v_allowed text[] := ARRAY[
    'sindicancia_chave_template',
    'sindicancia_parecer_template'
  ];
BEGIN
  IF NOT (
    public.has_permission(_chapter_id, 'admin')
    OR public.has_any_role(
      _chapter_id,
      ARRAY['mestre_conselheiro', 'admin_total', 'escrivao']
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar configurações'
      USING ERRCODE = '42501';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch inválido';
  END IF;

  -- Rejeita chaves fora da allowlist (inclui investigation_signup_token e demais)
  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Chave de configuração não permitida: %', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT coalesce(c.settings, '{}'::jsonb)
  INTO v_settings
  FROM public.chapters c
  WHERE c.id = _chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    v_old := v_settings -> v_key;

    IF v_val IS NULL
       OR v_val = 'null'::jsonb
       OR v_val = '""'::jsonb
    THEN
      v_settings := v_settings - v_key;
    ELSE
      v_settings := jsonb_set(v_settings, ARRAY[v_key], v_val, true);
    END IF;

    INSERT INTO public.audit_logs (
      chapter_id, user_id, action, table_name, record_id, new_value
    ) VALUES (
      _chapter_id,
      auth.uid(),
      'settings_patch',
      'chapters',
      _chapter_id,
      jsonb_build_object(
        'key', v_key,
        'old', v_old,
        'new', CASE
          WHEN v_val IS NULL OR v_val = 'null'::jsonb OR v_val = '""'::jsonb
          THEN NULL
          ELSE v_val
        END
      )
    );
  END LOOP;

  UPDATE public.chapters
  SET settings = v_settings
  WHERE id = _chapter_id;

  RETURN v_settings;
END;
$$;
