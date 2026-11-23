/**
 * Dados 100% fictícios do ambiente de demonstração (/demonstracao).
 * Nenhum nome, valor ou evento aqui corresponde a uma organização real.
 */

export type OrgKind = "odm" | "fdj" | "loja";

export const ORG_KINDS: OrgKind[] = ["odm", "fdj", "loja"];

/** Data "de hoje" fixa, para a demonstração ficar sempre igual. */
export const DEMO_TODAY = new Date(2026, 10, 23);

export const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
export const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type DemoMember = {
  id: string;
  name: string;
  grade: string;
  role: string | null;
  birthday: string; // dd/mm
  birthDate: string; // dd/mm/aaaa
  since: string; // dd/mm/aaaa
  regNo: string;
  phone: string;
  email: string;
  status: "Ativo" | "Licenciado";
  /** Cargos ocupados em gestões anteriores. */
  history: { term: string; role: string }[];
  attendance: number; // %
};

export type CashEntry = {
  id: string;
  date: string; // dd/mm
  desc: string;
  category: string;
  type: "in" | "out";
  value: number;
};

export type DemoEvent = {
  id: string;
  day: number; // novembro de 2026
  time: string;
  title: string;
  type: "Ritualística" | "Administrativa" | "Filantropia" | "Social" | "Obrigatória";
  place: string;
};

export type TicketType = { id: string; label: string; price: number };
export type Product = { id: string; label: string; price: number; stock: number };
export type TabItem = { id: string; productId: string; qty: number; paid: boolean };
export type Guest = {
  id: string;
  name: string;
  ticket: string; // TicketType.id
  ticketPaid: boolean;
  checkedIn: boolean;
  items: TabItem[];
};

export type SocialEvent = {
  title: string;
  date: string;
  place: string;
  tickets: TicketType[];
  products: Product[];
  guests: Guest[];
};

export type Verdict = "F" | "D" | null;
export type Investigator = {
  memberId: string;
  verdict: Verdict;
  answers: string[];
  answeredAt: string | null;
};
export type Investigation = {
  id: string;
  candidate: string;
  candidateInfo: string;
  sponsorId: string;
  opened: string;
  deadline: string;
  status: "Em andamento" | "Concluída";
  result: "Favorável" | "Desfavorável" | null;
  investigators: Investigator[];
};

export type DemoOrg = {
  kind: OrgKind;
  viewAs: string;
  orgType: string;
  name: string;
  short: string;
  number: string;
  city: string;
  emblem: string;
  memberWord: { one: string; many: string; candidate: string };
  grades: string[];
  seniorGrade: string | null;
  user: { memberId: string; role: string };
  members: DemoMember[];
  dueValue: number;
  cash: CashEntry[];
  yearBefore: { in: number; out: number; opening: number };
  cashIn: string[];
  cashOut: string[];
  events: DemoEvent[];
  sessionDay: number;
  mandatory: string;
  minutesWord: string;
  minutes: { id: string; title: string; date: string; status: string }[];
  social: SocialEvent;
  investigations: Investigation[];
  questions: string[];
};

/* ------------------------------------------------------------------ */
/* Construtores                                                        */
/* ------------------------------------------------------------------ */

type Seed = [
  name: string,
  grade: string,
  role: string | null,
  birthday: string,
  licensed?: boolean,
];

function buildMembers(
  seeds: Seed[],
  opts: {
    prefix: string;
    number: string;
    birthYears: [number, number];
    sinceYears: [number, number];
    pastRoles: string[];
  },
): DemoMember[] {
  return seeds.map(([name, grade, role, birthday, licensed], i) => {
    const idx = i + 1;
    const id = `m${String(idx).padStart(2, "0")}`;
    const parts = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ");
    const span = opts.birthYears[1] - opts.birthYears[0];
    const sinceSpan = opts.sinceYears[1] - opts.sinceYears[0];
    const sinceYear = opts.sinceYears[0] + ((i * 3) % (sinceSpan + 1));
    const history =
      i % 3 === 2
        ? []
        : [
            {
              term: `1º semestre de ${Math.max(sinceYear + 1, 2025)}`,
              role: opts.pastRoles[i % opts.pastRoles.length],
            },
            ...(i % 2 === 0
              ? [
                  {
                    term: `2º semestre de ${Math.max(sinceYear, 2024)}`,
                    role: opts.pastRoles[(i + 2) % opts.pastRoles.length],
                  },
                ]
              : []),
          ];
    return {
      id,
      name,
      grade,
      role,
      birthday,
      birthDate: `${birthday}/${opts.birthYears[0] + ((i * 5) % (span + 1))}`,
      since: `${String(((i * 7) % 27) + 1).padStart(2, "0")}/${String(((i * 5) % 12) + 1).padStart(2, "0")}/${sinceYear}`,
      regNo: `${opts.prefix}-${opts.number}-${String(idx * 37).padStart(4, "0")}`,
      phone: `(51) 9.0000-${String(100 + idx).padStart(4, "0")}`,
      email: `${parts[0]}.${parts.at(-1)}@example.com`,
      status: licensed ? "Licenciado" : "Ativo",
      history,
      attendance: licensed ? 35 : 62 + ((i * 13) % 37),
    };
  });
}

