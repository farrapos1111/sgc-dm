/**
 * Dados 100% fictícios do ambiente de demonstração (/demonstracao).
 * Nenhum nome, valor ou evento aqui corresponde a uma organização real.
 */

export const DEMO_ORG = {
  name: "Capítulo Exemplo",
  number: "1000",
  city: "Cidade Exemplo, RS",
};

export const DEMO_USER = {
  name: "João Pedro Almeida",
  role: "Mestre Conselheiro",
};

/** Data "de hoje" fixa, para a demonstração ficar sempre igual. */
export const DEMO_TODAY = new Date(2026, 10, 23);

export type DemoMember = {
  id: string;
  name: string;
  grade: "DeMolay" | "Iniciático" | "Sênior";
  role: string | null;
  birthday: string; // dd/mm
  phone: string;
  status: "Ativo" | "Licenciado";
};

export const DEMO_MEMBERS: DemoMember[] = [
  {
    id: "m01",
    name: "Arthur Lima Moreira",
    grade: "DeMolay",
    role: "Primeiro Conselheiro",
    birthday: "04/03",
    phone: "(51) 9.0000-0101",
    status: "Ativo",
  },
  {
    id: "m02",
    name: "Bernardo Costa Ramos",
    grade: "DeMolay",
    role: "Segundo Conselheiro",
    birthday: "18/07",
    phone: "(51) 9.0000-0102",
    status: "Ativo",
  },
  {
    id: "m03",
    name: "Caio Henrique Duarte",
    grade: "DeMolay",
    role: "Escrivão",
    birthday: "29/11",
    phone: "(51) 9.0000-0103",
    status: "Ativo",
  },
  {
    id: "m04",
    name: "Daniel Rocha Teixeira",
    grade: "DeMolay",
    role: "Tesoureiro",
    birthday: "12/01",
    phone: "(51) 9.0000-0104",
    status: "Ativo",
  },
  {
    id: "m05",
    name: "Eduardo Nunes Prado",
    grade: "Iniciático",
    role: null,
    birthday: "25/11",
    phone: "(51) 9.0000-0105",
    status: "Ativo",
  },
  {
    id: "m06",
    name: "Felipe Andrade Souza",
    grade: "DeMolay",
    role: "Mestre de Cerimônias",
    birthday: "09/05",
    phone: "(51) 9.0000-0106",
    status: "Ativo",
  },
  {
    id: "m07",
    name: "Gabriel Pires Mendes",
    grade: "DeMolay",
    role: null,
    birthday: "02/11",
    phone: "(51) 9.0000-0107",
    status: "Ativo",
  },
  {
    id: "m08",
    name: "Gustavo Reis Carvalho",
    grade: "Sênior",
    role: null,
    birthday: "21/08",
    phone: "(51) 9.0000-0108",
    status: "Licenciado",
  },
  {
    id: "m09",
    name: "Henrique Barros Lopes",
    grade: "DeMolay",
    role: "Capelão",
    birthday: "30/09",
    phone: "(51) 9.0000-0109",
    status: "Ativo",
  },
  {
    id: "m10",
    name: "Igor Campos Vieira",
    grade: "Iniciático",
    role: null,
    birthday: "14/02",
    phone: "(51) 9.0000-0110",
    status: "Ativo",
  },
  {
    id: "m11",
    name: "João Pedro Almeida",
    grade: "DeMolay",
    role: "Mestre Conselheiro",
    birthday: "06/06",
    phone: "(51) 9.0000-0111",
    status: "Ativo",
  },
  {
    id: "m12",
    name: "Leonardo Farias Cunha",
    grade: "DeMolay",
    role: "Hospitaleiro",
    birthday: "17/11",
    phone: "(51) 9.0000-0112",
    status: "Ativo",
  },
  {
    id: "m13",
    name: "Matheus Silveira Dias",
    grade: "DeMolay",
    role: null,
    birthday: "11/12",
    phone: "(51) 9.0000-0113",
    status: "Ativo",
  },
  {
    id: "m14",
    name: "Nicolas Fontes Araújo",
    grade: "Iniciático",
    role: null,
    birthday: "23/04",
    phone: "(51) 9.0000-0114",
    status: "Ativo",
  },
  {
    id: "m15",
    name: "Pedro Henrique Lacerda",
    grade: "DeMolay",
    role: "Orador",
    birthday: "08/10",
    phone: "(51) 9.0000-0115",
    status: "Ativo",
  },
  {
    id: "m16",
    name: "Rafael Moura Brandão",
    grade: "Sênior",
    role: null,
    birthday: "27/11",
    phone: "(51) 9.0000-0116",
    status: "Ativo",
  },
];

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

export type DueStatus = "P" | "A" | "T" | "I" | "-";

export const DUE_META: Record<DueStatus, { label: string; short: string; bg: string; fg: string }> =
  {
    P: { label: "Pago", short: "P", bg: "#DDF0E5", fg: "#155A38" },
    A: { label: "Em aberto", short: "E", bg: "#FFF6D6", fg: "#6E5100" },
    T: { label: "Atrasado", short: "A", bg: "#FBE3C8", fg: "#7E3F00" },
    I: { label: "Isento", short: "I", bg: "#E3EAF7", fg: "#2D4A80" },
    "-": { label: "Ainda não vence", short: "·", bg: "transparent", fg: "#8A8D93" },
  };

export const DUE_VALUE = 20;

/** Gera a grade de mensalidades de forma determinística (sem aleatoriedade). */
export function initialDues(): Record<string, DueStatus[]> {
  const out: Record<string, DueStatus[]> = {};
  DEMO_MEMBERS.forEach((m, idx) => {
    const row: DueStatus[] = [];
    for (let month = 0; month < 12; month++) {
      if (month === 11) row.push("-");
      else if (m.grade === "Sênior") row.push("I");
      else if (month === 10) row.push(idx % 3 === 0 ? "P" : "A");
      else if (idx % 5 === 2 && month >= 7) row.push("T");
      else if (idx % 7 === 4 && month >= 9) row.push("T");
      else row.push("P");
    }
    out[m.id] = row;
  });
  return out;
}

export type CashEntry = {
  id: string;
  date: string; // dd/mm
  desc: string;
  category: string;
  type: "in" | "out";
  value: number;
};

export const CASH_CATEGORIES_IN = ["Mensalidades", "Eventos", "Doações", "Rifas"];
export const CASH_CATEGORIES_OUT = ["Materiais", "Eventos", "Filantropia", "Taxas", "Manutenção"];

export const DEMO_CASH: CashEntry[] = [
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
];

/** Totais do ano antes de novembro (fictícios). */
export const CASH_YEAR_BEFORE = { in: 14820.35, out: 12960.1, opening: 3240.8 };

export type DemoEvent = {
  id: string;
  day: number; // novembro de 2026
  time: string;
  title: string;
  type: "Ritualística" | "Administrativa" | "Filantropia" | "Social" | "Obrigatória";
  place: string;
};

export const DEMO_EVENTS: DemoEvent[] = [
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
];

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
