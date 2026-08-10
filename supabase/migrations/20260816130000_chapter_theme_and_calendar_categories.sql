-- D2: allowlist `theme` em patch_chapter_settings
-- D3: categorias custom de calendário + custom_category_id em calendar_events

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
    'dues_enabled',
    'theme'
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

-- Categorias personalizadas de calendário (escopo capítulo)
CREATE TABLE IF NOT EXISTS public.chapter_calendar_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#9E1B32',
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chapter_calendar_categories_chapter_idx
  ON public.chapter_calendar_categories (chapter_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS chapter_calendar_categories_name_uniq
  ON public.chapter_calendar_categories (chapter_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_calendar_categories TO authenticated;
GRANT ALL ON public.chapter_calendar_categories TO service_role;

ALTER TABLE public.chapter_calendar_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chapter_calendar_categories_select ON public.chapter_calendar_categories;
CREATE POLICY chapter_calendar_categories_select
  ON public.chapter_calendar_categories
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

DROP POLICY IF EXISTS chapter_calendar_categories_insert ON public.chapter_calendar_categories;
CREATE POLICY chapter_calendar_categories_insert
  ON public.chapter_calendar_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(chapter_id, 'secretaria'));

DROP POLICY IF EXISTS chapter_calendar_categories_update ON public.chapter_calendar_categories;
CREATE POLICY chapter_calendar_categories_update
  ON public.chapter_calendar_categories
  FOR UPDATE TO authenticated
  USING (public.has_permission(chapter_id, 'secretaria'))
  WITH CHECK (public.has_permission(chapter_id, 'secretaria'));

DROP POLICY IF EXISTS chapter_calendar_categories_delete ON public.chapter_calendar_categories;
CREATE POLICY chapter_calendar_categories_delete
  ON public.chapter_calendar_categories
  FOR DELETE TO authenticated
  USING (public.has_permission(chapter_id, 'secretaria'));

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS custom_category_id uuid
    REFERENCES public.chapter_calendar_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS calendar_events_custom_category_idx
  ON public.calendar_events (custom_category_id)
  WHERE custom_category_id IS NOT NULL;