function guestsFrom(names: string[], ticketIds: string[], productIds: string[]): Guest[] {
  return names.map((name, i) => {
    const checkedIn = i < 9;
    const items: TabItem[] = checkedIn
      ? [
          {
            id: `g${i}a`,
            productId: productIds[i % productIds.length],
            qty: 1 + (i % 3),
            paid: i % 2 === 0,
          },
          ...(i % 3 === 0
            ? [
                {
                  id: `g${i}b`,
                  productId: productIds[(i + 2) % productIds.length],
                  qty: 2,
                  paid: false,
                },
              ]
            : []),
        ]
      : [];
    return {
      id: `g${String(i + 1).padStart(2, "0")}`,
      name,
      ticket: ticketIds[i % ticketIds.length],
      ticketPaid: i !== 10 && i !== 11,
      checkedIn,
      items,
    };
  });
}

const GUEST_NAMES = [
  "Ana Paula Ribeiro",
  "Cláudia Martins Rocha",
  "Roberto Gomes Lima",
  "Patrícia Souza Leal",
  "Marcos Vinícius Prado",
  "Fernanda Rocha Melo",
  "Luciana Teixeira Paz",
  "Rogério Almeida Cruz",
  "Simone Barbosa Reis",
  "Tiago Nogueira Sá",
  "Vanessa Cardoso Luz",
  "Wellington Faria Gil",
];

/* ------------------------------------------------------------------ */
/* Capítulo DeMolay                                                    */
/* ------------------------------------------------------------------ */

const odmMembers = buildMembers(
  [
    ["Arthur Lima Moreira", "DeMolay", "Primeiro Conselheiro", "04/03"],
    ["Bernardo Costa Ramos", "DeMolay", "Segundo Conselheiro", "18/07"],
    ["Caio Henrique Duarte", "DeMolay", "Escrivão", "29/11"],
    ["Daniel Rocha Teixeira", "DeMolay", "Tesoureiro", "12/01"],
    ["Eduardo Nunes Prado", "Iniciático", null, "25/11"],
    ["Felipe Andrade Souza", "DeMolay", "Mestre de Cerimônias", "09/05"],
    ["Gabriel Pires Mendes", "DeMolay", null, "02/11"],
    ["Gustavo Reis Carvalho", "Sênior", null, "21/08", true],
    ["Henrique Barros Lopes", "DeMolay", "Capelão", "30/09"],
    ["Igor Campos Vieira", "Iniciático", null, "14/02"],
    ["João Pedro Almeida", "DeMolay", "Mestre Conselheiro", "06/06"],
    ["Leonardo Farias Cunha", "DeMolay", "Hospitaleiro", "17/11"],
    ["Matheus Silveira Dias", "DeMolay", null, "11/12"],
    ["Nicolas Fontes Araújo", "Iniciático", null, "23/04"],
    ["Pedro Henrique Lacerda", "DeMolay", "Orador", "08/10"],
    ["Rafael Moura Brandão", "Sênior", null, "27/11"],
  ],
  {
    prefix: "ODM",
    number: "1000",
    birthYears: [2006, 2012],
    sinceYears: [2021, 2025],
    pastRoles: ["Diácono", "Mordomo", "Sentinela", "Porta-Estandarte", "Escrivão", "Tesoureiro"],
  },
);

