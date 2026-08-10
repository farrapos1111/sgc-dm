-- Atualiza primary_color + settings.theme no mesmo RPC (transação única).

DROP FUNCTION IF EXISTS public.patch_chapter_settings(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.patch_chapter_settings(
  _chapter_id uuid,
  _patch jsonb,
  _primary_color text DEFAULT NULL
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
    'sindicancia_parecer_template',
    'pix_key',
    'pix_qr_path',
    'chave_template',
    'minute_passwords',
    'dues_enabled',
    'theme',
    'calendar_type_labels'
  ];
BEGIN
  IF NOT (
    public.has_permission(_chapter_id, 'admin')
    OR public.has_permission(_chapter_id, 'tesouraria')
    OR public.has_permission(_chapter_id, 'secretaria')
    OR public.has_any_role(
      _chapter_id,
      ARRAY[
        'mestre_conselheiro',
        'admin_total',
        'escrivao',
        'presidente_conselho',
        'tesoureiro'
      ]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar configurações'
      USING ERRCODE = '42501';
  END IF;

  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch inválido';
  END IF;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'Chave de configuração não permitida: %', v_key
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF _primary_color IS NOT NULL THEN
    IF _primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'primary_color inválida';
    END IF;
    UPDATE public.chapters
    SET primary_color = upper(_primary_color)
    WHERE id = _chapter_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Capítulo não encontrado';
    END IF;
  END IF;

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
        'old', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
          ELSE v_old
        END,
        'new', CASE
          WHEN v_key = 'minute_passwords' THEN to_jsonb('[redacted]'::text)
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

REVOKE ALL ON FUNCTION public.patch_chapter_settings(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_chapter_settings(uuid, jsonb, text)
  TO authenticated, service_role;
