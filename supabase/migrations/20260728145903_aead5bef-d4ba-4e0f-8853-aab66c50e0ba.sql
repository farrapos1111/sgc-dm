ALTER TYPE public.calendar_event_type RENAME VALUE 'sessao' TO 'sessao_ritualistica';
ALTER TYPE public.calendar_event_type ADD VALUE IF NOT EXISTS 'sessao_administrativa';