const ODM: DemoOrg = {
  kind: "odm",
  viewAs: "Capítulo DeMolay",
  orgType: "Capítulo",
  name: "Capítulo Exemplo",
  short: "Capítulo Exemplo nº 1000",
  number: "1000",
  city: "Cidade Exemplo, RS",
  emblem: "/esferas/odm.webp",
  memberWord: { one: "membro", many: "membros", candidate: "Candidato" },
  grades: ["Iniciático", "DeMolay", "Sênior"],
  seniorGrade: "Sênior",
  user: { memberId: "m11", role: "Mestre Conselheiro" },
  members: odmMembers,
  dueValue: 20,
  cash: [
    {
      id: "c01",
      date: "21/11",
      desc: "Mensalidades de novembro",
      category: "Mensalidades",
      type: "in",
      value: 100,
    },
    {
      id: "c02",
      date: "20/11",
      desc: "Compra de velas e incenso",
      category: "Materiais",
      type: "out",
      value: 86.4,
    },
    {
      id: "c03",
      date: "18/11",
      desc: "Venda de rifas: sorteio de Natal",
      category: "Rifas",
      type: "in",
      value: 340,
    },
    {
      id: "c04",
      date: "15/11",
      desc: "Doação de cestas básicas",
      category: "Filantropia",
      type: "out",
      value: 412.9,
    },
    {
      id: "c05",
      date: "12/11",
      desc: "Doação de um Tio Maçom",
      category: "Doações",
      type: "in",
      value: 250,
    },
    {
      id: "c06",
      date: "09/11",
      desc: "Taxa anual do Supremo Conselho",
      category: "Taxas",
      type: "out",
      value: 180,
    },
    {
      id: "c07",
      date: "07/11",
      desc: "Ingressos do jantar de iniciação",
      category: "Eventos",
      type: "in",
      value: 960,
    },
    {
      id: "c08",
      date: "07/11",
      desc: "Buffet do jantar de iniciação",
      category: "Eventos",
      type: "out",
      value: 720,
    },
    {
      id: "c09",
      date: "03/11",
      desc: "Conserto do altar",
      category: "Manutenção",
      type: "out",
      value: 95,
    },
  ],
  yearBefore: { in: 14820.35, out: 12960.1, opening: 3240.8 },
  cashIn: ["Mensalidades", "Eventos", "Doações", "Rifas"],
  cashOut: ["Materiais", "Eventos", "Filantropia", "Taxas", "Manutenção"],
  events: [
    {
      id: "e1",
      day: 2,
      time: "19:30",
      title: "Reunião de diretoria",
      type: "Administrativa",
      place: "Sede do Capítulo",
    },
    {
      id: "e2",
      day: 7,
      time: "13:30",
      title: "Sessão de iniciação",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e3",
      day: 7,
      time: "20:00",
      title: "Jantar de iniciação",
      type: "Social",
      place: "Salão de festas",
    },
    {
      id: "e4",
      day: 14,
      time: "09:00",
      title: "Arrecadação de alimentos",
      type: "Filantropia",
      place: "Praça Central",
    },
    {
      id: "e5",
      day: 16,
      time: "19:30",
      title: "Reunião de diretoria",
      type: "Administrativa",
      place: "Sede do Capítulo",
    },
    {
      id: "e6",
      day: 21,
      time: "15:00",
      title: "Visita ao lar de idosos",
      type: "Filantropia",
      place: "Lar Exemplo",
    },
    {
      id: "e7",
      day: 28,
      time: "19:30",
      title: "Sessão magna",
      type: "Obrigatória",
      place: "Templo da Loja Exemplo",
    },
  ],
  sessionDay: 28,
  mandatory: "Sessão magna até 30/11 · Ação de filantropia até 12/12 · Iniciação até 12/12",
  minutesWord: "Ata",
  minutes: [
    { id: "a1", title: "Ata da sessão de iniciação", date: "07/11/2026", status: "Em revisão" },
    { id: "a2", title: "Ata da reunião de diretoria", date: "02/11/2026", status: "Aprovada" },
  ],
  social: {
    title: "Jantar de Natal do Capítulo",
    date: "Sábado, 12/12/2026 · 20:00",
    place: "Salão de festas da Loja Exemplo",
    tickets: [
      { id: "t1", label: "Inteiro", price: 60 },
      { id: "t2", label: "DeMolay", price: 30 },
      { id: "t3", label: "Criança", price: 20 },
    ],
    products: [
      { id: "p1", label: "Refrigerante lata", price: 6, stock: 48 },
      { id: "p2", label: "Água mineral", price: 4, stock: 36 },
      { id: "p3", label: "Rifa de Natal", price: 2, stock: 200 },
      { id: "p4", label: "Doce caseiro", price: 5, stock: 40 },
    ],
    guests: guestsFrom(
      ["João Pedro Almeida", "Arthur Lima Moreira", ...GUEST_NAMES.slice(0, 10)],
      ["t1", "t2", "t1", "t3"],
      ["p1", "p2", "p3", "p4"],
    ),
  },
  investigations: [
    {
      id: "s1",
      candidate: "Vinícius Prates Moreira",
      candidateInfo: "Candidato à iniciação · 14 anos · indicado em 20/10/2026",
      sponsorId: "m06",
      opened: "22/10/2026",
      deadline: "05/12/2026",
      status: "Em andamento",
      result: null,
      investigators: [
        { memberId: "m11", verdict: null, answers: [], answeredAt: null },
        {
          memberId: "m01",
          verdict: "F",
          answers: [
            "Conheço há dois anos, estudamos na mesma escola.",
            "Sim. A família apoia e conhece a Ordem.",
            "Sim, já participou de duas ações de filantropia.",
          ],
          answeredAt: "02/11/2026",
        },
        {
          memberId: "m15",
          verdict: "F",
          answers: [
            "Conheci na visita à família.",
            "Sim, os pais autorizaram e vão acompanhar.",
            "Sim, fez muitas perguntas sobre os princípios.",
          ],
          answeredAt: "09/11/2026",
        },
      ],
    },
    {
      id: "s2",
      candidate: "Lucas Andrade Bastos",
      candidateInfo: "Candidato à iniciação · 13 anos · indicado em 01/09/2026",
      sponsorId: "m02",
      opened: "03/09/2026",
      deadline: "10/10/2026",
      status: "Concluída",
      result: "Favorável",
      investigators: [
        {
          memberId: "m03",
          verdict: "F",
          answers: ["Há um ano.", "Sim.", "Sim."],
          answeredAt: "20/09/2026",
        },
        {
          memberId: "m09",
          verdict: "F",
          answers: ["Na visita.", "Sim.", "Sim."],
          answeredAt: "25/09/2026",
        },
        {
          memberId: "m12",
          verdict: "F",
          answers: ["Há três meses.", "Sim.", "Sim."],
          answeredAt: "01/10/2026",
        },
      ],
    },
  ],
  questions: [
    "Há quanto tempo conhece o candidato e de onde?",
    "A família conhece a Ordem e apoia o ingresso?",
    "O candidato demonstra interesse genuíno nos princípios da Ordem?",
  ],
};

