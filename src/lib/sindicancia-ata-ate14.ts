import type { AtaTemplate } from "@/lib/member-documents";

/** Questionário admissional 12–14 anos (textos, sim/não e descritivas). */
export const ATA_TEMPLATE_ATE_14: AtaTemplate = {
  blocks: [
    { id: "h_pre", type: "heading", label: "Informações preliminares do candidato" },
    {
      id: "pre_intro",
      type: "text",
      label:
        "Dados preliminares — quando disponíveis, utilize as informações da ficha de indicação.",
    },
    { id: "pre_nome", type: "short_text", label: "Nome", required: true },
    {
      id: "pre_macom",
      type: "yes_no",
      label: "Tem parentesco com Maçom?",
      required: true,
    },
    {
      id: "pre_macom_grau",
      type: "short_text",
      label: "Grau de parentesco (Pai, Irmão, Avô, Tio ou Outro)",
      required: false,
      showWhen: { id: "pre_macom", equals: true },
    },
    {
      id: "pre_demolay",
      type: "yes_no",
      label: "Tem parentesco com DeMolay?",
      required: true,
    },
    {
      id: "pre_demolay_grau",
      type: "short_text",
      label: "Grau de parentesco (Pai, Irmão, Avô, Tio ou Outro)",
      required: false,
      showWhen: { id: "pre_demolay", equals: true },
    },
    {
      id: "pre_escudeiro",
      type: "yes_no",
      label: "É membro da Ordem dos Escudeiros?",
      required: false,
    },
    {
      id: "pre_saude",
      type: "yes_no",
      label: "Possui alguma doença, alergia ou necessidade especial?",
      required: false,
    },
    {
      id: "pre_saude_detalhe",
      type: "long_text",
      label: "Qual? (Caso afirmativo, descrever detalhadamente)",
      required: false,
      showWhen: { id: "pre_saude", equals: true },
    },
    {
      id: "pre_medicamento",
      type: "yes_no",
      label: "Faz uso de medicamento contínuo?",
      required: false,
    },
    {
      id: "pre_medicamento_detalhe",
      type: "long_text",
      label: "Qual? (Caso afirmativo, listar)",
      required: false,
      showWhen: { id: "pre_medicamento", equals: true },
    },

    { id: "h_esp", type: "heading", label: "Espiritualidade" },
    {
      id: "esp_intro_1",
      type: "text",
      label:
        "As perguntas a seguir buscam conhecer um pouco de sua visão sobre a espiritualidade e sobre sua rotina religiosa.",
    },
    {
      id: "esp_intro_2",
      type: "text",
      label:
        "Saiba que a Ordem DeMolay NÃO é uma religião, e nem busca ocupar o lugar das práticas religiosas, mas incentiva que seus membros cultivem sua fé pessoal. Temos, inclusive, como uma de nossas Virtudes Cardeais, o preceito da Reverência pelas Coisas Sagradas.",
    },
    {
      id: "esp_intro_3",
      type: "text",
      label:
        "Aceitamos, sem distinção, membros de todas as crenças, e não interferimos na fé de cada um, porém, para se tornar um DeMolay é indispensável acreditar na existência de um Criador, pois a instituição entende que a espiritualidade é importante para a formação completa de um jovem.",
    },
    {
      id: "esp_deus",
      type: "yes_no",
      label: "Você acredita em Deus ou em um Ser Criador?",
      required: true,
    },
    {
      id: "esp_oracao",
      type: "yes_no",
      label: "Costuma fazer orações?",
      required: false,
    },
    {
      id: "esp_religiao",
      type: "long_text",
      label: "Tem religião? Se sim, qual?",
      required: false,
    },
    {
      id: "esp_compromissos",
      type: "long_text",
      label:
        "Possui compromissos religiosos? Se sim, quais, e em qual periodicidade?",
      required: false,
    },
    {
      id: "esp_conflito",
      type: "long_text",
      label:
        "Caso venha a ser aceito no Capítulo, há alguma chance de os compromissos na Ordem DeMolay atrapalharem sua rotina religiosa? Se sim, de que maneira?",
      required: false,
    },
    {
      id: "esp_melhor",
      type: "long_text",
      label: "Considera sua religião melhor que a dos outros?",
      required: true,
    },
    {
      id: "esp_convivio",
      type: "long_text",
      label:
        "Acredita que é possível o convívio entre pessoas de religiões diferentes?",
      required: true,
    },

    { id: "h_fam", type: "heading", label: "Família" },
    {
      id: "fam_intro_1",
      type: "text",
      label:
        "Todos os membros se chamam de “irmãos” entre si, pois valorizam os laços que os unem, porém, a Ordem DeMolay não busca, de forma alguma, substituir o papel da família, em nenhum aspecto — apenas valorizá-lo. Nesse sentido, temos como Virtude Cardeal o Amor Filial — o amor entre pais e filhos.",
    },
    {
      id: "fam_intro_2",
      type: "text",
      label:
        "As perguntas a seguir servem para que possamos conhecer melhor sobre você e a relação com sua família.",
    },
    {
      id: "fam_mora",
      type: "long_text",
      label: "Você mora com seus pais?",
      required: true,
    },
    {
      id: "fam_da_bem",
      type: "long_text",
      label: "Você se dá bem com a sua família?",
      required: true,
    },
    {
      id: "fam_fale",
      type: "long_text",
      label: "Fale sobre sua família.",
      required: true,
    },
    {
      id: "fam_ideias",
      type: "long_text",
      label: "Suas ideias mais se parecem ou se diferem das dos seus pais? Por quê?",
      required: true,
    },
    {
      id: "fam_tempo",
      type: "long_text",
      label: "Quanto tempo você passa com a sua família?",
      required: true,
    },
    {
      id: "fam_importante",
      type: "long_text",
      label: "Considera a família importante?",
      required: true,
    },

    { id: "h_soc", type: "heading", label: "Vida em sociedade" },
    {
      id: "soc_intro",
      type: "text",
      label:
        "As questões a seguir buscam saber mais sobre suas amizades e relações com as pessoas e com a sociedade em geral. Buscamos compreender, com esses questionamentos, a maneira com que você interage com o mundo.",
    },
    {
      id: "soc_amigos",
      type: "long_text",
      label: "Você tem muitos amigos?",
      required: true,
    },
    {
      id: "soc_qualidades",
      type: "long_text",
      label:
        "Quais as melhores qualidades e piores defeitos dos seus amigos mais próximos?",
      required: true,
    },
    {
      id: "soc_novos",
      type: "long_text",
      label:
        "Acredita que fará novos amigos na Ordem DeMolay? Isso influencia em sua decisão de pedir ingresso?",
      required: true,
    },
    {
      id: "soc_briguento",
      type: "long_text",
      label: "Considera-se briguento, explosivo ou temperamental?",
      required: true,
    },
    {
      id: "soc_culpa",
      type: "long_text",
      label:
        "Quando você briga com alguém, geralmente a culpa é sua ou da outra pessoa?",
      required: true,
    },
    {
      id: "soc_desculpas",
      type: "long_text",
      label: "Tem facilidade em pedir desculpas?",
      required: true,
    },
    {
      id: "soc_amizade",
      type: "long_text",
      label:
        "O que você entende por “amizade”? Em sua opinião, qual a importância dela na sua vida?",
      required: true,
    },

    { id: "h_val", type: "heading", label: "Visão e valores" },
    {
      id: "val_intro",
      type: "text",
      label:
        "As perguntas a seguir servem para que possamos compreender melhor sua visão sobre si próprio e a realidade que o cerca. Lembre-se que não há um “gabarito”, apenas queremos conhecê-lo, então responda com tranquilidade.",
    },
    {
      id: "val_qualidade",
      type: "long_text",
      label: "Qual é a sua melhor qualidade?",
      required: true,
    },
    {
      id: "val_defeito",
      type: "long_text",
      label: "Qual você considera ser o seu principal defeito?",
      required: true,
    },
    {
      id: "val_apontam",
      type: "long_text",
      label: "Qual defeito as pessoas mais apontam em você?",
      required: true,
    },
    {
      id: "val_vitorias",
      type: "long_text",
      label:
        "Qual sua opinião a respeito de vitórias e derrotas? Como você lida com cada uma delas?",
      required: true,
    },
    {
      id: "val_rico",
      type: "long_text",
      label:
        "Você considera mais importante ser rico ou ter influência sobre as pessoas?",
      required: true,
    },
    {
      id: "val_admira",
      type: "long_text",
      label: "Quem são as pessoas que você mais admira na sua vida e por quê?",
      required: true,
    },
    {
      id: "val_ouvido",
      type: "long_text",
      label:
        "Você considera mais importante ser ouvido por muitos ou ter muito conhecimento?",
      required: true,
    },
    {
      id: "val_qualidade_mundo",
      type: "long_text",
      label:
        "Se você pudesse passar uma qualidade sua para todas as crianças do mundo, qual seria?",
      required: true,
    },

    { id: "h_hab", type: "heading", label: "Hábitos" },
    {
      id: "hab_intro",
      type: "text",
      label:
        "As questões a seguir buscam conhecer mais sobre sua rotina, seus gostos e seus hábitos. Lembramos novamente da necessidade de responder com sinceridade e tranquilidade.",
    },
    {
      id: "hab_saudavel",
      type: "long_text",
      label: "Quais hábitos você considera importante para uma vida saudável?",
      required: true,
    },
    {
      id: "hab_ler",
      type: "long_text",
      label: "Você tem o hábito de ler? O que?",
      required: true,
    },
    {
      id: "hab_filmes",
      type: "long_text",
      label: "Gosta de filmes e/ou séries? De quais tipos?",
      required: true,
    },
    {
      id: "hab_esportes",
      type: "long_text",
      label: "Pratica esportes? Se sim, quais?",
      required: false,
    },
    {
      id: "hab_hobbies",
      type: "long_text",
      label: "Quais são seus hobbies?",
      required: true,
    },
    {
      id: "hab_mudar",
      type: "long_text",
      label: "Tem algum hábito que você gostaria de mudar?",
      required: true,
    },
    {
      id: "hab_estudar",
      type: "long_text",
      label: "Como você costuma estudar?",
      required: true,
    },
    {
      id: "hab_drogas",
      type: "long_text",
      label: "Qual sua opinião sobre drogas?",
      required: true,
    },
    {
      id: "hab_alcool",
      type: "long_text",
      label: "Qual sua opinião sobre bebidas alcoólicas?",
      required: true,
    },
    {
      id: "hab_atraso",
      type: "long_text",
      label: "Costuma se atrasar?",
      required: true,
    },

    { id: "h_pot", type: "heading", label: "Potencialidades e aptidões" },
    {
      id: "pot_intro",
      type: "text",
      label:
        "As perguntas a seguir tratam sobre potencialidades e aptidões. Caso você venha a ser aceito, poderemos aproveitar melhor seus talentos levando em consideração suas respostas.",
    },
    {
      id: "pot_manda",
      type: "long_text",
      label: "Você se considera uma pessoa que “manda” ou que “obedece”?",
      required: true,
    },
    {
      id: "pot_ong",
      type: "long_text",
      label:
        "Você ajuda ou já ajudou algum tipo de instituição ou ONG, de projetos sociais? Alguma vez já fez parte de algum grupo de jovens?",
      required: true,
    },
    {
      id: "pot_lideranca",
      type: "long_text",
      label:
        "Já foi representante de sala, de grêmio estudantil ou liderou em alguma outra instituição? Se sim, como foi essa experiência?",
      required: false,
    },
    {
      id: "pot_timido",
      type: "long_text",
      label: "Considera-se tímido?",
      required: true,
    },
    {
      id: "pot_diferencial",
      type: "long_text",
      label: "Você tem algum diferencial positivo?",
      required: true,
    },
    {
      id: "pot_arte",
      type: "long_text",
      label: "Você domina algum tipo de arte? (Música, pintura, teatro etc.)",
      required: false,
    },
    {
      id: "pot_disciplinas",
      type: "long_text",
      label: "Quais disciplinas escolares você tem mais aptidão e/ou gosta mais?",
      required: true,
    },

    { id: "h_civ", type: "heading", label: "Civismo" },
    {
      id: "civ_intro",
      type: "text",
      label:
        "Sendo uma escola de valores, a Ordem DeMolay tem como um de seus objetivos a preparação do jovem para a vida cidadã. Por conta disso, as perguntas a seguir tratam sobre o “civismo”, que está diretamente ligado à virtude do Patriotismo. Lembre-se que não há um gabarito, e responda à vontade.",
    },
    {
      id: "civ_util",
      type: "long_text",
      label: "Você se considera útil à sociedade?",
      required: true,
    },
    {
      id: "civ_leis",
      type: "long_text",
      label: "Segue todas as Leis do País, estado e município?",
      required: true,
    },

    { id: "h_od", type: "heading", label: "Ordem DeMolay" },
    {
      id: "od_intro",
      type: "text",
      label:
        "Neste último bloco de perguntas, buscamos compreender quais são suas expectativas com a Ordem DeMolay e quais são suas referências. Esperamos saber se suas ideias sobre o que é a Ordem e sobre o que ela pode oferecer condizem com a realidade, pois desejamos uma relação saudável e transparente.",
    },
    {
      id: "od_conheceu",
      type: "long_text",
      label: "De que forma você conheceu a Ordem DeMolay?",
      required: true,
    },
    {
      id: "od_membro",
      type: "long_text",
      label: "Conhece algum membro da Ordem? Caso conheça, fale sobre ele.",
      required: false,
    },
    {
      id: "od_primeira",
      type: "long_text",
      label:
        "Qual a primeira coisa que lhe vem à cabeça quando dizem “Ordem DeMolay”?",
      required: true,
    },
    {
      id: "od_disposto",
      type: "yes_no",
      label:
        "Caso você venha a ser aceito, você tem noção de que terá que abrir mão de certas atividades em seus fins de semana e eventualmente durante a semana. Você está disposto a isto, lembrando que prezamos pela total honestidade e que, futuramente, o Capítulo pode ser prejudicado pelas suas faltas?",
      required: true,
    },
    {
      id: "od_vontade",
      type: "yes_no",
      label: "É vontade própria entrar na Ordem DeMolay?",
      required: true,
    },
    {
      id: "od_melhor",
      type: "long_text",
      label:
        "Caso você se torne um DeMolay, você acha que será melhor que as outras pessoas que não são? Por quê?",
      required: true,
    },
    {
      id: "od_porque",
      type: "long_text",
      label: "Por que você quer entrar na Ordem?",
      required: true,
    },
    {
      id: "od_maconaria",
      type: "long_text",
      label:
        "O fato de ser um grupo relacionado à Maçonaria influencia sua vontade em entrar na Ordem DeMolay? Se afirmativo, de que forma?",
      required: false,
    },
    {
      id: "od_atencao",
      type: "long_text",
      label:
        "Dentro do que você aprendeu sobre a Ordem DeMolay, qual parte mais lhe chamou atenção? Consegue identificar o motivo?",
      required: true,
    },

    { id: "h_decl", type: "heading", label: "Declaração de Sindicância" },
    {
      id: "decl_texto",
      type: "text",
      label: `Eu, [candidato], portador do RG [rg] CPF [cpf], respeitosamente solicito ser considerado como candidato aos graus da Ordem DeMolay por intermédio do Capítulo [capitulo_nome] — nº [numero], com sede na cidade de [cidade].

Faço esta solicitação por vontade própria, sem imposição de terceiros, e por desejo de poder fazer parte desta organização para jovens, desde já estando ciente de minhas obrigações caso seja admitido em seu meio.

Tenho crença em um Criador, sigo as leis de meu país e garanto ser uma pessoa de bons costumes e de práticas adequadas e dignas de qualquer homem de bem.

Caso seja aceito como membro da Ordem DeMolay, prometo seguir todas as normas estipuladas pelas Normas, Estatutos, Regimentos e Atos nacionais, estaduais e regionais, assim como o Regimento Interno do Capítulo em que peticiono.

Asseguro ter passado pela entrevista exigida, que foi realizada por [sindicante], e [escrivao], membros ativos da Ordem DeMolay, acompanhados pelo senhor [senior], membro do Conselho Consultivo.

Declaro ter sanado todas as minhas dúvidas acerca dos objetivos e valores da Ordem DeMolay, e afirmo estar ciente dos compromissos e responsabilidades próprias da instituição, bem como afirmo-me ciente dos compromissos financeiros que são exigidos.

Compreendo os motivos da cerimônia de iniciação, estando ciente de que nenhum trote, zombaria, ou prática perigosa serão me impostos em momento algum e que o ritual não tem caráter religioso. Comprometo-me de antemão a guardar sigilo sobre o ritual tradicional, caso venha a conhecê-lo.

Asseguro que minha eventual participação na Ordem DeMolay não atrapalhará meus compromissos escolares, profissionais, religiosos ou familiares.

Garanto ter respondido a todas as questões de maneira verdadeira e condizente com a minha pessoa, de forma que este certificado assegura minha honestidade.

[dia] de [mes] de [ano]`,
    },
  ],
};
