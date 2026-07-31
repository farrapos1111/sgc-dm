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
    'auditoria'
  );

UPDATE public.commissions AS c
SET
  label = v.label,
  sort_order = v.sort_order
FROM (
  VALUES
    ('novos_membros', 'Novos Membros', 1),
    ('entretenimento', 'Entretenimento', 2),
    ('hospitalaria', 'Hospitalaria', 3),
    ('financas', 'Finanças', 4),
    ('eventos', 'Eventos', 5),
    ('auditoria', 'Auditoria', 6)
) AS v(code, label, sort_order)
WHERE c.chapter_id IS NULL
  AND c.code = v.code;

INSERT INTO public.commissions (code, label, sort_order, chapter_id)
SELECT v.code, v.label, v.sort_order, NULL
FROM (
  VALUES
    ('novos_membros', 'Novos Membros', 1),
    ('entretenimento', 'Entretenimento', 2),
    ('hospitalaria', 'Hospitalaria', 3),
    ('financas', 'Finanças', 4),
    ('eventos', 'Eventos', 5),
    ('auditoria', 'Auditoria', 6)
) AS v(code, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.commissions c
  WHERE c.chapter_id IS NULL
    AND c.code = v.code
);

SELECT setval(
  'public.commissions_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.commissions), 1), 1)
);
