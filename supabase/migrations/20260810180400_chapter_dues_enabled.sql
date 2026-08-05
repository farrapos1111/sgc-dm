-- dues_enabled em settings + expose no lobby público

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
    'sindicancia_parecer_template',
    'pix_key',
    'pix_qr_path',
    'chave_template',
    'minute_passwords',
    'dues_enabled'
  ];
BEGIN
  IF NOT (
    public.has_permission(_chapter_id, 'admin')
    OR public.has_permission(_chapter_id, 'tesouraria')
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

CREATE OR REPLACE FUNCTION public.get_public_lobby(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter public.chapters%ROWTYPE;
  v_dues_enabled boolean;
BEGIN
  v_chapter := public.resolve_lobby_chapter_by_token(_token);

  v_dues_enabled := coalesce(
    (v_chapter.settings->>'dues_enabled')::boolean,
    true
  );

  RETURN jsonb_build_object(
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'logo_url', v_chapter.logo_url,
      'primary_color', v_chapter.primary_color,
      'dues_enabled', v_dues_enabled
    )
  );
END;
$$;
