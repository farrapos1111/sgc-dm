-- Patch atômico de chapters.settings (jsonb || + remoção de chaves vazias/null).

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

  SELECT coalesce(c.settings, '{}'::jsonb)
  INTO v_settings
  FROM public.chapters c
  WHERE c.id = _chapter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capítulo não encontrado';
  END IF;

  -- Merge superficial
  v_settings := v_settings || _patch;

  -- Remove chaves com null ou string vazia
  FOR v_key, v_val IN SELECT * FROM jsonb_each(_patch)
  LOOP
    IF v_val IS NULL
       OR v_val = 'null'::jsonb
       OR v_val = '""'::jsonb
    THEN
      v_settings := v_settings - v_key;
    END IF;
  END LOOP;

  UPDATE public.chapters
  SET settings = v_settings
  WHERE id = _chapter_id;

  RETURN v_settings;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_chapter_settings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_chapter_settings(uuid, jsonb)
  TO authenticated, service_role;
