-- RPCs transacionais da tesouraria.
-- Substituem loops de INSERT/UPDATE/DELETE feitos pelo servidor (N round trips,
-- sem atomicidade) por uma única chamada que roda numa transação.
-- SECURITY INVOKER: RLS e os triggers de auditoria (auth.uid()) continuam valendo
-- exatamente como nas chamadas diretas; a checagem explícita de permissão apenas
-- falha cedo com mensagem clara.

-- ---------------------------------------------------------------------------
-- bulk_year_dues_action: ações em lote no calendário anual de mensalidades.
--   _action: pay_all | pay_except_jan | open_all | exempt_all
--   _max_month: último mês (inclusive) elegível para baixa (0 = nenhum)
-- Retorna o número de competências atualizadas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_year_dues_action(
  _chapter_id uuid,
  _year int,
  _action text,
  _amount numeric,
  _paid_at date,
  _skip_cash boolean DEFAULT false,
  _max_month int DEFAULT 12
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
  v_months text[] := ARRAY[
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(_chapter_id, 'tesouraria') THEN
    RAISE EXCEPTION 'Sem permissão para alterar a tesouraria deste capítulo'
      USING ERRCODE = '42501';
  END IF;
  IF _action NOT IN ('pay_all', 'pay_except_jan', 'open_all', 'exempt_all') THEN
    RAISE EXCEPTION 'Ação inválida: %', _action;
  END IF;
  IF _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  IF _action IN ('pay_all', 'pay_except_jan') THEN
    IF _max_month IS NULL OR _max_month <= 0 THEN
      RETURN 0;
    END IF;

    WITH todo AS (
      SELECT d.id AS due_id,
             d.cash_entry_id,
             d.competence_month,
             COALESCE(m.full_name, 'Membro') AS member_name,
             gen_random_uuid() AS new_cash_id,
             (d.cash_entry_id IS NULL AND _amount > 0 AND NOT _skip_cash) AS needs_cash
        FROM public.member_dues d
        LEFT JOIN public.members m ON m.id = d.member_id
       WHERE d.chapter_id = _chapter_id
         AND d.competence_year = _year
         AND d.status = 'em_aberto'
         AND d.competence_month <= _max_month
         AND (_action <> 'pay_except_jan' OR d.competence_month <> 1)
       FOR UPDATE OF d
    ),
    ins AS (
      INSERT INTO public.cash_entries (
        id, chapter_id, kind, category, description, amount, entry_date, created_by
      )
      SELECT t.new_cash_id, _chapter_id, 'entrada', 'Mensalidades',
             'Mensalidade - ' || t.member_name || ' - '
               || v_months[t.competence_month] || '/' || _year,
             _amount, _paid_at, auth.uid()
        FROM todo t
       WHERE t.needs_cash
      RETURNING id
    ),
    upd AS (
      UPDATE public.member_dues d
         SET status = 'pago',
             amount = _amount,
             paid_at = _paid_at,
             cash_entry_id = CASE WHEN t.needs_cash THEN t.new_cash_id ELSE t.cash_entry_id END
        FROM todo t
       WHERE d.id = t.due_id
      RETURNING d.id
    )
    SELECT count(*) INTO v_updated FROM upd;
    -- `ins` é um CTE de modificação: executa sempre, mesmo sem ser referenciado.
    RETURN v_updated;
  END IF;

  -- open_all / exempt_all: remove o caixa vinculado e redefine a competência
  DELETE FROM public.cash_entries c
   WHERE c.chapter_id = _chapter_id
     AND c.id IN (
       SELECT d.cash_entry_id
         FROM public.member_dues d
        WHERE d.chapter_id = _chapter_id
          AND d.competence_year = _year
          AND d.cash_entry_id IS NOT NULL
     );

  UPDATE public.member_dues
     SET status = CASE WHEN _action = 'open_all' THEN 'em_aberto'::public.due_status
                       ELSE 'isento'::public.due_status END,
         paid_at = NULL,
         cash_entry_id = NULL,
         amount = _amount
   WHERE chapter_id = _chapter_id
     AND competence_year = _year;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_year_dues_action(uuid, int, text, numeric, date, boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_year_dues_action(uuid, int, text, numeric, date, boolean, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- delete_member_charge: apaga cobrança + pagamentos + lançamentos do caixa
-- vinculados, de forma atômica.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_member_charge(_charge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chapter uuid;
  v_cash_ids uuid[];
BEGIN
  SELECT chapter_id INTO v_chapter FROM public.member_charges WHERE id = _charge_id FOR UPDATE;
  IF v_chapter IS NULL THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NULL OR NOT public.has_permission(v_chapter, 'tesouraria') THEN
    RAISE EXCEPTION 'Sem permissão para alterar a tesouraria deste capítulo'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_cash_ids
    FROM (
      SELECT cash_entry_id AS x FROM public.member_charges
       WHERE id = _charge_id AND cash_entry_id IS NOT NULL
      UNION ALL
      SELECT cash_entry_id FROM public.member_charge_payments
       WHERE charge_id = _charge_id AND cash_entry_id IS NOT NULL
    ) s;

  DELETE FROM public.member_charge_payments WHERE charge_id = _charge_id;
  DELETE FROM public.member_charges WHERE id = _charge_id;
  IF cardinality(v_cash_ids) > 0 THEN
    DELETE FROM public.cash_entries WHERE id = ANY (v_cash_ids) AND chapter_id = v_chapter;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_member_charge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_member_charge(uuid) TO authenticated;
