import type { AtaTemplate } from "@/lib/member-documents";
import {
  declaracaoBlocks,
  preliminarBlocks,
} from "@/lib/sindicancia-ata-shared";

/** Questionário admissional 15–17 anos. */
export const ATA_TEMPLATE_15_17: AtaTemplate = {
  blocks: [
    { id: "h_abertura", type: "heading", label: "Texto inicial" },
    {
      id: "abertura_1",
      type: "text",
      label: `Caro candidato,

Antes de iniciarmos esta etapa do processo admissional, gostaríamos de esclarecer alguns pontos importantes sobre nossa organização e sobre os procedimentos que adotamos.

Para que alguém possa se tornar membro da Ordem DeMolay, é necessário que alguém se responsabilize por ele e apresente a Ficha de Indicação (o documento que você já preencheu) para os outros DeMolays avaliarem.

Depois que a ficha é apresentada, uma entrevista é marcada para conhecer melhor o candidato. Esta é a etapa em que você se encontra agora.

Depois da entrevista, os membros do Capítulo se reúnem e votam se aprovam o candidato, e então é marcada a Cerimônia de Iniciação. Você será informado sobre o resultado da votação.`,
    },
    {
      id: "abertura_duvida_proc",
      type: "long_text",
      label: "Alguma dúvida sobre os procedimentos?",
      required: false,
    },
    {
      id: "abertura_2",
      type: "text",
      label:
        "Desde já, explicamos que a Iniciação não é religiosa, nem ocultista, e muito menos consiste em trotes ou brincadeiras.",
    },
    {
      id: "abertura_duvida_inic",
      type: "long_text",
      label: "Você possui alguma dúvida sobre a Iniciação?",
      required: false,
    },

    ...preliminarBlocks("pre"),

    {
      id: "orient_texto",
      type: "text",
      label:
        "Os questionamentos a seguir não possuem respostas certas ou erradas: servem para conhecê-lo melhor e analisar suas expectativas. Pedimos que responda com tranquilidade e contamos com sua total sinceridade.",
    },

    { id: "h_esp", type: "heading", label: "Espiritualidade" },
    {
      id: "esp_intro",
      type: "text",
      label:
        "As perguntas a seguir buscam conhecer um pouco de sua visão sobre a espiritualidade e sobre sua rotina religiosa. A Ordem DeMolay NÃO é uma religião e aceita membros de todas as crenças; para ser DeMolay é indispensável acreditar em um Criador.",
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
      id: "fam_intro",
      type: "text",
      label:
        "Todos os membros se chamam de “irmãos” entre si, pois valorizam os laços que os unem. A Ordem DeMolay não substitui o papel da família — apenas o valoriza (Virtude Cardeal do Amor Filial).",
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
        "As questões a seguir buscam saber mais sobre suas amizades e relações com as pessoas e com a sociedade em geral.",
    },
    {
      id: "soc_amigos",
      type: "long_text",
      label: "Você tem muitos amigos?",
      required: true,
    },
    {
      id: "soc_amigos_bem",
      type: "long_text",
      label: "Sobre seus amigos mais próximos: quão bem eles lhe fazem?",
      required: true,
    },
    {
      id: "soc_amigos_festas",
      type: "long_text",
      label:
        "Como é o comportamento do seu grupo de amigos em relação a festas, bebidas e coisas do tipo?",
      required: true,
    },
    {
      id: "soc_amigos_drogas",
      type: "long_text",
      label: "Costumam usar algum tipo de drogas?",
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

    { id: "h_val", type: "heading", label: "Visão e valores" },
    {
      id: "val_intro",
      type: "text",
      label:
        "Não há gabarito: queremos conhecê-lo. Responda com tranquilidade.",
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
      label: "Qual sua opinião a respeito de vitórias e derrotas?",
      required: true,
    },
    {
      id: "val_vinganca",
      type: "long_text",
      label: "Qual sua opinião sobre vingança?",
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
    {
      id: "val_rapido",
      type: "long_text",
      label:
        "É mais importante fazer algo rápido ou envolvendo muitas pessoas?",
      required: true,
    },

    { id: "h_hab", type: "heading", label: "Hábitos" },
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
      id: "hab_ilicita",
      type: "long_text",
      label: "Já utilizou alguma substância ilícita?",
      required: true,
    },
    {
      id: "hab_convive",
      type: "long_text",
      label: "Convive com usuário de drogas?",
      required: true,
    },
    {
      id: "hab_cigarro",
      type: "long_text",
      label: "Qual sua opinião sobre cigarro e afins?",
      required: true,
    },
    {
      id: "hab_alcool",
      type: "long_text",
      label: "Qual sua opinião sobre bebidas alcoólicas?",
      required: true,
    },
    {
      id: "hab_vicio",
      type: "long_text",
      label: "Possui algum vício que gostaria de eliminar?",
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
      id: "pot_manda",
      type: "long_text",
      label: "Você se considera uma pessoa que “manda” ou que “obedece”?",
      required: true,
    },
    {
      id: "pot_projetos",
      type: "long_text",
      label: "Já participou de projetos sociais ou grupos de jovens?",
      required: true,
    },
    {
      id: "pot_lideranca",
      type: "long_text",
      label: "Já exerceu liderança? Se sim, como foi a experiência?",
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
      id: "pot_planos",
      type: "long_text",
      label: "Quais são seus planos profissionais?",
      required: true,
    },
    {
      id: "pot_disciplinas",
      type: "long_text",
      label: "Quais disciplinas você mais gosta?",
      required: true,
    },
    {
      id: "pot_admira",
      type: "long_text",
      label: "Quem você mais admira?",
      required: true,
    },
    {
      id: "pot_frustra",
      type: "long_text",
      label: "O que te frustra?",
      required: true,
    },

    { id: "h_civ", type: "heading", label: "Civismo" },
    {
      id: "civ_intro",
      type: "text",
      label:
        "As perguntas a seguir tratam do civismo, ligado à virtude do Patriotismo. Não há gabarito.",
    },
    {
      id: "civ_guerras",
      type: "long_text",
      label: "Qual sua opinião a respeito de guerras?",
      required: true,
    },
    {
      id: "civ_define",
      type: "long_text",
      label: "Como você define patriotismo?",
      required: true,
    },
    {
      id: "civ_patriota",
      type: "long_text",
      label: "Você se considera patriota?",
      required: true,
    },
    {
      id: "civ_leis",
      type: "long_text",
      label: "Segue todas as leis do País, estado e município?",
      required: true,
    },

    { id: "h_od", type: "heading", label: "Ordem DeMolay" },
    {
      id: "od_intro",
      type: "text",
      label:
        "Neste bloco buscamos compreender suas expectativas e referências sobre a Ordem DeMolay.",
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
        "Caso seja aceito, terá que abrir mão de certas atividades nos fins de semana e, eventualmente, durante a semana. Está disposto a isso?",
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
        "Caso se torne um DeMolay, você acha que será melhor que as outras pessoas que não são? Por quê?",
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
        "O fato de ser um grupo relacionado à Maçonaria influencia sua vontade de entrar? Se sim, de que forma?",
      required: false,
    },
    {
      id: "od_atencao",
      type: "long_text",
      label:
        "Dentro do que você aprendeu sobre a Ordem DeMolay, o que mais lhe chamou atenção? Por quê?",
      required: true,
    },

    ...declaracaoBlocks(),
  ],
};
