-- Sincroniza mensalidades em aberto para isento a partir do aniversário de 21 anos
-- (Senior DeMolay) e alinha amounts em aberto ao default_dues_amount do capítulo.

UPDATE public.member_dues d
SET status = 'isento'
FROM public.members m
WHERE m.id = d.member_id
  AND d.status = 'em_aberto'
  AND d.cash_entry_id IS NULL
  AND (
    (m.kind = 'senior' AND m.birth_date IS NULL)
    OR (
      m.birth_date IS NOT NULL
      AND make_date(d.competence_year, d.competence_month, 1)
        >= date_trunc(
          'month',
          (m.birth_date + interval '21 years')::date
        )::date
    )
  );

-- Reaplica o valor padrão do capítulo em competênciasências em aberto do ano corrente em diante
UPDATE public.member_dues d
SET amount = coalesce(
  nullif(c.settings->>'default_dues_amount', '')::numeric,
  d.amount
)
FROM public.chapters c
WHERE c.id = d.chapter_id
  AND d.status = 'em_aberto'
  AND d.competence_year >= extract(year from current_date)::integer
  AND nullif(c.settings->>'default_dues_amount', '') IS NOT NULL;