/* ------------------------------------------------------------------ */
/* Bethel das Filhas de Jó                                             */
/* ------------------------------------------------------------------ */

const fdjMembers = buildMembers(
  [
    ["Alice Moreira Lima", "Filha de Jó", "Primeira Princesa", "04/03"],
    ["Beatriz Costa Ramos", "Filha de Jó", "Segunda Princesa", "18/07"],
    ["Carolina Duarte Neves", "Filha de Jó", "Secretária", "29/11"],
    ["Débora Rocha Teixeira", "Filha de Jó", "Tesoureira", "12/01"],
    ["Eduarda Nunes Prado", "Filha de Jó", null, "25/11"],
    ["Fernanda Andrade Souza", "Filha de Jó", "Guia", "09/05"],
    ["Gabriela Pires Mendes", "Filha de Jó", null, "02/11"],
    ["Helena Reis Carvalho", "Maioridade", null, "21/08", true],
    ["Isabela Barros Lopes", "Filha de Jó", "Capelã", "30/09"],
    ["Júlia Campos Vieira", "Filha de Jó", null, "14/02"],
    ["Laura Almeida Fontes", "Filha de Jó", "Honorável Rainha", "06/06"],
    ["Larissa Farias Cunha", "Filha de Jó", "Dirigente de Cerimônias", "17/11"],
    ["Manuela Silveira Dias", "Filha de Jó", null, "11/12"],
    ["Natália Fontes Araújo", "Filha de Jó", null, "23/04"],
    ["Rafaela Moura Brandão", "Filha de Jó", "Bibliotecária", "08/10"],
    ["Sofia Lacerda Pinto", "Maioridade", null, "27/11"],
  ],
  {
    prefix: "FDJ",
    number: "100",
    birthYears: [2006, 2014],
    sinceYears: [2021, 2025],
    pastRoles: [
      "Mensageira",
      "Musicista",
      "Guarda Interna",
      "Guarda Externa",
      "Secretária",
      "Tesoureira",
    ],
  },
);

