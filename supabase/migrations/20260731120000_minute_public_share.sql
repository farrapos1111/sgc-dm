-- Visão pública da ata (pré-conclusão): token por ata + votos por e-mail
-- Senha fixa temporária: 'senha'

ALTER TABLE public.session_minutes
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS session_minutes_public_share_token_uidx
  ON public.session_minutes (public_share_token)
  WHERE public_share_token IS NOT NULL;

CREATE TYPE public.minute_public_vote_decision AS ENUM ('aprovada', 'reprovada');

CREATE TABLE public.minute_public_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  minute_id uuid NOT NULL REFERENCES public.session_minutes(id) ON DELETE CASCADE,
  email text NOT NULL,
  decision public.minute_public_vote_decision NOT NULL,
  justification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (minute_id, email),
  CONSTRAINT minute_public_votes_justification_check CHECK (
    decision = 'aprovada'
    OR (justification IS NOT NULL AND length(trim(justification)) > 0)
  )
);

GRANT SELECT ON public.minute_public_votes TO authenticated;
GRANT ALL ON public.minute_public_votes TO service_role;
ALTER TABLE public.minute_public_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minute_public_votes_select" ON public.minute_public_votes
  FOR SELECT TO authenticated
  USING (public.is_chapter_member(chapter_id));

CREATE TRIGGER set_updated_at_minute_public_votes
  BEFORE UPDATE ON public.minute_public_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS minute_public_votes_minute_idx
  ON public.minute_public_votes (minute_id);

-- ---------------------------------------------------------------------------
-- Auth helpers / token management
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_minute_public_share(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND public.has_any_role(
      _chapter_id,
      ARRAY[
        'admin_total',
        'mestre_conselheiro',
        'escrivao',
        'consultor',
        'presidente_conselho'
      ]
    );
$$;

CREATE OR REPLACE FUNCTION public.ensure_minute_public_share_token(
  _minute_id uuid,
  _regenerate boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_minute public.session_minutes%ROWTYPE;
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_minute
  FROM public.session_minutes
  WHERE id = _minute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_minute_public_share(v_minute.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para compartilhar a ata'
      USING ERRCODE = '42501';
  END IF;

  IF v_minute.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Só é possível compartilhar a ata em rascunho'
      USING ERRCODE = '22023';
  END IF;

  IF nullif(trim(coalesce(v_minute.content, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Salve o texto da ata antes de compartilhar'
      USING ERRCODE = '22023';
  END IF;

  v_token := nullif(v_minute.public_share_token, '');

  IF v_token IS NULL OR _regenerate THEN
    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    UPDATE public.session_minutes
    SET public_share_token = v_token
    WHERE id = _minute_id;
  END IF;

  RETURN v_token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_minute_public_share_token(_minute_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT chapter_id INTO v_chapter_id
  FROM public.session_minutes
  WHERE id = _minute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_minute_public_share(v_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.session_minutes
  SET public_share_token = NULL
  WHERE id = _minute_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_minute_public_share_token(_minute_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chapter_id uuid;
  v_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT chapter_id, nullif(public_share_token, '')
  INTO v_chapter_id, v_token
  FROM public.session_minutes
  WHERE id = _minute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_minute_public_share(v_chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  RETURN v_token;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Public RPCs (anon)
-- ---------------------------------------------------------------------------

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
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  IF v_password <> 'senha' THEN
    RAISE EXCEPTION 'Senha incorreta' USING ERRCODE = '42501';
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
    'minute', jsonb_build_object(
      'id', v_minute.id,
      'content', v_minute.content,
      'status', v_minute.status,
      'title', v_minute.title,
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
  v_row public.minute_public_votes%ROWTYPE;
BEGIN
  IF v_token IS NULL OR length(v_token) < 32 THEN
    RAISE EXCEPTION 'Link inválido' USING ERRCODE = '22023';
  END IF;

  IF v_password <> 'senha' THEN
    RAISE EXCEPTION 'Senha incorreta' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.can_manage_minute_public_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_minute_public_share_token(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_minute_public_share_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_minute_public_share_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_minute(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_minute_vote(text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_minute_public_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_minute_public_share_token(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_minute_public_share_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_minute_public_share_token(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_minute(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_minute_vote(text, text, text, text, text) TO anon, authenticated, service_role;
