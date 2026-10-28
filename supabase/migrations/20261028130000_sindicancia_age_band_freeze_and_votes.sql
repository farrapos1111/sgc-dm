-- Sindicâncias (28/10/2026):
--
-- 1) A faixa etária da ata (modelo de perguntas) é definida na criação e não
--    muda mais. Antes, o formulário recalculava pela idade de hoje e trocava
--    o modelo quando o indicado fazia aniversário no meio do processo.
--    - trigger impede UPDATE de age_band em sindicancia_minutes (vale para o
--      app, para o link de participação e para qualquer outro caminho);
--    - resolve_sindicancia_participation usa a faixa gravada na ata.
--
-- 2) Votação da comissão — pode votar quem, no termo vigente, é:
--    - membro da comissão de sindicâncias;
--    - do Conselho Consultivo (cargo PCC/Conselheiro Consultor ou conta
--      consultor/presidente_conselho);
--    - conselheiro: Mestre Conselheiro, 1º ou 2º Conselheiro.
--    A ficha do votante pode ser a de origem ou uma afiliação ativa no
--    capítulo. O app passa a consultar can_cast_sindicancia_vote (fonte única).
--
-- 3) Reabrir a ata em votação passa a apagar os votos de todos (policy de
--    DELETE permite quem gerencia a comissão), como a tela já anunciava.
--
-- Nenhuma linha existente é alterada ou apagada pela migration.

-- ---------------------------------------------------------------------------
-- 1) Faixa etária congelada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_sindicancia_minutes_freeze_age_band()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.age_band := OLD.age_band;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sindicancia_minutes_freeze_age_band ON public.sindicancia_minutes;
CREATE TRIGGER sindicancia_minutes_freeze_age_band
  BEFORE UPDATE OF age_band ON public.sindicancia_minutes
  FOR EACH ROW
  WHEN (NEW.age_band IS DISTINCT FROM OLD.age_band)
  EXECUTE FUNCTION public.tg_sindicancia_minutes_freeze_age_band();

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
  v_frozen_band text;
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
  v_senior_kind text;
  v_senior_council boolean := false;
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
      -- Link público: só os 2 últimos dígitos (documento completo fica com a comissão autenticada).
      v_cpf := CASE WHEN nullif(trim(coalesce(v_file.cpf_last2, '')), '') IS NOT NULL
        THEN '***.***.***-' || v_file.cpf_last2 ELSE '' END;
      v_rg := CASE WHEN nullif(trim(coalesce(v_file.rg_last2, '')), '') IS NOT NULL
        THEN '••••••' || v_file.rg_last2 ELSE '' END;
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

  IF v_row.senior_member_id IS NOT NULL THEN
    SELECT m.kind::text INTO v_senior_kind
    FROM public.members m
    WHERE m.id = v_row.senior_member_id;

    v_senior_council := EXISTS (
      SELECT 1
      FROM public.member_positions mp
      JOIN public.position_org_types pot ON pot.position_id = mp.position_id
      WHERE mp.member_id = v_row.senior_member_id
        AND mp.chapter_id = v_row.chapter_id
        AND mp.ended_at IS NULL
        AND pot.org_type = 'capitulo'
        AND pot.role_group = 'conselho'
        AND mp.term_year = extract(year FROM (v_event.start_at AT TIME ZONE 'America/Sao_Paulo'))::int
        AND mp.term_semester = CASE
          WHEN extract(month FROM (v_event.start_at AT TIME ZONE 'America/Sao_Paulo')) <= 6 THEN 1
          ELSE 2
        END
    );
  END IF;

  -- Ata já criada: o modelo fica congelado na faixa etária da criação
  -- (aniversário do indicado durante o processo não troca as perguntas).
  SELECT m.age_band INTO v_frozen_band
  FROM public.sindicancia_minutes m
  WHERE m.calendar_event_id = v_row.calendar_event_id;
  IF v_frozen_band IS NOT NULL THEN
    v_band := v_frozen_band;
  END IF;

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
    'senior_kind', v_senior_kind,
    'senior_on_council', v_senior_council,
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

