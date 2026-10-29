-- Corrige elegibilidade de voto na comissão de sindicâncias.
--
-- A migration 20261028130000 passou a exigir can_cast_sindicancia_vote nas
-- policies, mas a função reutilizava is_commission_member (que exige
-- is_chapter_member + is_linked_member em cada linha) e o SELECT dos votos
-- usava can_read_sindicancia_votes, que NÃO incluía 1º/2º conselheiro.
-- Resultado: quem deveria votar via cargo ou ficha na comissão recebia
-- "sem permissão" / RLS.
--
-- Agora can_cast espelha a regra do app antigo:
--   ficha vinculada (auth_vote_member_id) na comissão do termo
--   OU cargo votante do termo (MC, 1º, 2º, PCC, conselheiro consultor)
--   OU conta consultor / presidente_conselho / admin_total / MC.
-- can_read passa a incluir quem pode votar.

CREATE OR REPLACE FUNCTION public.can_cast_sindicancia_vote(_chapter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  v_member_id := public.auth_vote_member_id(_chapter_id);
  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;

  -- Membro da comissão de sindicâncias no termo vigente (ficha do votante).
  IF EXISTS (
    SELECT 1
    FROM public.commission_members cm
    JOIN public.commissions c ON c.id = cm.commission_id
    WHERE cm.chapter_id = _chapter_id
      AND cm.member_id = v_member_id
      AND c.code = 'sindicancias'
      AND (c.chapter_id IS NULL OR c.chapter_id = _chapter_id)
      AND cm.term_year = public.current_term_year()
      AND cm.term_semester = public.current_term_semester()
  ) THEN
    RETURN true;
  END IF;

  -- Contas de liderança (roles em chapter_members).
  IF public.has_any_role(
    _chapter_id,
    ARRAY[
      'consultor',
      'presidente_conselho',
      'admin_total',
      'mestre_conselheiro'
    ]
  ) THEN
    RETURN true;
  END IF;

  -- Cargos do termo na ficha do votante.
  RETURN EXISTS (
    SELECT 1
    FROM public.member_positions mp
    JOIN public.positions p ON p.id = mp.position_id
    WHERE mp.chapter_id = _chapter_id
      AND mp.member_id = v_member_id
      AND mp.term_year = public.current_term_year()
      AND mp.term_semester = public.current_term_semester()
      AND (mp.ended_at IS NULL OR mp.ended_at > now())
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
GRANT EXECUTE ON FUNCTION public.can_cast_sindicancia_vote(uuid)
  TO authenticated, service_role;

-- Quem vota também lê a apuração (antes 1º/2º conselheiro votavam "às cegas"
-- e o SELECT podia falhar a percepção de permissão).
CREATE OR REPLACE FUNCTION public.can_read_sindicancia_votes(_chapter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can_cast_sindicancia_vote(_chapter_id)
      OR public.can_manage_commission(_chapter_id, 'sindicancias')
      OR public.has_any_role(
        _chapter_id,
        ARRAY[
          'mestre_conselheiro',
          'admin_total',
          'presidente_conselho',
          'consultor'
        ]
      );
$$;

REVOKE ALL ON FUNCTION public.can_read_sindicancia_votes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_sindicancia_votes(uuid)
  TO authenticated, service_role;
