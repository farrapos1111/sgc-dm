-- Solicitações de vínculo (afiliação) a capítulo adicional
-- Aprovação pelo capítulo originário antes de criar member_chapter_affiliations

DO $$ BEGIN
  CREATE TYPE public.member_change_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.member_affiliation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  requesting_chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  origin_chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status public.member_change_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS member_affiliation_requests_pending_unique;
CREATE UNIQUE INDEX member_affiliation_requests_pending_unique
  ON public.member_affiliation_requests (member_id, requesting_chapter_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS member_affiliation_requests_origin_pending_idx
  ON public.member_affiliation_requests (origin_chapter_id, status)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS member_affiliation_requests_updated ON public.member_affiliation_requests;
CREATE TRIGGER member_affiliation_requests_updated
  BEFORE UPDATE ON public.member_affiliation_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.member_affiliation_requests TO authenticated;
GRANT ALL ON public.member_affiliation_requests TO service_role;
ALTER TABLE public.member_affiliation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mar_select ON public.member_affiliation_requests;
CREATE POLICY mar_select ON public.member_affiliation_requests FOR SELECT TO authenticated
  USING (
    public.is_chapter_member(origin_chapter_id)
    OR public.is_chapter_member(requesting_chapter_id)
  );

DROP POLICY IF EXISTS mar_insert ON public.member_affiliation_requests;
CREATE POLICY mar_insert ON public.member_affiliation_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_chapter_member(requesting_chapter_id)
    AND public.has_permission(requesting_chapter_id, 'secretaria')
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS mar_update ON public.member_affiliation_requests;
CREATE POLICY mar_update ON public.member_affiliation_requests FOR UPDATE TO authenticated
  USING (
    public.is_chapter_member(origin_chapter_id)
    AND (
      public.has_permission(origin_chapter_id, 'secretaria')
      OR public.has_permission(origin_chapter_id, 'admin')
    )
  )
  WITH CHECK (
    public.is_chapter_member(origin_chapter_id)
    AND (
      public.has_permission(origin_chapter_id, 'secretaria')
      OR public.has_permission(origin_chapter_id, 'admin')
    )
  );

-- Aprovação pelo originário: cria afiliação no capítulo solicitante (SECURITY DEFINER)
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

REVOKE ALL ON FUNCTION public.review_member_affiliation_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_member_affiliation_request(uuid, text, text) TO authenticated, service_role;