const FDJ: DemoOrg = {
  kind: "fdj",
  viewAs: "Bethel (Filhas de Jó)",
  orgType: "Bethel",
  name: "Bethel Exemplo",
  short: "Bethel Exemplo nº 100",
  number: "100",
  city: "Cidade Exemplo, RS",
  emblem: "/esferas/fdj.webp",
  memberWord: { one: "membro", many: "membros", candidate: "Candidata" },
  grades: ["Filha de Jó", "Maioridade"],
  seniorGrade: "Maioridade",
  user: { memberId: "m11", role: "Honorável Rainha" },
  members: fdjMembers,
  dueValue: 20,
  cash: [
    {
      id: "c01",
      date: "21/11",
      desc: "Mensalidades de novembro",
      category: "Mensalidades",
      type: "in",
      value: 120,
    },
    {
      id: "c02",
      date: "19/11",
      desc: "Flores para a sessão",
      category: "Materiais",
      type: "out",
      value: 64.5,
    },
    {
      id: "c03",
      date: "16/11",
      desc: "Venda de bolos no bazar",
      category: "Eventos",
      type: "in",
      value: 410,
    },
    {
      id: "c04",
      date: "14/11",
      desc: "Kits de higiene para abrigo",
      category: "Filantropia",
      type: "out",
      value: 298.7,
    },
    {
      id: "c05",
      date: "12/11",
      desc: "Doação do Conselho Guardião",
      category: "Doações",
      type: "in",
      value: 300,
    },
    {
      id: "c06",
      date: "10/11",
      desc: "Taxa anual do Grande Bethel",
      category: "Taxas",
      type: "out",
      value: 150,
    },
    {
      id: "c07",
      date: "08/11",
      desc: "Ingressos do chá da tarde",
      category: "Eventos",
      type: "in",
      value: 720,
    },
    {
      id: "c08",
      date: "08/11",
      desc: "Lanches do chá da tarde",
      category: "Eventos",
      type: "out",
      value: 380,
    },
    {
      id: "c09",
      date: "04/11",
      desc: "Lavagem das capas",
      category: "Manutenção",
      type: "out",
      value: 120,
    },
  ],
  yearBefore: { in: 12650.2, out: 11140.6, opening: 2810.4 },
  cashIn: ["Mensalidades", "Eventos", "Doações", "Bazar"],
  cashOut: ["Materiais", "Eventos", "Filantropia", "Taxas", "Manutenção"],
  events: [
    {
      id: "e1",
      day: 3,
      time: "19:30",
      title: "Reunião do Conselho Guardião",
      type: "Administrativa",
      place: "Sede do Bethel",
    },
    {
      id: "e2",
      day: 8,
      time: "15:00",
      title: "Chá da tarde",
      type: "Social",
      place: "Salão de festas",
    },
    {
      id: "e3",
      day: 10,
      time: "19:30",
      title: "Sessão ritualística",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e4",
      day: 14,
      time: "09:00",
      title: "Entrega de kits no abrigo",
      type: "Filantropia",
      place: "Abrigo Exemplo",
    },
    {
      id: "e5",
      day: 17,
      time: "19:30",
      title: "Ensaio de instalação",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e6",
      day: 21,
      time: "14:00",
      title: "Bazar beneficente",
      type: "Filantropia",
      place: "Praça Central",
    },
    {
      id: "e7",
      day: 28,
      time: "18:00",
      title: "Sessão de iniciação",
      type: "Obrigatória",
      place: "Templo da Loja Exemplo",
    },
  ],
  sessionDay: 28,
  mandatory: "Iniciação até 30/11 · Sessão de instalação até 19/12 · Ação de filantropia até 12/12",
  minutesWord: "Ata",
  minutes: [
    { id: "a1", title: "Ata da sessão ritualística", date: "10/11/2026", status: "Em revisão" },
    {
      id: "a2",
      title: "Ata da reunião do Conselho Guardião",
      date: "03/11/2026",
      status: "Aprovada",
    },
  ],
  social: {
    title: "Chá beneficente de Natal",
    date: "Domingo, 13/12/2026 · 15:00",
    place: "Salão de festas da Loja Exemplo",
    tickets: [
      { id: "t1", label: "Inteiro", price: 45 },
      { id: "t2", label: "Filha de Jó", price: 25 },
      { id: "t3", label: "Criança", price: 15 },
    ],
    products: [
      { id: "p1", label: "Fatia de torta", price: 9, stock: 40 },
      { id: "p2", label: "Suco natural", price: 7, stock: 30 },
      { id: "p3", label: "Rifa beneficente", price: 3, stock: 200 },
      { id: "p4", label: "Pote de geleia", price: 15, stock: 20 },
    ],
    guests: guestsFrom(
      ["Laura Almeida Fontes", "Alice Moreira Lima", ...GUEST_NAMES.slice(0, 10)],
      ["t1", "t2", "t1", "t3"],
      ["p1", "p2", "p3", "p4"],
    ),
  },
  investigations: [
    {
      id: "s1",
      candidate: "Mariana Lopes Viana",
      candidateInfo: "Candidata à iniciação · 12 anos · indicada em 18/10/2026",
      sponsorId: "m06",
      opened: "20/10/2026",
      deadline: "04/12/2026",
      status: "Em andamento",
      result: null,
      investigators: [
        { memberId: "m11", verdict: null, answers: [], answeredAt: null },
        {
          memberId: "m01",
          verdict: "F",
          answers: [
            "Somos vizinhas há três anos.",
            "Sim, a mãe já foi Filha de Jó.",
            "Sim, perguntou muito sobre o Livro de Jó.",
          ],
          answeredAt: "30/10/2026",
        },
        { memberId: "m09", verdict: null, answers: [], answeredAt: null },
      ],
    },
    {
      id: "s2",
      candidate: "Valentina Rocha Prates",
      candidateInfo: "Candidata à iniciação · 11 anos · indicada em 25/08/2026",
      sponsorId: "m03",
      opened: "27/08/2026",
      deadline: "30/09/2026",
      status: "Concluída",
      result: "Favorável",
      investigators: [
        {
          memberId: "m02",
          verdict: "F",
          answers: ["Há dois anos.", "Sim.", "Sim."],
          answeredAt: "10/09/2026",
        },
        {
          memberId: "m06",
          verdict: "F",
          answers: ["Na visita.", "Sim.", "Sim."],
          answeredAt: "15/09/2026",
        },
        {
          memberId: "m12",
          verdict: "F",
          answers: ["Há um ano.", "Sim.", "Sim."],
          answeredAt: "20/09/2026",
        },
      ],
    },
  ],
  questions: [
    "Há quanto tempo conhece a candidata e de onde?",
    "A família conhece o Bethel e apoia o ingresso?",
    "A candidata demonstra interesse genuíno nos ensinamentos da Ordem?",
  ],
};

