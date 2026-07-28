
-- 1. Status da ata
CREATE TYPE public.minute_status AS ENUM ('rascunho','em_revisao','aprovada');

ALTER TABLE public.session_minutes
  ADD COLUMN status public.minute_status NOT NULL DEFAULT 'rascunho',
  ADD COLUMN title text;

-- 2. Assinaturas
CREATE TYPE public.minute_signer_role AS ENUM ('presidente_conselho','mestre_conselheiro','escrivao');

CREATE TABLE public.minute_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  minute_id uuid NOT NULL REFERENCES public.session_minutes(id) ON DELETE CASCADE,
  signer_role public.minute_signer_role NOT NULL,
  user_id uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (minute_id, signer_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minute_approvals TO authenticated;
GRANT ALL ON public.minute_approvals TO service_role;
ALTER TABLE public.minute_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals_select" ON public.minute_approvals
  FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));

CREATE POLICY "approvals_write" ON public.minute_approvals
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao','presidente_conselho','consultor']));

-- 3. Modelos de ata
CREATE TABLE public.minute_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minute_templates TO authenticated;
GRANT ALL ON public.minute_templates TO service_role;
ALTER TABLE public.minute_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select" ON public.minute_templates
  FOR SELECT TO authenticated USING (public.is_chapter_member(chapter_id));

CREATE POLICY "templates_write" ON public.minute_templates
  FOR ALL TO authenticated
  USING (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao']))
  WITH CHECK (public.has_any_role(chapter_id, ARRAY['admin_total','mestre_conselheiro','escrivao']));

CREATE TRIGGER set_updated_at_minute_templates
  BEFORE UPDATE ON public.minute_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. Seed dos 6 modelos padrão para todos os capítulos
INSERT INTO public.minute_templates (chapter_id, code, name, body, sort_order)
SELECT c.id, t.code, t.name, t.body, t.sort_order
FROM public.chapters c
CROSS JOIN (VALUES
  ('ordinaria_gi', 'Ordinária Grau Iniciático', 1,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização de uma Sessão Ordinária de Grau Iniciático, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos demais membros, conforme registrado em lista própria, onde foram tratados os assuntos constantes na ordem do dia, sendo estes [descrição dos assuntos], após discussões e deliberações, foram tomadas as seguintes decisões [decisões], nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.'),
  ('ordinaria_dm', 'Ordinária Grau DeMolay', 2,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização de uma Sessão Ordinária de Grau DeMolay, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos demais membros, conforme registrado em lista própria, onde foram tratados os assuntos constantes na ordem do dia, sendo estes [descrição dos assuntos], após discussões e deliberações, foram tomadas as seguintes decisões [decisões], nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.'),
  ('eleicao', 'Eleição', 3,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização da Sessão de Eleição, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos membros aptos a votar, conforme lista de presença, onde foi realizada a eleição para os cargos de Mestre Conselheiro, Primeiro Conselheiro e Segundo Conselheiro, sendo apresentados os candidatos [nomes], após o processo de votação e apuração dos votos, foram eleitos os irmãos [nome], [nome] e [nome] respectivamente para os cargos citados, nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.'),
  ('iniciacao_gi', 'Iniciação Grau Iniciático', 4,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização da Cerimônia de Iniciação de Grau Iniciático, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos demais membros e convidados, onde foram iniciados os candidatos [nomes dos iniciados], seguindo todos os preceitos ritualísticos da Ordem DeMolay, nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.'),
  ('iniciacao_dm', 'Iniciação Grau DeMolay', 5,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização da Cerimônia de Iniciação de Grau DeMolay, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos demais membros e convidados, onde foram iniciados ao Grau DeMolay os irmãos [nomes], seguindo todos os preceitos ritualísticos da Ordem DeMolay, nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.'),
  ('escrutinio', 'Escrutínio', 6,
   'Aos [dia] dias do mês de [mês] do ano de [ano por extenso], no [nome da loja/capítulo], situado na [endereço completo], reuniram-se os membros do Capítulo para a realização do Escrutínio, sob a presidência do Mestre Conselheiro [Membro_MC], sendo auxiliado pelos Conselheiros [Membro_1C] e [Membro_2C], respectivamente Primeiro e Segundo Conselheiro, com a presença dos membros, onde foram analisados os nomes de [nomes dos candidatos], sendo submetidos ao processo de votação conforme preceitos da Ordem DeMolay, tendo como resultado [resultado do escrutínio], nada mais havendo a tratar, foi encerrada a sessão pelo Mestre Conselheiro, e eu, [Membro_Escrivao], lavrei a presente ata que após lida e aprovada será assinada por mim, pelo Mestre Conselheiro e pelo Presidente do Conselho Consultivo.')
) AS t(code, name, sort_order, body)
ON CONFLICT (chapter_id, code) DO NOTHING;
