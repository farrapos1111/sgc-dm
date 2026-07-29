-- Isenta o mês de iniciação (e anteriores) quando ainda em aberto sem caixa
UPDATE public.member_dues d
   SET status = 'isento',
       paid_at = NULL,
       updated_at = now()
  FROM public.members m
 WHERE d.member_id = m.id
   AND d.status = 'em_aberto'
   AND d.cash_entry_id IS NULL
   AND m.iniciacao_ordem IS NOT NULL
   AND (
     d.competence_year < extract(year from m.iniciacao_ordem)::int
     OR (
       d.competence_year = extract(year from m.iniciacao_ordem)::int
       AND d.competence_month <= extract(month from m.iniciacao_ordem)::int
     )
   );
