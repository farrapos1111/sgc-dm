-- CPF e RG do entrevistado na declaração da ata pelo link de participação.
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
  v_cpf text := '';
  v_rg text := '';
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
      v_cpf := coalesce(public.decrypt_pii(v_file.cpf_encrypted), nullif(trim(coalesce(v_file.cpf, '')), ''), '');
      v_rg := coalesce(public.decrypt_pii(v_file.rg_encrypted), nullif(trim(coalesce(v_file.rg, '')), ''), '');
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
    'candidate_cpf', coalesce(v_cpf, ''),
    'candidate_rg', coalesce(v_rg, ''),
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
