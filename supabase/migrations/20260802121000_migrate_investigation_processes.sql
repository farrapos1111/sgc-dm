-- Migração de dados: investigation_processes → calendar_events + sindicancia_details.
-- Separada da migration do módulo para o valor de enum 'sindicancia' já estar
-- commitado e utilizável (ADD VALUE + INSERT na mesma transação falha no Postgres).

DO $$
DECLARE
  r record;
  v_event_id uuid;
  v_start timestamptz;
BEGIN
  IF to_regclass('public.investigation_processes') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.sindicancia_details') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT p.*
    FROM public.investigation_processes p
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.sindicancia_details d
      WHERE d.file_id IS NOT DISTINCT FROM p.file_id
        AND d.chapter_id = p.chapter_id
        AND d.nominee_name = coalesce(
          (SELECT f.candidate_name FROM public.investigation_files f WHERE f.id = p.file_id),
          p.title
        )
        AND d.status = p.status
    )
  LOOP
    v_start := (r.opened_at::timestamp AT TIME ZONE 'America/Sao_Paulo');
    INSERT INTO public.calendar_events (
      chapter_id, title, event_type, mandatory, public_open,
      start_at, end_at, location, description, created_by
    ) VALUES (
      r.chapter_id,
      r.title,
      'sindicancia',
      false,
      false,
      v_start,
      NULL,
      NULL,
      r.opinion,
      r.created_by
    )
    RETURNING id INTO v_event_id;

    INSERT INTO public.sindicancia_details (
      calendar_event_id, chapter_id, file_id, nominee_name,
      investigator_member_id, opinion, status
    ) VALUES (
      v_event_id,
      r.chapter_id,
      r.file_id,
      coalesce(
        (SELECT f.candidate_name FROM public.investigation_files f WHERE f.id = r.file_id),
        r.title
      ),
      r.responsible_member_id,
      r.opinion,
      r.status
    );
  END LOOP;
END $$;
