import type { AtaBlock } from "@/lib/member-documents";

/** Declaração final compartilhada pelos questionários de sindicância. */
export const DECLARACAO_SINDICANCIA_TEXTO = `Eu, [candidato], portador do RG [rg] CPF [cpf], respeitosamente solicito ser considerado como candidato aos graus da Ordem DeMolay por intermédio do Capítulo [capitulo_nome] — nº [numero], com sede na cidade de [cidade].

Faço esta solicitação por vontade própria, sem imposição de terceiros, e por desejo de poder fazer parte desta organização para jovens, desde já estando ciente de minhas obrigações caso seja admitido em seu meio.

Tenho crença em um Criador, sigo as leis de meu país e garanto ser uma pessoa de bons costumes e de práticas adequadas e dignas de qualquer homem de bem.

Caso seja aceito como membro da Ordem DeMolay, prometo seguir todas as normas estipuladas pelas Normas, Estatutos, Regimentos e Atos nacionais, estaduais e regionais, assim como o Regimento Interno do Capítulo em que peticiono.

Asseguro ter passado pela entrevista exigida, que foi realizada por [sindicante], e [escrivao], membros ativos da Ordem DeMolay, acompanhados pelo senhor [senior], membro do Conselho Consultivo.

Declaro ter sanado todas as minhas dúvidas acerca dos objetivos e valores da Ordem DeMolay, e afirmo estar ciente dos compromissos e responsabilidades próprias da instituição, bem como afirmo-me ciente dos compromissos financeiros que são exigidos.

Compreendo os motivos da cerimônia de iniciação, estando ciente de que nenhum trote, zombaria, ou prática perigosa serão me impostos em momento algum e que o ritual não tem caráter religioso. Comprometo-me de antemão a guardar sigilo sobre o ritual tradicional, caso venha a conhecê-lo.

Asseguro que minha eventual participação na Ordem DeMolay não atrapalhará meus compromissos escolares, profissionais, religiosos ou familiares.

Garanto ter respondido a todas as questões de maneira verdadeira e condizente com a minha pessoa, de forma que este certificado assegura minha honestidade.

[dia] de [mes] de [ano]`;

/** Bloco preliminar comum (dados da ficha + saúde). */
export function preliminarBlocks(prefix = "pre"): AtaBlock[] {
  return [
    { id: `h_${prefix}`, type: "heading", label: "Informações preliminares do candidato" },
    {
      id: `${prefix}_intro`,
      type: "text",
      label:
        "Quando disponíveis, utilize as informações da ficha de indicação.",
    },
    { id: `${prefix}_nome`, type: "short_text", label: "Nome", required: true },
    {
      id: `${prefix}_macom`,
      type: "yes_no",
      label: "Tem parentesco com Maçom?",
      required: true,
    },
    {
      id: `${prefix}_macom_grau`,
      type: "short_text",
      label: "Grau de parentesco (Pai, Irmão, Avô, Tio ou Outro)",
      required: false,
      showWhen: { id: `${prefix}_macom`, equals: true },
    },
    {
      id: `${prefix}_demolay`,
      type: "yes_no",
      label: "Tem parentesco com DeMolay?",
      required: true,
    },
    {
      id: `${prefix}_demolay_grau`,
      type: "short_text",
      label: "Grau de parentesco (Pai, Irmão, Avô, Tio ou Outro)",
      required: false,
      showWhen: { id: `${prefix}_demolay`, equals: true },
    },
    {
      id: `${prefix}_escudeiro`,
      type: "yes_no",
      label: "É membro da Ordem dos Escudeiros?",
      required: false,
    },
    {
      id: `${prefix}_saude`,
      type: "yes_no",
      label: "Possui alguma doença, alergia ou necessidade especial?",
      required: false,
    },
    {
      id: `${prefix}_saude_detalhe`,
      type: "long_text",
      label: "Qual? (Caso afirmativo, descrever detalhadamente)",
      required: false,
      showWhen: { id: `${prefix}_saude`, equals: true },
    },
    {
      id: `${prefix}_medicamento`,
      type: "yes_no",
      label: "Faz uso de medicamento contínuo?",
      required: false,
    },
    {
      id: `${prefix}_medicamento_detalhe`,
      type: "long_text",
      label: "Qual? (Caso afirmativo, listar)",
      required: false,
      showWhen: { id: `${prefix}_medicamento`, equals: true },
    },
  ];
}

export function declaracaoBlocks(): AtaBlock[] {
  return [
    { id: "h_decl", type: "heading", label: "Declaração de Sindicância" },
    { id: "decl_texto", type: "text", label: DECLARACAO_SINDICANCIA_TEXTO },
  ];
}
