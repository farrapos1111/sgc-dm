-- Isenta janeiro e dezembro já existentes (em aberto, sem lançamento de caixa)
UPDATE public.member_dues
   SET status = 'isento',
       paid_at = NULL,
       updated_at = now()
 WHERE competence_month IN (1, 12)
   AND status = 'em_aberto'
   AND cash_entry_id IS NULL;
