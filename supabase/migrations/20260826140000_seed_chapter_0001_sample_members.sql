-- Seed: 10 DeMolays ativos + 1 maçom no Capítulo Exemplo Nº 0001.
-- Idempotente por id fixo (ON CONFLICT DO NOTHING).

DO $$
DECLARE
  v_chapter_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.chapters
    WHERE id = v_chapter_id
      AND number = '0001'
  ) THEN
    RAISE EXCEPTION
      'Capítulo Exemplo Nº 0001 (id %) não encontrado — rode o seed de chapters antes.',
      v_chapter_id;
  END IF;

  INSERT INTO public.members (
    id,
    chapter_id,
    initiation_chapter_id,
    full_name,
    birth_date,
    phone,
    email,
    status,
    kind,
    demolay_id,
    masonic_id,
    iniciacao_ordem,
    exam_grau_iniciatico,
    iniciacao_grau_demolay,
    exam_grau_demolay
  )
  VALUES
    (
      '00000000-0000-0000-0000-00000000a001'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Arthur Silva Mendes',
      '2008-03-12',
      '(54) 99100-0001',
      'arthur.mendes@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0001',
      NULL,
      '2022-05-14',
      '2022-08-20',
      '2023-03-11',
      '2023-06-17'
    ),
    (
      '00000000-0000-0000-0000-00000000a002'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Bruno Costa Oliveira',
      '2009-07-21',
      '(54) 99100-0002',
      'bruno.oliveira@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0002',
      NULL,
      '2023-02-18',
      '2023-05-27',
      '2024-01-13',
      '2024-04-20'
    ),
    (
      '00000000-0000-0000-0000-00000000a003'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Caio Ferreira Santos',
      '2007-11-05',
      '(54) 99100-0003',
      'caio.santos@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0003',
      NULL,
      '2021-09-25',
      '2022-01-15',
      '2022-08-06',
      '2022-11-12'
    ),
    (
      '00000000-0000-0000-0000-00000000a004'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Diego Almeida Rocha',
      '2010-01-30',
      '(54) 99100-0004',
      'diego.rocha@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0004',
      NULL,
      '2024-04-06',
      '2024-07-13',
      NULL,
      NULL
    ),
    (
      '00000000-0000-0000-0000-00000000a005'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Enzo Pereira Lima',
      '2008-09-18',
      '(54) 99100-0005',
      'enzo.lima@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0005',
      NULL,
      '2022-10-08',
      '2023-01-21',
      '2023-07-15',
      '2023-10-28'
    ),
    (
      '00000000-0000-0000-0000-00000000a006'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Felipe Nunes Barbosa',
      '2009-04-02',
      '(54) 99100-0006',
      'felipe.barbosa@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0006',
      NULL,
      '2023-06-17',
      '2023-09-23',
      '2024-03-09',
      '2024-06-15'
    ),
    (
      '00000000-0000-0000-0000-00000000a007'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Gabriel Souza Martins',
      '2007-06-14',
      '(54) 99100-0007',
      'gabriel.martins@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0007',
      NULL,
      '2021-04-10',
      '2021-07-17',
      '2022-02-12',
      '2022-05-21'
    ),
    (
      '00000000-0000-0000-0000-00000000a008'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Henrique Duarte Ramos',
      '2010-12-09',
      '(54) 99100-0008',
      'henrique.ramos@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0008',
      NULL,
      '2024-08-24',
      NULL,
      NULL,
      NULL
    ),
    (
      '00000000-0000-0000-0000-00000000a009'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Igor Teixeira Campos',
      '2008-05-27',
      '(54) 99100-0009',
      'igor.campos@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0009',
      NULL,
      '2022-03-19',
      '2022-06-25',
      '2022-12-10',
      '2023-03-18'
    ),
    (
      '00000000-0000-0000-0000-00000000a00a'::uuid,
      v_chapter_id,
      v_chapter_id,
      'João Pedro Azevedo',
      '2009-10-16',
      '(54) 99100-0010',
      'joao.azevedo@exemplo.local',
      'regular',
      'demolay_ativo',
      'SEED-DM-0010',
      NULL,
      '2023-11-11',
      '2024-02-17',
      '2024-08-03',
      '2024-11-09'
    ),
    (
      '00000000-0000-0000-0000-00000000a00b'::uuid,
      v_chapter_id,
      v_chapter_id,
      'Marcos Vinícius Ribeiro',
      '1982-08-03',
      '(54) 99100-0011',
      'marcos.ribeiro@exemplo.local',
      'regular',
      'macom',
      NULL,
      'SEED-MAC-0001',
      NULL,
      NULL,
      NULL,
      NULL
    )
  ON CONFLICT (id) DO NOTHING;
END $$;
