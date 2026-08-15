-- Soft delete de atas: recuperáveis por 30 dias, depois purge definitivo.

ALTER TABLE public.session_minutes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.session_minutes.deleted_at IS
  'Exclusão lógica. NULL = ativa. Após 30 dias, purge definitivo.';

CREATE INDEX IF NOT EXISTS session_minutes_deleted_at_idx
  ON public.session_minutes (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS session_minutes_chapter_active_idx
  ON public.session_minutes (chapter_id, opened_at DESC)
  WHERE deleted_at IS NULL;

-- SELECT: atas excluídas só para secretaria/admin (lixeira).
DROP POLICY IF EXISTS "minutes_select" ON public.session_minutes;
DROP POLICY IF EXISTS minutes_select ON public.session_minutes;

CREATE POLICY minutes_select ON public.session_minutes
  FOR SELECT TO authenticated
  USING (
    public.can_read_chapter(chapter_id)
    AND (
      deleted_at IS NULL
      OR public.has_permission(chapter_id, 'secretaria')
      OR public.has_permission(chapter_id, 'admin')
    )
  );

-- Upsert de rascunho não deve reativar/editar ata na lixeira.
CREATE OR REPLACE FUNCTION public.upsert_session_minute_draft(
  _chapter_id uuid,
  _calendar_event_id uuid,
  _content text,
  _kind text,
  _title text,
  _client_draft_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.session_minutes%ROWTYPE;
  v_kind text := coalesce(nullif(trim(_kind), ''), 'publica');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF _client_draft_key IS NULL THEN
    RAISE EXCEPTION 'client_draft_key obrigatório' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.has_permission(_chapter_id, 'secretaria')
    OR public.has_permission(_chapter_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gravar ata' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.session_minutes
  WHERE client_draft_key = _client_draft_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_row.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Ata excluída; recupere na lixeira antes de editar'
        USING ERRCODE = '22023';
    END IF;
    IF v_row.opened_by IS DISTINCT FROM auth.uid()
       OR v_row.chapter_id IS DISTINCT FROM _chapter_id
       OR v_row.calendar_event_id IS DISTINCT FROM _calendar_event_id THEN
      RAISE EXCEPTION 'Rascunho não pertence a esta sessão';
    END IF;
    IF v_row.status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Ata bloqueada para edição';
    END IF;
    UPDATE public.session_minutes
    SET
      content = _content,
      kind = v_kind::public.minute_kind,
      title = COALESCE(_title, title)
    WHERE id = v_row.id
      AND status = 'rascunho'
      AND deleted_at IS NULL
    RETURNING * INTO v_row;
  ELSE
    BEGIN
      INSERT INTO public.session_minutes (
        chapter_id, calendar_event_id, content, kind, title,
        opened_by, status, client_draft_key
      )
      VALUES (
        _chapter_id, _calendar_event_id, _content,
        v_kind::public.minute_kind,
        _title, auth.uid(), 'rascunho', _client_draft_key
      )
      RETURNING * INTO v_row;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO v_row
      FROM public.session_minutes
      WHERE client_draft_key = _client_draft_key
        AND opened_by = auth.uid()
        AND status = 'rascunho'
        AND deleted_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      UPDATE public.session_minutes
      SET
        content = _content,
        kind = v_kind::public.minute_kind,
        title = COALESCE(_title, title)
      WHERE id = v_row.id
        AND status = 'rascunho'
        AND deleted_at IS NULL
      RETURNING * INTO v_row;
    END;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível salvar o rascunho';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'kind', v_row.kind,
    'title', v_row.title
  );
END;
$$;

-- Soft delete (secretaria/admin). Revoga link público.
CREATE OR REPLACE FUNCTION public.soft_delete_session_minute(_minute_id uuid)
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
  FROM public.session_minutes
  WHERE id = _minute_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada ou já excluída' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_permission(v_chapter_id, 'secretaria')
    OR public.has_permission(v_chapter_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta ata' USING ERRCODE = '42501';
  END IF;

  UPDATE public.session_minutes
  SET
    deleted_at = now(),
    public_share_token = NULL
  WHERE id = _minute_id
    AND deleted_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_session_minute(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.soft_delete_session_minute(uuid) IS
  'Exclusão lógica da ata (lixeira). Recuperável por 30 dias.';

-- Restaurar da lixeira (ainda dentro da janela de 30 dias).
CREATE OR REPLACE FUNCTION public.restore_session_minute(_minute_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chapter_id uuid;
  v_deleted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT chapter_id, deleted_at
  INTO v_chapter_id, v_deleted_at
  FROM public.session_minutes
  WHERE id = _minute_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'Ata não está na lixeira' USING ERRCODE = '22023';
  END IF;

  IF v_deleted_at < (now() - interval '30 days') THEN
    RAISE EXCEPTION 'Prazo de recuperação expirado (30 dias)'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.has_permission(v_chapter_id, 'secretaria')
    OR public.has_permission(v_chapter_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recuperar esta ata' USING ERRCODE = '42501';
  END IF;

  UPDATE public.session_minutes
  SET deleted_at = NULL
  WHERE id = _minute_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_session_minute(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.restore_session_minute(uuid) IS
  'Recupera ata da lixeira se excluída há menos de 30 dias.';

-- Purge definitivo após 30 dias (service_role / cron).
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_session_minutes(
  _retain_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF _retain_days IS NULL OR _retain_days < 1 THEN
    RAISE EXCEPTION 'retain_days inválido' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.session_minutes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (now() - make_interval(days => _retain_days));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_soft_deleted_session_minutes(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_session_minutes(integer)
  TO service_role;

COMMENT ON FUNCTION public.purge_soft_deleted_session_minutes(integer) IS
  'Remove definitivamente atas na lixeira há mais de N dias. Agendar via cron.';

DO $$
BEGIN
  PERFORM cron.unschedule('purge-soft-deleted-session-minutes');
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-soft-deleted-session-minutes',
  '40 3 * * *',
  $$SELECT public.purge_soft_deleted_session_minutes(30);$$
);
