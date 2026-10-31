-- Calendário: fecha a criação de itens por qualquer membro e impede excluir
-- itens que já têm chamada de presença ou ata.
--
-- 1) INSERT em calendar_events
--    A política antiga (20260728142609) aceitava qualquer membro ativo do
--    capítulo. Como itens nascem obrigatórios, um membro comum podia criar
--    sessões pela API e derrubar a frequência (e o "apto a voto") dos outros.
--    Agora a criação segue quem já cria pelo app:
--      - secretaria / admin do capítulo (mesma regra de UPDATE/DELETE);
--      - liderança regional/estadual (calendário regional);
--      - comissão de sindicâncias: só itens do tipo sindicância;
--      - presidente/vice da comissão de entretenimento: entretenimento e evento
--        (tipos sem chamada de presença).
--
-- 2) DELETE em calendar_events
--    attendance_records e session_minutes apagam em cascata junto com o item.
--    Um clique em "Excluir" apagava a chamada e as atas (inclusive aprovadas).
--    O gatilho abaixo recusa a exclusão enquanto houver chamada ou ata.
--    A exclusão do capítulo inteiro continua funcionando (cascata).

-- ---------------------------------------------------------------------------
-- 1) INSERT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS calendar_events_insert ON public.calendar_events;
CREATE POLICY calendar_events_insert ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(chapter_id, 'secretaria')
    OR public.has_permission(chapter_id, 'admin')
    OR public.can_lead_chapter(chapter_id)
    OR (
      event_type = 'sindicancia'
      AND (
        public.can_manage_commission(chapter_id, 'sindicancias')
        OR public.has_commission_role(
          chapter_id,
          'sindicancias',
          ARRAY['presidente', 'vice']
        )
      )
    )
    OR (
      event_type IN ('entretenimento', 'evento')
      AND public.has_commission_role(
        chapter_id,
        'entretenimento',
        ARRAY['presidente', 'vice']
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) DELETE com chamada ou ata
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_calendar_events_guard_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Capítulo sendo excluído (cascata a partir de chapters): não bloquear.
  IF NOT EXISTS (SELECT 1 FROM public.chapters c WHERE c.id = OLD.chapter_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance_records a
    WHERE a.calendar_event_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Este item já tem chamada de presença registrada e não pode ser excluído. Desmarque as presenças na chamada antes de excluir.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Inclui atas na lixeira: excluir o item apagaria a ata de vez.
  IF EXISTS (
    SELECT 1 FROM public.session_minutes m
    WHERE m.calendar_event_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'Este item tem ata registrada (inclusive na lixeira) e não pode ser excluído.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_calendar_events_guard_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS calendar_events_guard_delete ON public.calendar_events;
CREATE TRIGGER calendar_events_guard_delete
  BEFORE DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_calendar_events_guard_delete();
