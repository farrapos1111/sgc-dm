-- DeMolay: só Escrivão (role ou cargo) edita/grava/exclui ata.
-- Demais com secretaria podem visualizar e reprovar com justificativa (volta a rascunho).

CREATE OR REPLACE FUNCTION public.can_edit_session_minute(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND (
      public.has_any_role(_chapter_id, ARRAY['escrivao'])
      OR public.has_current_position(_chapter_id, ARRAY['escrivao'])
    );
$$;

REVOKE ALL ON FUNCTION public.can_edit_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_session_minute(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_edit_session_minute(uuid) IS
  'Redação/exclusão de ata: somente Escrivão (role ou cargo).';

DROP POLICY IF EXISTS templates_write ON public.minute_templates;
CREATE POLICY templates_write ON public.minute_templates
  FOR ALL TO authenticated
  USING (public.can_edit_session_minute(chapter_id))
  WITH CHECK (public.can_edit_session_minute(chapter_id));

-- Quem pode reprovar com justificativa (secretaria, sem precisar ser escrivão)
CREATE OR REPLACE FUNCTION public.can_review_session_minute(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chapter_member(_chapter_id)
    AND (
      public.has_permission(_chapter_id, 'secretaria')
      OR public.has_permission(_chapter_id, 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.can_review_session_minute(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_session_minute(uuid) TO authenticated, service_role;

ALTER TABLE public.session_minutes
  ADD COLUMN IF NOT EXISTS rejection_note text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.session_minutes.rejection_note IS
  'Justificativa da última reprovação (revisão); limpa ao concluir novamente.';

DROP POLICY IF EXISTS minutes_write ON public.session_minutes;
CREATE POLICY minutes_write ON public.session_minutes
  FOR ALL TO authenticated
  USING (public.can_edit_session_minute(chapter_id))
  WITH CHECK (public.can_edit_session_minute(chapter_id));

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
  IF NOT public.can_edit_session_minute(_chapter_id) THEN
    RAISE EXCEPTION 'Somente o Escrivão pode redigir a ata' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.session_minutes
  WHERE client_draft_key = _client_draft_key
  FOR UPDATE;

  IF FOUND THEN
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
      RETURNING * INTO v_row;
    END;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível salvar o rascunho';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'kind', v_row.kind,
    'title', v_row.title
  );
END;
$$;

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

  IF NOT public.can_edit_session_minute(v_chapter_id) THEN
    RAISE EXCEPTION 'Somente o Escrivão pode excluir a ata' USING ERRCODE = '42501';
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

  SELECT chapter_id, deleted_at INTO v_chapter_id, v_deleted_at
  FROM public.session_minutes
  WHERE id = _minute_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_deleted_at IS NULL THEN
    RETURN true;
  END IF;

  IF v_deleted_at < (now() - interval '30 days') THEN
    RAISE EXCEPTION 'Prazo de recuperação expirado (30 dias)' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.can_edit_session_minute(v_chapter_id) THEN
    RAISE EXCEPTION 'Somente o Escrivão pode restaurar a ata' USING ERRCODE = '42501';
  END IF;

  UPDATE public.session_minutes
  SET deleted_at = NULL
  WHERE id = _minute_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_minute_public_share(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can_edit_session_minute(_chapter_id);
$$;

-- Reprovar ata em revisão: volta a rascunho com justificativa obrigatória
CREATE OR REPLACE FUNCTION public.reject_session_minute(
  _minute_id uuid,
  _justification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.session_minutes%ROWTYPE;
  v_note text := nullif(trim(coalesce(_justification, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF v_note IS NULL OR length(v_note) < 3 THEN
    RAISE EXCEPTION 'Justificativa obrigatória para reprovar a ata';
  END IF;

  SELECT * INTO v_row
  FROM public.session_minutes
  WHERE id = _minute_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ata não encontrada';
  END IF;

  IF NOT public.can_review_session_minute(v_row.chapter_id) THEN
    RAISE EXCEPTION 'Sem permissão para reprovar esta ata' USING ERRCODE = '42501';
  END IF;

  IF v_row.status NOT IN ('em_revisao', 'aprovada') THEN
    RAISE EXCEPTION 'Só é possível reprovar ata em revisão ou aprovada';
  END IF;

  DELETE FROM public.minute_approvals WHERE minute_id = v_row.id;

  UPDATE public.session_minutes
  SET
    status = 'rascunho',
    rejection_note = v_note,
    rejected_at = now(),
    rejected_by = auth.uid()
  WHERE id = v_row.id;

  INSERT INTO public.audit_logs (
    chapter_id, user_id, action, table_name, record_id, new_value
  ) VALUES (
    v_row.chapter_id,
    auth.uid(),
    'minute_reject',
    'session_minutes',
    v_row.id,
    jsonb_build_object('justification', v_note, 'previous_status', v_row.status)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'rascunho', 'rejection_note', v_note);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_session_minute(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_session_minute(uuid, text) TO authenticated, service_role;
