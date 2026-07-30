-- Dezembro deixa de ser isento por padrão (somente janeiro permanece).
-- Reabre dezembro isento sem lançamento de caixa; Senior/iniciação
-- voltam a isentar automaticamente no próximo ensure do calendário.
UPDATE public.member_dues
SET status = 'em_aberto',
    paid_at = NULL
WHERE competence_month = 12
  AND status = 'isento'
  AND cash_entry_id IS NULL;
