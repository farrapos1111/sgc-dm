-- Acesso por grau à ata pública (membro) + peek do tipo sem conteúdo

CREATE OR REPLACE FUNCTION public.member_can_access_minute_kind(
  _kind public.member_kind,
  _exam_grau_iniciatico date,
  _exam_grau_demolay date,
  _iniciacao_ordem date,
  _iniciacao_grau_demolay date,
  _minute_kind public.minute_kind
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  -- Maçons e seniors: todos os tipos
  IF _kind IN ('macom', 'senior') THEN
    RETURN true;
  END IF;
  -- Grau DeMolay (iniciação ou exame): todos os tipos
  IF _iniciacao_grau_demolay IS NOT NULL OR _exam_grau_demolay IS NOT NULL THEN
    RETURN true;
  END IF;
  -- Só Grau Iniciático: pública + iniciático
  IF _exam_grau_iniciatico IS NOT NULL OR _iniciacao_ordem IS NOT NULL THEN
    RETURN _minute_kind IN ('publica', 'grau_iniciatico');
  END IF;
  RETURN false;
END;
$function$;

-- Metadados do link (sem conteúdo) para a tela de acesso
CREATE OR REPLACE FUNCTION public.peek_public_minute(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;
  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_minute.calendar_event_id;

  RETURN jsonb_build_object(
    'kind', v_minute.kind,
    'status', v_minute.status,
    'voting_open', v_minute.status = 'rascunho',
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'start_at', v_event.start_at,
      'location', v_event.location
    )
  );
END;
$function$;

-- Desbloqueio por ID DeMolay do membro do capítulo
CREATE OR REPLACE FUNCTION public.get_public_minute_by_member(
  _token text,
  _demolay_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_allowed boolean;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;
  IF v_demolay IS NULL THEN
    RAISE EXCEPTION 'Informe o ID DeMolay' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;
  SELECT * INTO v_event FROM public.calendar_events WHERE id = v_minute.calendar_event_id;

  SELECT * INTO v_member
  FROM public.members
  WHERE chapter_id = v_minute.chapter_id
    AND demolay_id IS NOT NULL
    AND lower(trim(demolay_id)) = lower(v_demolay)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado neste capítulo com este ID DeMolay'
      USING ERRCODE = 'P0002';
  END IF;

  v_allowed := public.member_can_access_minute_kind(
    v_member.kind,
    v_member.exam_grau_iniciatico,
    v_member.exam_grau_demolay,
    v_member.iniciacao_ordem,
    v_member.iniciacao_grau_demolay,
    v_minute.kind
  );

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'locked', true,
      'kind', v_minute.kind,
      'member_name', v_member.full_name,
      'chapter', jsonb_build_object(
        'id', v_chapter.id,
        'name', v_chapter.name,
        'number', v_chapter.number,
        'city', v_chapter.city,
        'primary_color', v_chapter.primary_color
      ),
      'event', jsonb_build_object(
        'id', v_event.id,
        'title', v_event.title,
        'start_at', v_event.start_at,
        'location', v_event.location
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'locked', false,
    'unlocked_by', 'member',
    'demolay_id', v_member.demolay_id,
    'member_name', v_member.full_name,
    'minute', jsonb_build_object(
      'id', v_minute.id,
      'content', v_minute.content,
      'status', v_minute.status,
      'title', v_minute.title,
      'kind', v_minute.kind,
      'updated_at', v_minute.updated_at,
      'voting_open', v_minute.status = 'rascunho'
    ),
    'chapter', jsonb_build_object(
      'id', v_chapter.id,
      'name', v_chapter.name,
      'number', v_chapter.number,
      'city', v_chapter.city,
      'primary_color', v_chapter.primary_color
    ),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'start_at', v_event.start_at,
      'location', v_event.location
    )
  );
END;
$function$;

-- Feedback: senha OU ID DeMolay de membro com acesso ao tipo
DROP FUNCTION IF EXISTS public.submit_public_minute_vote(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_public_minute_vote(
  _token text,
  _password text,
  _email text,
  _decision text,
  _justification text DEFAULT NULL,
  _demolay_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_password text := coalesce(_password, '');
  v_demolay text := nullif(trim(coalesce(_demolay_id, '')), '');
  v_email text := lower(trim(coalesce(_email, '')));
  v_decision text := lower(trim(coalesce(_decision, '')));
  v_justification text := nullif(trim(coalesce(_justification, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_row public.minute_public_votes%ROWTYPE;
  v_expected text;
  v_ok boolean := false;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  IF v_decision NOT IN ('aprovada', 'reprovada') THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE = '22023';
  END IF;

  IF v_decision = 'reprovada' AND v_justification IS NULL THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovação'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE public_share_token = v_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  IF v_minute.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Consulta encerrada — a ata já não está em rascunho'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_chapter FROM public.chapters WHERE id = v_minute.chapter_id;

  IF v_demolay IS NOT NULL THEN
    SELECT * INTO v_member
    FROM public.members
    WHERE chapter_id = v_minute.chapter_id
      AND demolay_id IS NOT NULL
      AND lower(trim(demolay_id)) = lower(v_demolay)
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Membro não encontrado neste capítulo com este ID DeMolay'
        USING ERRCODE = 'P0002';
    END IF;

    IF NOT public.member_can_access_minute_kind(
      v_member.kind,
      v_member.exam_grau_iniciatico,
      v_member.exam_grau_demolay,
      v_member.iniciacao_ordem,
      v_member.iniciacao_grau_demolay,
      v_minute.kind
    ) THEN
      RAISE EXCEPTION 'Seu grau não permite acesso a este tipo de ata'
        USING ERRCODE = '42501';
    END IF;
    v_ok := true;
  ELSE
    v_expected := public.minute_expected_public_password(
      coalesce(v_chapter.settings, '{}'::jsonb),
      v_minute.kind
    );
    IF v_expected IS NULL THEN
      RAISE EXCEPTION 'Senha deste tipo de ata não configurada no capítulo'
        USING ERRCODE = '42501';
    END IF;
    IF v_password <> v_expected THEN
      RAISE EXCEPTION 'Senha incorreta' USING ERRCODE = '42501';
    END IF;
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.minute_public_votes (
    chapter_id, minute_id, email, decision, justification
  )
  VALUES (
    v_minute.chapter_id,
    v_minute.id,
    v_email,
    v_decision::public.minute_public_vote_decision,
    CASE WHEN v_decision = 'reprovada' THEN v_justification ELSE NULL END
  )
  ON CONFLICT (minute_id, email) DO UPDATE
  SET
    decision = EXCLUDED.decision,
    justification = EXCLUDED.justification,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'vote', jsonb_build_object(
      'id', v_row.id,
      'email', v_row.email,
      'decision', v_row.decision,
      'justification', v_row.justification,
      'updated_at', v_row.updated_at
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.member_can_access_minute_kind(public.member_kind, date, date, date, date, public.minute_kind) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peek_public_minute(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_minute_by_member(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.member_can_access_minute_kind(public.member_kind, date, date, date, date, public.minute_kind) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peek_public_minute(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_minute_by_member(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_minute_vote(text, text, text, text, text, text) TO anon, authenticated, service_role;
