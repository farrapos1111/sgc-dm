-- Link de participação da sindicância (enquanto aberta ou em andamento).
-- Quem entra informa o ID DeMolay; só sindicante, escrivão de parecer ou tio/senior da sessão passam.

ALTER TABLE public.sindicancia_details
  ADD COLUMN IF NOT EXISTS participation_token text;

CREATE UNIQUE INDEX IF NOT EXISTS sindicancia_details_participation_token_uidx
  ON public.sindicancia_details (participation_token)
  WHERE participation_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_manage_sindicancia_participation(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND (
      public.can_manage_commission(_chapter_id, 'sindicancias')
      OR public.has_any_role(
        _chapter_id,
        ARRAY['escrivao', 'mestre_conselheiro', 'admin_total']
      )
      OR public.has_current_position(
        _chapter_id,
        ARRAY['escrivao', 'segundo_conselheiro']
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_sindicancia_participation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_sindicancia_participation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_sindicancia_participation_token(
  _calendar_event_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.sindicancia_details%ROWTYPE;
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.sindicancia_details
  WHERE calendar_event_id = _calendar_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sindicância não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_sindicancia_participation(v_row.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar o link' USING ERRCODE = '42501';
  END IF;

  IF v_row.status NOT IN ('aberta', 'em_andamento') THEN
    RAISE EXCEPTION 'O link só pode ser gerado com a sindicância aberta ou em andamento'
      USING ERRCODE = '22023';
  END IF;

  v_token := nullif(v_row.participation_token, '');
  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.sindicancia_details
    SET participation_token = v_token
    WHERE calendar_event_id = _calendar_event_id;
  END IF;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_sindicancia_participation_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_sindicancia_participation_token(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_sindicancia_participation_token(
  _calendar_event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT chapter_id INTO v_chapter_id
  FROM public.sindicancia_details
  WHERE calendar_event_id = _calendar_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sindicância não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_sindicancia_participation(v_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para revogar o link' USING ERRCODE = '42501';
  END IF;

  UPDATE public.sindicancia_details
  SET participation_token = NULL
  WHERE calendar_event_id = _calendar_event_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_sindicancia_participation_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_sindicancia_participation_token(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sindicancia_age_band(_birth date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _birth IS NULL THEN '18_mais'
    WHEN EXTRACT(YEAR FROM age(current_date, _birth))::int <= 14 THEN 'ate_14'
    WHEN EXTRACT(YEAR FROM age(current_date, _birth))::int <= 17 THEN '15_17'
    ELSE '18_mais'
  END;
$$;

REVOKE ALL ON FUNCTION public.sindicancia_age_band(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sindicancia_age_band(date) TO authenticated, service_role;

-- Papel do ID nesta sessão. Recusa genérica se não for participante.
CREATE OR REPLACE FUNCTION public.resolve_sindicancia_participation(
  _token text,
  _demolay_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_row public.sindicancia_details%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_file public.investigation_files%ROWTYPE;
  v_role text;
  v_band text;
  v_blocks jsonb;
  v_minute public.sindicancia_minutes%ROWTYPE;
  v_has_minute boolean := false;
  v_padrinho text;
  v_sindicante text;
  v_senior text;
  v_escrivao text;
  v_macom text;
  v_dm text;
  v_has_macom boolean := false;
  v_has_dm boolean := false;
  v_candidate text;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = '22023';
  END IF;
  IF v_demolay IS NULL THEN
    RAISE EXCEPTION 'Informe o ID DeMolay' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.sindicancia_details
  WHERE participation_token = v_token;

  IF NOT FOUND OR v_row.status NOT IN ('aberta', 'em_andamento') THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_member
  FROM public.members m
  WHERE m.chapter_id = v_row.chapter_id
    AND m.demolay_id IS NOT NULL
    AND lower(trim(m.demolay_id)) = lower(v_demolay)
    AND m.id IN (
      v_row.clerk_member_id,
      v_row.investigator_member_id,
      v_row.senior_member_id
    )
  ORDER BY CASE
    WHEN m.id = v_row.clerk_member_id THEN 0
    WHEN m.id = v_row.investigator_member_id THEN 1
    ELSE 2
  END
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este ID não é participante desta sindicância'
      USING ERRCODE = '42501';
  END IF;

  IF v_member.id = v_row.clerk_member_id THEN
    v_role := 'escrivao';
  ELSIF v_member.id = v_row.investigator_member_id THEN
    v_role := 'sindicante';
  ELSE
    v_role := 'senior';
  END IF;

  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_row.calendar_event_id;
  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_row.chapter_id;

  v_band := '18_mais';
  v_macom := NULL;
  v_dm := NULL;
  IF v_row.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.investigation_files WHERE id = v_row.file_id;
    IF FOUND THEN
      v_band := public.sindicancia_age_band(v_file.candidate_birth_date);
      v_candidate := v_file.candidate_name;
      v_has_macom := coalesce(v_file.has_mason_relative, false);
      v_has_dm := coalesce(v_file.has_demolay_relative, false);
      v_padrinho := coalesce(
        (
          SELECT full_name FROM public.members
          WHERE id = v_file.sponsor_member_id
        ),
        nullif(trim(coalesce(v_file.sponsor_text, '')), ''),
        nullif(trim(coalesce(v_file.referred_by, '')), '')
      );
      v_macom := nullif(
        concat_ws(
          ' — ',
          nullif(trim(coalesce(v_file.mason_relative_name, '')), ''),
          nullif(trim(coalesce(v_file.mason_relative_lodge, '')), '')
        ),
        ''
      );
      v_dm := nullif(
        concat_ws(
          ' — ',
          nullif(trim(coalesce(v_file.demolay_relative_name, '')), ''),
          nullif(trim(coalesce(v_file.demolay_relative_chapter, '')), '')
        ),
        ''
      );
    END IF;
  END IF;

  v_sindicante := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.investigator_member_id),
    nullif(trim(coalesce(v_row.investigator_text, '')), '')
  );
  v_senior := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.senior_member_id),
    nullif(trim(coalesce(v_row.senior_text, '')), '')
  );
  v_escrivao := coalesce(
    (SELECT full_name FROM public.members WHERE id = v_row.clerk_member_id),
    nullif(trim(coalesce(v_row.clerk_text, '')), '')
  );

  v_blocks := coalesce(
    v_chapter.settings->'sindicancia_ata_templates'->v_band->'blocks',
    '[]'::jsonb
  );
  IF jsonb_typeof(v_blocks) IS DISTINCT FROM 'array' THEN
    v_blocks := '[]'::jsonb;
  END IF;

  IF v_role = 'escrivao' THEN
    SELECT * INTO v_minute
    FROM public.sindicancia_minutes
    WHERE calendar_event_id = v_row.calendar_event_id;
    v_has_minute := FOUND;
  END IF;

  RETURN jsonb_build_object(
    'role', v_role,
    'participant_name', v_member.full_name,
    'age_band', v_band,
    'chapter', jsonb_build_object(
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'title', coalesce(v_event.title, v_row.nominee_name),
      'start_at', v_event.start_at,
      'location', coalesce(nullif(trim(coalesce(v_event.location, '')), ''), v_event.address)
    ),
    'chave', jsonb_build_object(
      'template', v_chapter.settings->>'sindicancia_chave_template',
      'chapter_name', v_chapter.name,
      'nominee', coalesce(nullif(trim(v_row.nominee_name), ''), v_event.title),
      'padrinho', coalesce(v_padrinho, ''),
      'start_at', v_event.start_at,
      'location', coalesce(nullif(trim(coalesce(v_event.location, '')), ''), v_event.address, ''),
      'sindicante', coalesce(v_sindicante, ''),
      'senior', coalesce(v_senior, ''),
      'escrivao', coalesce(v_escrivao, '')
    ),
    'names', jsonb_build_object(
      'sindicante', coalesce(v_sindicante, ''),
      'senior', coalesce(v_senior, ''),
      'escrivao', coalesce(v_escrivao, ''),
      'nominee', coalesce(nullif(trim(v_row.nominee_name), ''), '')
    ),
    'blocks', v_blocks,
    'prefill', CASE
      WHEN v_role = 'escrivao' THEN jsonb_build_object(
        'pre_nome', coalesce(nullif(trim(v_row.nominee_name), ''), v_candidate, ''),
        'pre_macom', v_has_macom,
        'pre_macom_grau', coalesce(v_macom, ''),
        'pre_demolay', v_has_dm,
        'pre_demolay_grau', coalesce(v_dm, '')
      )
      ELSE NULL
    END,
    'minute', CASE
      WHEN v_has_minute THEN jsonb_build_object(
        'answers', coalesce(v_minute.answers, '{}'::jsonb),
        'signatures', coalesce(v_minute.signatures, '{}'::jsonb),
        'completed_at', v_minute.completed_at
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_sindicancia_participation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sindicancia_participation(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_sindicancia_participation_minute(
  _token text,
  _demolay_id text,
  _answers jsonb,
  _signatures jsonb,
  _completed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_row public.sindicancia_details%ROWTYPE;
  v_member_id uuid;
  v_file public.investigation_files%ROWTYPE;
  v_band text := '18_mais';
  v_answers jsonb;
  v_sigs jsonb := '{}'::jsonb;
  v_key text;
  v_val jsonb;
  v_text text;
  v_completed_at timestamptz;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = '22023';
  END IF;
  IF v_demolay IS NULL THEN
    RAISE EXCEPTION 'Informe o ID DeMolay' USING ERRCODE = '22023';
  END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Respostas inválidas' USING ERRCODE = '22023';
  END IF;
  IF octet_length(_answers::text) > 400000 THEN
    RAISE EXCEPTION 'Respostas grandes demais' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row
  FROM public.sindicancia_details
  WHERE participation_token = v_token
  FOR UPDATE;

  IF NOT FOUND OR v_row.status NOT IN ('aberta', 'em_andamento') THEN
    RAISE EXCEPTION 'Link inválido ou a sindicância não está mais aberta'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT m.id INTO v_member_id
  FROM public.members m
  WHERE m.chapter_id = v_row.chapter_id
    AND m.demolay_id IS NOT NULL
    AND lower(trim(m.demolay_id)) = lower(v_demolay)
    AND m.id = v_row.clerk_member_id
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Este ID não é participante desta sindicância'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.file_id IS NOT NULL THEN
    SELECT * INTO v_file FROM public.investigation_files WHERE id = v_row.file_id;
    IF FOUND THEN
      v_band := public.sindicancia_age_band(v_file.candidate_birth_date);
    END IF;
  END IF;

  v_answers := _answers;
  IF _signatures IS NOT NULL AND jsonb_typeof(_signatures) = 'object' THEN
    FOR v_key IN SELECT jsonb_object_keys(_signatures)
    LOOP
      IF v_key NOT IN ('senior', 'sindicante', 'escrivao', 'guardian1', 'guardian2', 'nominee') THEN
        CONTINUE;
      END IF;
      v_val := _signatures->v_key;
      IF jsonb_typeof(v_val) = 'null' THEN
        v_sigs := v_sigs || jsonb_build_object(v_key, NULL);
      ELSIF jsonb_typeof(v_val) = 'string' THEN
        v_text := v_val #>> '{}';
        IF length(v_text) > 2000000 THEN
          RAISE EXCEPTION 'Assinatura grande demais' USING ERRCODE = '22023';
        END IF;
        v_sigs := v_sigs || jsonb_build_object(v_key, v_text);
      END IF;
    END LOOP;
  END IF;

  SELECT completed_at INTO v_completed_at
  FROM public.sindicancia_minutes
  WHERE calendar_event_id = v_row.calendar_event_id;

  IF coalesce(_completed, false) THEN
    v_completed_at := now();
  END IF;

  INSERT INTO public.sindicancia_minutes (
    calendar_event_id, chapter_id, age_band, answers, signatures, completed_at
  ) VALUES (
    v_row.calendar_event_id,
    v_row.chapter_id,
    v_band,
    v_answers,
    v_sigs,
    v_completed_at
  )
  ON CONFLICT (calendar_event_id) DO UPDATE SET
    age_band = EXCLUDED.age_band,
    answers = EXCLUDED.answers,
    signatures = EXCLUDED.signatures,
    completed_at = EXCLUDED.completed_at;

  IF coalesce(_completed, false) THEN
    UPDATE public.sindicancia_details
    SET status = 'votacao_comissao'
    WHERE calendar_event_id = v_row.calendar_event_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN coalesce(_completed, false) THEN 'votacao_comissao' ELSE v_row.status END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_sindicancia_participation_minute(text, text, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sindicancia_participation_minute(text, text, jsonb, jsonb, boolean) TO anon, authenticated, service_role;
