-- Ao aprovar afiliação, cria vínculo de login (chapter_members) no capítulo solicitante
CREATE OR REPLACE FUNCTION public.review_member_affiliation_request(
  _request_id uuid,
  _decision text,
  _review_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.member_affiliation_requests%ROWTYPE;
  v_user_id uuid;
  v_role_id smallint;
BEGIN
  SELECT * INTO v_req FROM public.member_affiliation_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitação já foi analisada';
  END IF;
  IF NOT public.is_chapter_member(v_req.origin_chapter_id) THEN
    RAISE EXCEPTION 'Somente o capítulo originário pode analisar' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_permission(v_req.origin_chapter_id, 'secretaria')
     AND NOT public.has_permission(v_req.origin_chapter_id, 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para analisar solicitações' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  IF _decision = 'approved' THEN
    INSERT INTO public.member_chapter_affiliations (member_id, chapter_id, active, created_by)
    VALUES (v_req.member_id, v_req.requesting_chapter_id, true, auth.uid())
    ON CONFLICT (member_id, chapter_id) DO UPDATE
      SET active = true,
          left_at = NULL,
          updated_at = now();

    -- Conta de acesso: permite trocar de capítulo no app
    SELECT user_id INTO v_user_id FROM public.members WHERE id = v_req.member_id;
    IF v_user_id IS NOT NULL THEN
      SELECT id INTO v_role_id FROM public.roles WHERE name = 'membro' LIMIT 1;
      IF v_role_id IS NOT NULL THEN
        UPDATE public.chapter_members
        SET active = true
        WHERE user_id = v_user_id
          AND chapter_id = v_req.requesting_chapter_id;

        IF NOT FOUND THEN
          INSERT INTO public.chapter_members (user_id, chapter_id, role_id, active)
          VALUES (v_user_id, v_req.requesting_chapter_id, v_role_id, true);
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.member_affiliation_requests SET
    status = _decision::public.member_change_request_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(trim(coalesce(_review_note, '')), ''),
    updated_at = now()
  WHERE id = _request_id;

  RETURN _request_id;
END;
$$;

-- Backfill: afiliações ativas sem chapter_members correspondente
INSERT INTO public.chapter_members (user_id, chapter_id, role_id, active)
SELECT m.user_id, a.chapter_id, r.id, true
FROM public.members m
JOIN public.member_chapter_affiliations a
  ON a.member_id = m.id
 AND a.active = true
 AND a.left_at IS NULL
JOIN public.roles r ON r.name = 'membro'
WHERE m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.chapter_members cm
    WHERE cm.user_id = m.user_id
      AND cm.chapter_id = a.chapter_id
  );
