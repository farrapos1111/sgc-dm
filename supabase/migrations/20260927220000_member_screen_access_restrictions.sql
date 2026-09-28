-- Membro padrão: atas filtradas por grau; sem modelos de ata/ofício;
-- sem leitura de mensalidades/atrasados (tesouraria) de outros membros.

-- ===== Atas: leitura por grau para quem não tem visão total =====
CREATE OR REPLACE FUNCTION public.can_read_session_minute(
  _chapter_id uuid,
  _kind public.minute_kind
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member public.members%ROWTYPE;
BEGIN
  IF NOT public.can_read_chapter(_chapter_id) THEN
    RETURN false;
  END IF;

  -- Oficiais / líderes com visão ampla: todas as atas
  IF public.has_permission(_chapter_id, 'visualizar_total')
     OR public.has_permission(_chapter_id, 'secretaria')
     OR public.has_permission(_chapter_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT * INTO v_member
  FROM public.members m
  WHERE m.id = public.auth_member_id_in_chapter(_chapter_id);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN public.member_can_access_minute_kind(
    v_member.kind,
    v_member.exam_grau_iniciatico,
    v_member.exam_grau_demolay,
    v_member.iniciacao_ordem,
    v_member.iniciacao_grau_demolay,
    _kind
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.can_read_session_minute(uuid, public.minute_kind) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_session_minute(uuid, public.minute_kind)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.can_read_session_minute(uuid, public.minute_kind) IS
  'Leitura de ata: visão total (oficiais) ou filtro por grau do membro autenticado.';

DROP POLICY IF EXISTS minutes_select ON public.session_minutes;
CREATE POLICY minutes_select ON public.session_minutes
  FOR SELECT TO authenticated
  USING (
    (
      deleted_at IS NULL
      AND public.can_read_session_minute(chapter_id, kind)
    )
    OR (
      deleted_at IS NOT NULL
      AND (
        public.has_permission(chapter_id, 'secretaria')
        OR public.has_permission(chapter_id, 'admin')
      )
    )
  );

-- ===== Modelos de ata: secretaria / visão total =====
DROP POLICY IF EXISTS templates_select ON public.minute_templates;
CREATE POLICY templates_select ON public.minute_templates
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'visualizar_total')
  );

-- ===== Ofícios e modelos: secretaria / visão total =====
DROP POLICY IF EXISTS oficio_templates_select ON public.oficio_templates;
CREATE POLICY oficio_templates_select ON public.oficio_templates
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'visualizar_total')
  );

DROP POLICY IF EXISTS oficios_select ON public.oficios;
CREATE POLICY oficios_select ON public.oficios
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'visualizar_total')
  );

-- ===== Mensalidades / cobranças: tesouraria ou visão total =====
DROP POLICY IF EXISTS dues_select ON public.member_dues;
CREATE POLICY dues_select ON public.member_dues
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'tesouraria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'visualizar_total')
    OR member_id = public.auth_member_id_in_chapter(chapter_id)
  );

DROP POLICY IF EXISTS member_charges_select ON public.member_charges;
CREATE POLICY member_charges_select ON public.member_charges
  FOR SELECT TO authenticated
  USING (
    public.has_permission(chapter_id, 'tesouraria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.has_permission(chapter_id, 'visualizar_total')
    OR member_id = public.auth_member_id_in_chapter(chapter_id)
  );
