-- Datas do calendário podem sair da porcentagem de presença sem perder a chamada.
-- O padrão true mantém os eventos já existentes contando até alguém marcar "não conta".

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS counts_attendance boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.calendar_events.counts_attendance IS
  'false = não entra no numerador nem no denominador da frequência; P/A continua. true = conta (padrão dos eventos já existentes).';
