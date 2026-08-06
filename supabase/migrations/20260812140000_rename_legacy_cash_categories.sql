-- Renomeia categorias legadas do fluxo de caixa para os nomes padrão do sistema.
-- Mensalidade → Mensalidades
-- Filantropia → Hospitalaria
-- Evento → Eventos
-- Outro → Outras

UPDATE public.cash_entries
SET category = CASE upper(btrim(category))
  WHEN 'MENSALIDADE' THEN 'Mensalidades'
  WHEN 'FILANTROPIA' THEN 'Hospitalaria'
  WHEN 'EVENTO' THEN 'Eventos'
  WHEN 'OUTRO' THEN 'Outras'
  ELSE category
END
WHERE upper(btrim(category)) IN ('MENSALIDADE', 'FILANTROPIA', 'EVENTO', 'OUTRO');

-- Catálogo: renomeia quando o nome-alvo ainda não existe no capítulo
UPDATE public.cash_categories AS src
SET name = CASE upper(btrim(src.name))
  WHEN 'MENSALIDADE' THEN 'Mensalidades'
  WHEN 'FILANTROPIA' THEN 'Hospitalaria'
  WHEN 'EVENTO' THEN 'Eventos'
  WHEN 'OUTRO' THEN 'Outras'
  ELSE src.name
END
WHERE upper(btrim(src.name)) IN ('MENSALIDADE', 'FILANTROPIA', 'EVENTO', 'OUTRO')
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_categories AS dst
    WHERE dst.chapter_id = src.chapter_id
      AND dst.id <> src.id
      AND dst.name = CASE upper(btrim(src.name))
        WHEN 'MENSALIDADE' THEN 'Mensalidades'
        WHEN 'FILANTROPIA' THEN 'Hospitalaria'
        WHEN 'EVENTO' THEN 'Eventos'
        WHEN 'OUTRO' THEN 'Outras'
        ELSE src.name
      END
  );

-- Remove legados órfãos quando o nome-alvo já existia no capítulo
DELETE FROM public.cash_categories AS src
WHERE upper(btrim(src.name)) IN ('MENSALIDADE', 'FILANTROPIA', 'EVENTO', 'OUTRO')
  AND EXISTS (
    SELECT 1
    FROM public.cash_categories AS dst
    WHERE dst.chapter_id = src.chapter_id
      AND dst.id <> src.id
      AND dst.name = CASE upper(btrim(src.name))
        WHEN 'MENSALIDADE' THEN 'Mensalidades'
        WHEN 'FILANTROPIA' THEN 'Hospitalaria'
        WHEN 'EVENTO' THEN 'Eventos'
        WHEN 'OUTRO' THEN 'Outras'
        ELSE src.name
      END
  );
