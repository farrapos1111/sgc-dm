-- Tipo da ata + senhas por tipo em chapters.settings.minute_passwords

CREATE TYPE public.minute_kind AS ENUM (
  'publica',
  'grau_iniciatico',
  'grau_demolay'
);

ALTER TABLE public.session_minutes
  ADD COLUMN IF NOT EXISTS kind public.minute_kind NOT NULL DEFAULT 'publica';

COMMENT ON COLUMN public.session_minutes.kind IS
  'Tipo da ata: Pública, Grau Iniciático ou Grau DeMolay (define a senha do link público).';

CREATE INDEX IF NOT EXISTS session_minutes_kind_idx
  ON public.session_minutes (chapter_id, kind);

-- ---------------------------------------------------------------------------
-- Valida senha do link público conforme o tipo da ata e chapters.settings
-- settings.minute_passwords = { "publica": "...", "grau_iniciatico": "...", "grau_demolay": "..." }
-- Fallback: pública ainda aceita "senha" se não houver configuração (compatibilidade).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.minute_expected_public_password(
  _settings jsonb,
  _kind public.minute_kind
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_kind text := _kind::text;
  v_pass text;
BEGIN
  v_pass := nullif(
    trim(coalesce((_settings -> 'minute_passwords' ->> v_kind), '')),
    ''
  );
  IF v_pass IS NOT NULL THEN
    RETURN v_pass;
  END IF;
  IF v_kind = 'publica' THEN
    RETURN 'senha';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_minute(
  _token text,
  _password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_password text := coalesce(_password, '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_event public.calendar_events%ROWTYPE;
  v_expected text;
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

  RETURN jsonb_build_object(
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

CREATE OR REPLACE FUNCTION public.submit_public_minute_vote(
  _token text,
  _password text,
  _email text,
  _decision text,
  _justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text := nullif(trim(coalesce(_token, '')), '');
  v_password text := coalesce(_password, '');
  v_email text := lower(trim(coalesce(_email, '')));
  v_decision text := lower(trim(coalesce(_decision, '')));
  v_justification text := nullif(trim(coalesce(_justification, '')), '');
  v_minute public.session_minutes%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_row public.minute_public_votes%ROWTYPE;
  v_expected text;
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

REVOKE ALL ON FUNCTION public.minute_expected_public_password(jsonb, public.minute_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.minute_expected_public_password(jsonb, public.minute_kind) TO authenticated, service_role;
