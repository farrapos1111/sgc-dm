-- Atualiza demolay_id dos membros do Farrapos
-- Cole no SQL Editor do Supabase e execute.
-- Retorna as linhas atualizadas.

WITH chapter AS (
  SELECT id FROM public.chapters
  WHERE name ILIKE '%Farrapos%'
  LIMIT 1
),
updates(full_name, demolay_id) AS (
  VALUES
  ('Guilherme Marzotto', '157789'),
  ('Guilherme da Silva Dutra', '157790'),
  ('Davi Bernardo Prux', '157791'),
  ('Miguel Werner Prestes', '157792'),
  ('Vinícius Menegol Cardoso', '157793'),
  ('Rafael Hoffmann', '89129'),
  ('Marciel Paim de Lima', '90303'),
  ('Guilherme Deon Pereira', '90462'),
  ('Andrew Horn de Borba', '90478'),
  ('Arthur Perotoni', '91569'),
  ('Pedro Gedoz de Godolphim', '91611'),
  ('Gustavo Luís Inocêncio', '91690'),
  ('Felipe de Mattos Alves', '92532'),
  ('Jorge Eduardo Lolas Feiten', '92848'),
  ('Vinícius Parisotto Quirino dos Santos', '94174'),
  ('Marco Antônio Parisenti da Costa', '94614'),
  ('Arthur Eduardo da Silva', '94615'),
  ('Fabrício Kehl', '94616'),
  ('Adrian Ruan Horn de Borba', '95417'),
  ('Jéferson Küch', '96099'),
  ('Andre Girardi Dalathea', '99591'),
  ('Luiz Carlos Milani Júnior', '99728'),
  ('Jorge Mansardo de Oliveira', '99906'),
  ('Lucas Pereira Müller', '100099'),
  ('Vitor Betto Perottoni', '104735'),
  ('Pedro Henrique Almeida de Mello', '105773'),
  ('João Victor Barbosa Possa', '106327'),
  ('Pedro Bossle Sandi', '107722'),
  ('Arthur Espinosa da Silva', '107723'),
  ('Ricardo Pieruccini Massairo', '114604'),
  ('Diego Henrique Brandt', '114605'),
  ('Mickael Lucas da Luz Giongo', '114606'),
  ('Emmanuel Feiten de Souza', '114607'),
  ('Leonardo Silva de Jesus', '117803'),
  ('Gabriel Maciel Borssato', '117804'),
  ('Bernardo Luiz Candeia', '117805'),
  ('Guilherme Garbin Ghiotti', '118712'),
  ('Luiz Felipe Orsato Alves', '118713'),
  ('Miguel Panisson Cruz', '118714'),
  ('Arthur Pezzi Dall''Agnol', '123832'),
  ('Rafael Machado Roldo', '123833'),
  ('Gabriel Machado Roldo', '123834'),
  ('Anthony Ricardo Marcolin Machado Zencke', '123835'),
  ('Vicente dal Magro Ganzer', '123836'),
  ('Vitor Reis Moravski', '125900'),
  ('Davi Miranda Teixeira', '125901'),
  ('Leonardo Argenta', '126369'),
  ('Rafael de Andrade Branco', '129134'),
  ('Arthur Toigo de Campos', '129135'),
  ('Elias Algemiro Artagabeitia Ferreira', '129136'),
  ('Vinicius Réquia Dalla Porta', '129137'),
  ('Victor Gobi de Araújo', '136085'),
  ('Henrique Rodriguês Klipp da Anunciação', '136086'),
  ('Lucas Boeira Borges', '136087'),
  ('Wesley Antonio Perini', '136088'),
  ('Rafael Adamatti Artagabeitia', '136089'),
  ('Vitor Adamatti Artagabeitia', '136090'),
  ('Arthur Toss Debaco', '136091'),
  ('Guilherme Gonçalves Peres', '136092'),
  ('Braian Roldo Visona', '139682'),
  ('Carlos Henrique Köhler Mendes', '139683'),
  ('Vicente Azevedo de Oliveira', '145938'),
  ('Franco Azevedo de Oliveira', '145939'),
  ('André Azevedo de Oliveira', '145940'),
  ('Arthur Adami Gaio', '145941'),
  ('Lorenzo Retore Frighetto', '145942'),
  ('Nicolas Farias Peroni', '145943'),
  ('Luis Enrique Subtil', '151214'),
  ('Arthur Tonet Pagliarin', '151215'),
  ('Erick Carlos Teixeira Alves', '151216'),
  ('João Alfredo da Silva Faggion', '151217'),
  ('João Pedro Cecin Coelho Stopassola', '151218'),
  ('Bryan Joaquim Ferreira Pereira', '151219'),
  ('Miguel Ribeiro Paim', '151220'),
  ('Ariam Miguel Sander Lumertz dos Reis', '157788')
),
norm AS (
  SELECT
    full_name,
    demolay_id,
    lower(translate(full_name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) AS name_key
  FROM updates
),
matched AS (
  UPDATE public.members m
  SET demolay_id = n.demolay_id,
      updated_at = now()
  FROM norm n, chapter c
  WHERE m.chapter_id = c.id
    AND lower(translate(m.full_name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) = n.name_key
  RETURNING m.full_name, m.demolay_id
)
SELECT * FROM matched
ORDER BY full_name;


-- Conferir quem da lista NÃO bateu (rode depois do UPDATE):
WITH chapter AS (
  SELECT id FROM public.chapters WHERE name ILIKE '%Farrapos%' LIMIT 1
),
updates(full_name, demolay_id) AS (
  VALUES
  ('Guilherme Marzotto', '157789'),
  ('Guilherme da Silva Dutra', '157790'),
  ('Davi Bernardo Prux', '157791'),
  ('Miguel Werner Prestes', '157792'),
  ('Vinícius Menegol Cardoso', '157793'),
  ('Rafael Hoffmann', '89129'),
  ('Marciel Paim de Lima', '90303'),
  ('Guilherme Deon Pereira', '90462'),
  ('Andrew Horn de Borba', '90478'),
  ('Arthur Perotoni', '91569'),
  ('Pedro Gedoz de Godolphim', '91611'),
  ('Gustavo Luís Inocêncio', '91690'),
  ('Felipe de Mattos Alves', '92532'),
  ('Jorge Eduardo Lolas Feiten', '92848'),
  ('Vinícius Parisotto Quirino dos Santos', '94174'),
  ('Marco Antônio Parisenti da Costa', '94614'),
  ('Arthur Eduardo da Silva', '94615'),
  ('Fabrício Kehl', '94616'),
  ('Adrian Ruan Horn de Borba', '95417'),
  ('Jéferson Küch', '96099'),
  ('Andre Girardi Dalathea', '99591'),
  ('Luiz Carlos Milani Júnior', '99728'),
  ('Jorge Mansardo de Oliveira', '99906'),
  ('Lucas Pereira Müller', '100099'),
  ('Vitor Betto Perottoni', '104735'),
  ('Pedro Henrique Almeida de Mello', '105773'),
  ('João Victor Barbosa Possa', '106327'),
  ('Pedro Bossle Sandi', '107722'),
  ('Arthur Espinosa da Silva', '107723'),
  ('Ricardo Pieruccini Massairo', '114604'),
  ('Diego Henrique Brandt', '114605'),
  ('Mickael Lucas da Luz Giongo', '114606'),
  ('Emmanuel Feiten de Souza', '114607'),
  ('Leonardo Silva de Jesus', '117803'),
  ('Gabriel Maciel Borssato', '117804'),
  ('Bernardo Luiz Candeia', '117805'),
  ('Guilherme Garbin Ghiotti', '118712'),
  ('Luiz Felipe Orsato Alves', '118713'),
  ('Miguel Panisson Cruz', '118714'),
  ('Arthur Pezzi Dall''Agnol', '123832'),
  ('Rafael Machado Roldo', '123833'),
  ('Gabriel Machado Roldo', '123834'),
  ('Anthony Ricardo Marcolin Machado Zencke', '123835'),
  ('Vicente dal Magro Ganzer', '123836'),
  ('Vitor Reis Moravski', '125900'),
  ('Davi Miranda Teixeira', '125901'),
  ('Leonardo Argenta', '126369'),
  ('Rafael de Andrade Branco', '129134'),
  ('Arthur Toigo de Campos', '129135'),
  ('Elias Algemiro Artagabeitia Ferreira', '129136'),
  ('Vinicius Réquia Dalla Porta', '129137'),
  ('Victor Gobi de Araújo', '136085'),
  ('Henrique Rodriguês Klipp da Anunciação', '136086'),
  ('Lucas Boeira Borges', '136087'),
  ('Wesley Antonio Perini', '136088'),
  ('Rafael Adamatti Artagabeitia', '136089'),
  ('Vitor Adamatti Artagabeitia', '136090'),
  ('Arthur Toss Debaco', '136091'),
  ('Guilherme Gonçalves Peres', '136092'),
  ('Braian Roldo Visona', '139682'),
  ('Carlos Henrique Köhler Mendes', '139683'),
  ('Vicente Azevedo de Oliveira', '145938'),
  ('Franco Azevedo de Oliveira', '145939'),
  ('André Azevedo de Oliveira', '145940'),
  ('Arthur Adami Gaio', '145941'),
  ('Lorenzo Retore Frighetto', '145942'),
  ('Nicolas Farias Peroni', '145943'),
  ('Luis Enrique Subtil', '151214'),
  ('Arthur Tonet Pagliarin', '151215'),
  ('Erick Carlos Teixeira Alves', '151216'),
  ('João Alfredo da Silva Faggion', '151217'),
  ('João Pedro Cecin Coelho Stopassola', '151218'),
  ('Bryan Joaquim Ferreira Pereira', '151219'),
  ('Miguel Ribeiro Paim', '151220'),
  ('Ariam Miguel Sander Lumertz dos Reis', '157788')
)
SELECT u.full_name, u.demolay_id AS id_esperado
FROM updates u
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m, chapter c
  WHERE m.chapter_id = c.id
    AND lower(translate(m.full_name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
      = lower(translate(u.full_name, 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))
)
ORDER BY u.full_name;