/* ------------------------------------------------------------------ */
/* Loja Maçônica                                                       */
/* ------------------------------------------------------------------ */

const lojaMembers = buildMembers(
  [
    ["Antônio Carlos Ribeiro", "Mestre", "Primeiro Vigilante", "04/03"],
    ["Carlos Eduardo Martins", "Mestre", "Segundo Vigilante", "18/07"],
    ["Fernando Luiz Bastos", "Mestre", "Secretário", "29/11"],
    ["Jorge Henrique Prates", "Mestre", "Tesoureiro", "12/01"],
    ["José Roberto Siqueira", "Aprendiz", null, "25/11"],
    ["Luiz Fernando Tavares", "Mestre", "Mestre de Cerimônias", "09/05"],
    ["Marcelo Augusto Brito", "Companheiro", null, "02/11"],
    ["Mário Sérgio Pacheco", "Mestre", null, "21/08", true],
    ["Paulo César Nogueira", "Mestre", "Chanceler", "30/09"],
    ["Cláudio Roberto Dantas", "Aprendiz", null, "14/02"],
    ["Ricardo Alves Monteiro", "Mestre", "Venerável Mestre", "06/06"],
    ["Roberto Carlos Fagundes", "Mestre", "Hospitaleiro", "17/11"],
    ["Sérgio Luís Coutinho", "Companheiro", null, "11/12"],
    ["Valter José Rezende", "Aprendiz", null, "23/04"],
    ["Wagner Luís Batista", "Mestre", "Orador", "08/10"],
    ["Eduardo Henrique Salles", "Mestre", null, "27/11"],
  ],
  {
    prefix: "LOJA",
    number: "1000",
    birthYears: [1958, 1992],
    sinceYears: [2008, 2025],
    pastRoles: [
      "Experto",
      "Cobridor",
      "Arquiteto",
      "Mestre de Banquetes",
      "Secretário Adjunto",
      "Tesoureiro Adjunto",
    ],
  },
);