-- ---------------------------------------------------------------------------
-- 2) Votação da comissão
-- ---------------------------------------------------------------------------

-- Ficha do usuário logado usada para votar no capítulo: a de origem; se não
-- houver, a afiliada (afiliação ativa).
CREATE OR REPLACE FUNCTION public.auth_vote_member_id(_chapter_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.id
  FROM public.members m
  LEFT JOIN public.member_chapter_affiliations a
    ON a.member_id = m.id
   AND a.chapter_id = _chapter_id
   AND a.active
   AND a.left_at IS NULL
  WHERE m.user_id = auth.uid()
    AND (m.chapter_id = _chapter_id OR a.id IS NOT NULL)
  ORDER BY (m.chapter_id = _chapter_id) DESC, m.created_at NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_vote_member_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_vote_member_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_cast_sindicancia_vote(_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.auth_vote_member_id(_chapter_id) IS NULL THEN
    RETURN false;
  END IF;

  -- Comissão de sindicâncias + Conselho Consultivo (cargo ou conta):
  -- is_commission_member já inclui is_advisory_council_member.
  IF public.is_commission_member(_chapter_id, 'sindicancias') THEN
    RETURN true;
  END IF;

  -- Conselheiros e Conselho Consultivo por cargo no termo vigente, em qualquer
  -- ficha do usuário visível no capítulo (origem ou afiliação).
  RETURN EXISTS (
    SELECT 1
    FROM public.member_positions mp
    JOIN public.positions p ON p.id = mp.position_id
    JOIN public.members m ON m.id = mp.member_id
    WHERE mp.chapter_id = _chapter_id
      AND m.user_id = auth.uid()
      AND mp.term_year = public.current_term_year()
      AND mp.term_semester = public.current_term_semester()
      AND p.code = ANY (ARRAY[
        'mestre_conselheiro',
        'primeiro_conselheiro',
        'segundo_conselheiro',
        'presidente_conselho_consultivo',
        'conselheiro_consultor'
      ])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_cast_sindicancia_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cast_sindicancia_vote(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS sindicancia_votes_insert ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_update ON public.sindicancia_votes;
DROP POLICY IF EXISTS sindicancia_votes_delete ON public.sindicancia_votes;

CREATE POLICY sindicancia_votes_insert ON public.sindicancia_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_vote_member_id(chapter_id)
    AND EXISTS (
      SELECT 1 FROM public.sindicancia_details d
      WHERE d.calendar_event_id = sindicancia_votes.calendar_event_id
        AND d.chapter_id = sindicancia_votes.chapter_id
        AND d.status = 'votacao_comissao'
    )
  );

CREATE POLICY sindicancia_votes_update ON public.sindicancia_votes
  FOR UPDATE TO authenticated
  USING (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_vote_member_id(chapter_id)
  )
  WITH CHECK (
    public.can_cast_sindicancia_vote(chapter_id)
    AND member_id = public.auth_vote_member_id(chapter_id)
    AND EXISTS (
      SELECT 1 FROM public.sindicancia_details d
      WHERE d.calendar_event_id = sindicancia_votes.calendar_event_id
        AND d.chapter_id = sindicancia_votes.chapter_id
        AND d.status = 'votacao_comissao'
    )
  );

-- Cada votante remove o próprio voto; quem gerencia a comissão limpa todos
-- ao reabrir a ata (antes só o voto do próprio gestor era apagado).
CREATE POLICY sindicancia_votes_delete ON public.sindicancia_votes
  FOR DELETE TO authenticated
  USING (
    (
      public.can_cast_sindicancia_vote(chapter_id)
      AND member_id = public.auth_vote_member_id(chapter_id)
    )
    OR public.can_manage_commission(chapter_id, 'sindicancias')
  );
