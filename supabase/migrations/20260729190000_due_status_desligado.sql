-- Status "desligado" em mensalidades (e cobranças que usam due_status)
ALTER TYPE public.due_status ADD VALUE IF NOT EXISTS 'desligado';