const LOJA: DemoOrg = {
  kind: "loja",
  viewAs: "Loja Maçônica",
  orgType: "Loja",
  name: "Loja Exemplo",
  short: "Loja Exemplo nº 1000",
  number: "1000",
  city: "Cidade Exemplo, RS",
  emblem: "/esferas/loja.webp",
  memberWord: { one: "irmão", many: "irmãos", candidate: "Candidato" },
  grades: ["Aprendiz", "Companheiro", "Mestre"],
  seniorGrade: null,
  user: { memberId: "m11", role: "Venerável Mestre" },
  members: lojaMembers,
  dueValue: 150,
  cash: [
    {
      id: "c01",
      date: "20/11",
      desc: "Mensalidades de novembro",
      category: "Mensalidades",
      type: "in",
      value: 1650,
    },
    {
      id: "c02",
      date: "19/11",
      desc: "Conta de energia do templo",
      category: "Manutenção",
      type: "out",
      value: 412.37,
    },
    {
      id: "c03",
      date: "17/11",
      desc: "Tronco de beneficência",
      category: "Beneficência",
      type: "in",
      value: 386,
    },
    {
      id: "c04",
      date: "15/11",
      desc: "Auxílio a viúva de irmão",
      category: "Beneficência",
      type: "out",
      value: 600,
    },
    {
      id: "c05",
      date: "12/11",
      desc: "Jóia de iniciação",
      category: "Iniciações",
      type: "in",
      value: 1200,
    },
    {
      id: "c06",
      date: "10/11",
      desc: "Capitação à Grande Loja",
      category: "Taxas",
      type: "out",
      value: 1480,
    },
    {
      id: "c07",
      date: "06/11",
      desc: "Adesões ao ágape",
      category: "Ágapes",
      type: "in",
      value: 1350,
    },
    {
      id: "c08",
      date: "06/11",
      desc: "Buffet do ágape",
      category: "Ágapes",
      type: "out",
      value: 1120,
    },
    {
      id: "c09",
      date: "02/11",
      desc: "Reforma das cadeiras do Oriente",
      category: "Manutenção",
      type: "out",
      value: 890,
    },
  ],
  yearBefore: { in: 98450.6, out: 91230.15, opening: 24870.9 },
  cashIn: ["Mensalidades", "Iniciações", "Beneficência", "Ágapes"],
  cashOut: ["Manutenção", "Beneficência", "Taxas", "Ágapes", "Materiais"],
  events: [
    {
      id: "e1",
      day: 4,
      time: "20:00",
      title: "Sessão ordinária",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e2",
      day: 6,
      time: "20:30",
      title: "Ágape fraternal",
      type: "Social",
      place: "Salão de banquetes",
    },
    {
      id: "e3",
      day: 11,
      time: "20:00",
      title: "Sessão de instrução",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e4",
      day: 14,
      time: "10:00",
      title: "Entrega de cestas",
      type: "Filantropia",
      place: "Asilo Exemplo",
    },
    {
      id: "e5",
      day: 18,
      time: "20:00",
      title: "Sessão ordinária",
      type: "Ritualística",
      place: "Templo da Loja Exemplo",
    },
    {
      id: "e6",
      day: 21,
      time: "19:00",
      title: "Reunião de administração",
      type: "Administrativa",
      place: "Sala da Secretaria",
    },
    {
      id: "e7",
      day: 25,
      time: "20:00",
      title: "Sessão magna de iniciação",
      type: "Obrigatória",
      place: "Templo da Loja Exemplo",
    },
  ],
  sessionDay: 25,
  mandatory: "Eleição da administração até 15/12 · Prestação de contas até 30/12",
  minutesWord: "Balaústre",
  minutes: [
    { id: "a1", title: "Balaústre da sessão ordinária", date: "18/11/2026", status: "Em revisão" },
    { id: "a2", title: "Balaústre da sessão de instrução", date: "11/11/2026", status: "Aprovado" },
  ],
  social: {
    title: "Jantar de confraternização",
    date: "Sexta, 18/12/2026 · 20:30",
    place: "Salão de banquetes da Loja Exemplo",
    tickets: [
      { id: "t1", label: "Irmão", price: 90 },
      { id: "t2", label: "Cunhada", price: 90 },
      { id: "t3", label: "Sobrinho", price: 45 },
    ],
    products: [
      { id: "p1", label: "Refrigerante", price: 7, stock: 60 },
      { id: "p2", label: "Água mineral", price: 5, stock: 48 },
      { id: "p3", label: "Rifa do tronco", price: 10, stock: 100 },
      { id: "p4", label: "Sobremesa especial", price: 18, stock: 30 },
    ],
    guests: guestsFrom(
      ["Ricardo Alves Monteiro", "Antônio Carlos Ribeiro", ...GUEST_NAMES.slice(0, 10)],
      ["t1", "t2", "t1", "t3"],
      ["p1", "p2", "p3", "p4"],
    ),
  },
  investigations: [
    {
      id: "s1",
      candidate: "Alexandre Ramos Fontoura",
      candidateInfo: "Candidato à iniciação · 38 anos · engenheiro · proposto em 14/10/2026",
      sponsorId: "m06",
      opened: "16/10/2026",
      deadline: "03/12/2026",
      status: "Em andamento",
      result: null,
      investigators: [
        { memberId: "m11", verdict: null, answers: [], answeredAt: null },
        {
          memberId: "m01",
          verdict: "F",
          answers: [
            "Conheço há dez anos, somos colegas de profissão.",
            "Sim, a esposa está de acordo.",
            "Sim, tem conduta reta e reputação ilibada.",
          ],
          answeredAt: "28/10/2026",
        },
        {
          memberId: "m15",
          verdict: "F",
          answers: [
            "Conheci na visita à residência.",
            "Sim.",
            "Sim, demonstra vontade de aprender.",
          ],
          answeredAt: "05/11/2026",
        },
      ],
    },
    {
      id: "s2",
      candidate: "Henrique Dias Valença",
      candidateInfo: "Candidato à filiação · 45 anos · vindo de outra Loja",
      sponsorId: "m03",
      opened: "01/09/2026",
      deadline: "06/10/2026",
      status: "Concluída",
      result: "Favorável",
      investigators: [
        {
          memberId: "m02",
          verdict: "F",
          answers: ["Há cinco anos.", "Sim.", "Sim."],
          answeredAt: "15/09/2026",
        },
        {
          memberId: "m09",
          verdict: "F",
          answers: ["Há dois anos.", "Sim.", "Sim."],
          answeredAt: "20/09/2026",
        },
        {
          memberId: "m12",
          verdict: "F",
          answers: ["Na visita.", "Sim.", "Sim."],
          answeredAt: "29/09/2026",
        },
      ],
    },
  ],
  questions: [
    "Há quanto tempo conhece o candidato e de onde?",
    "A família está de acordo com o ingresso na Ordem?",
    "O candidato tem conduta e reputação compatíveis com a Ordem?",
  ],
};

