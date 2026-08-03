-- Templates padrão para capítulos novos (somente estas 6).
-- Capítulos já existentes não são alterados.

DELETE FROM public.commissions
WHERE chapter_id IS NULL
  AND code NOT IN (
    'novos_membros',
    'entretenimento',
    'hospitalaria',
    'financas',
    'eventos',
    'auditoria',
    'sindicancias'
  );

INSERT INTO public.commissions (code, label, sort_order, chapter_id)
VALUES
  ('novos_membros', 'Novos Membros', 1, NULL),
  ('entretenimento', 'Entretenimento', 2, NULL),
  ('hospitalaria', 'Hospitalária', 3, NULL),
  ('financas', 'Finanças', 4, NULL),
  ('eventos', 'Eventos', 5, NULL),
  ('auditoria', 'Auditoria', 6, NULL),
  ('sindicancias', 'Sindicâncias', 7, NULL)
ON CONFLICT (code) WHERE (chapter_id IS NULL)
DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

SELECT setval(
  'public.commissions_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.commissions), 1), 1)
);