export const ORGS: Record<OrgKind, DemoOrg> = { odm: ODM, fdj: FDJ, loja: LOJA };

/* ------------------------------------------------------------------ */
/* Mensalidades                                                        */
/* ------------------------------------------------------------------ */

export type DueStatus = "P" | "A" | "T" | "I" | "-";

export const DUE_META: Record<DueStatus, { label: string; short: string; bg: string; fg: string }> =
  {
    P: { label: "Pago", short: "P", bg: "#DDF0E5", fg: "#155A38" },
    A: { label: "Em aberto", short: "E", bg: "#FFF6D6", fg: "#6E5100" },
    T: { label: "Atrasado", short: "A", bg: "#FBE3C8", fg: "#7E3F00" },
    I: { label: "Isento", short: "I", bg: "#E3EAF7", fg: "#2D4A80" },
    "-": { label: "Ainda não vence", short: "·", bg: "transparent", fg: "#8A8D93" },
  };

/** Gera a grade de mensalidades de forma determinística (sem aleatoriedade). */
export function initialDues(org: DemoOrg): Record<string, DueStatus[]> {
  const out: Record<string, DueStatus[]> = {};
  org.members.forEach((m, idx) => {
    const row: DueStatus[] = [];
    for (let month = 0; month < 12; month++) {
      if (month === 11) row.push("-");
      else if (org.seniorGrade && m.grade === org.seniorGrade) row.push("I");
      else if (month === 10) row.push(idx % 3 === 0 ? "P" : "A");
      else if (idx % 5 === 2 && month >= 7) row.push("T");
      else if (idx % 7 === 4 && month >= 9) row.push("T");
      else row.push("P");
    }
    out[m.id] = row;
  });
  return out;
}

export const EVENT_COLORS: Record<DemoEvent["type"], { bg: string; fg: string }> = {
  Ritualística: { bg: "#E7EEFA", fg: "#173E80" },
  Administrativa: { bg: "#EFEFEC", fg: "#3F4249" },
  Filantropia: { bg: "#EAF5EF", fg: "#155A38" },
  Social: { bg: "#EFE7F7", fg: "#4A2270" },
  Obrigatória: { bg: "#FBEDEC", fg: "#A1261B" },
};

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function memberById(org: DemoOrg, id: string) {
  return org.members.find((m) => m.id === id);
}
