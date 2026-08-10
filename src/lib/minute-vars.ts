/** Resolução das variáveis dinâmicas entre colchetes nos modelos de ata/ofício. */

import { datePartsInAppTz, formatTimeInAppTz, APP_TIMEZONE } from "@/lib/timezone";
import { matchesLooseSearch, normalizeSearch } from "@/lib/utils";

export type MinuteVarContext = {
  chapterName?: string | null;
  chapterNumber?: string | null;
  chapterCity?: string | null;
  date?: string | null; // ISO
  location?: string | null;
  address?: string | null;
  officers?: Record<string, string>;
};

const MESES = [
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

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];
const DEZ_A_DEZENOVE = [
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function abaixoDeMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push(CENTENAS[c]);
  if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
  else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) partes.push(DEZENAS[d]);
    if (u > 0) partes.push(UNIDADES[u]);
  }
  return partes.join(" e ");
}

/** Ano por extenso, ex.: 2026 → "dois mil e vinte e seis". */
export function anoPorExtenso(ano: number): string {
  const milhares = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const prefixo = milhares === 1 ? "mil" : `${UNIDADES[milhares]} mil`;
  if (resto === 0) return prefixo;
  const sufixo = abaixoDeMil(resto);
  const conector = resto < 100 || resto % 100 === 0 ? " e " : " ";
  return `${prefixo}${conector}${sufixo}`;
}

/** Normaliza chave de variável (minúsculas, sem acento). */
export function normalizeVarKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function weekdayNameInAppTz(d: Date): string {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(d);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return DIAS_SEMANA[idx >= 0 ? idx : 0] ?? "";
}

export function buildVarMap(ctx: MinuteVarContext): Record<string, string> {
  const start = ctx.date ? new Date(ctx.date) : new Date();
  const parts = datePartsInAppTz(start);
  const officers = ctx.officers ?? {};
  const capitulo = [
    ctx.chapterName,
    ctx.chapterNumber ? `Nº ${ctx.chapterNumber}` : null,
    ctx.chapterCity ? `— ${ctx.chapterCity}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const dataBr = `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
  const mesNome = MESES[parts.month - 1] ?? "";
  const horaInicio = new Date(start.getTime() + 30 * 60 * 1000);
  const horaFim = new Date(start.getTime() + (2 * 60 + 30) * 60 * 1000);

  const mc = officers.mestre_conselheiro ?? "";
  const c1 = officers.primeiro_conselheiro ?? "";
  const c2 = officers.segundo_conselheiro ?? "";
  const esc = officers.escrivao ?? "";
  const tes = officers.tesoureiro ?? "";
  const pcc = officers.presidente_conselho_consultivo ?? "";

  const entries: [string, string][] = [
    ["dia", pad2(parts.day)],
    ["mes", mesNome],
    ["mês", mesNome],
    ["ano", String(parts.year)],
    ["ano por extenso", anoPorExtenso(parts.year)],
    ["data", dataBr],
    ["dia da semana", weekdayNameInAppTz(start)],
    ["dia_semana", weekdayNameInAppTz(start)],
    ["nome da loja/capítulo", capitulo || "[nome da loja/capítulo]"],
    ["nome da loja/capitulo", capitulo || "[nome da loja/capitulo]"],
    ["capitulo", capitulo || "[capitulo]"],
    ["capítulo", capitulo || "[capítulo]"],
    ["nome do capítulo", capitulo || "[nome do capítulo]"],
    ["local", ctx.location || "[local]"],
    ["Local", ctx.location || "[Local]"],
    ["endereco", ctx.address || "[endereco]"],
    ["endereço", ctx.address || "[endereço]"],
    [
      "endereço completo",
      ctx.address || ctx.location || "[endereço completo]",
    ],
    ["endereco completo", ctx.address || ctx.location || "[endereco completo]"],
    ["Membro_MC", mc || "[Membro_MC]"],
    ["membro_mc", mc || "[membro_mc]"],
    ["Membro_1C", c1 || "[Membro_1C]"],
    ["Membro_2C", c2 || "[Membro_2C]"],
    ["Membro_Escrivao", esc || "[Membro_Escrivao]"],
    ["Membro_Escrivão", esc || "[Membro_Escrivão]"],
    ["Membro_Tesoureiro", tes || "[Membro_Tesoureiro]"],
    ["Membro_Presidente", pcc || "[Membro_Presidente]"],
    ["nome do escrivão", esc || "[nome do escrivão]"],
    ["nome do escrivao", esc || "[nome do escrivao]"],
    ["hora_inicio", formatTimeInAppTz(horaInicio)],
    ["hora_fim", formatTimeInAppTz(horaFim)],
  ];

  const map: Record<string, string> = {};
  for (const [k, v] of entries) {
    map[k] = v;
    map[normalizeVarKey(k)] = v;
  }
  return map;
}

/** Substitui as variáveis conhecidas; as demais permanecem entre colchetes para preenchimento. */
export function applyVars(text: string, ctx: MinuteVarContext): string {
  const map = buildVarMap(ctx);
  return text.replace(/\[([^\]\n]+)\]/g, (full, key: string) => {
    const raw = key.trim();
    const v = map[raw] ?? map[normalizeVarKey(raw)];
    return v ?? full;
  });
}

/** Lista de variáveis disponíveis para exibição no editor. */
export const AVAILABLE_VARS = [
  "[dia]",
  "[mês]",
  "[ano]",
  "[ano por extenso]",
  "[data]",
  "[dia da semana]",
  "[nome da loja/capítulo]",
  "[local]",
  "[endereco]",
  "[endereço completo]",
  "[Membro_MC]",
  "[Membro_1C]",
  "[Membro_2C]",
  "[Membro_Escrivao]",
  "[Membro_Tesoureiro]",
  "[Membro_Presidente]",
  "[hora_inicio]",
  "[hora_fim]",
];

export type MinuteVarMatch = {
  /** Índice do `[` aberto. */
  start: number;
  /** Texto após `[` até o cursor (sem `]`). */
  query: string;
};

/** Detecta variável dinâmica incompleta `[…` imediatamente antes do cursor. */
export function detectMinuteVar(textBeforeCursor: string): MinuteVarMatch | null {
  const open = textBeforeCursor.lastIndexOf("[");
  if (open < 0) return null;
  const after = textBeforeCursor.slice(open + 1);
  if (after.includes("]") || after.includes("\n")) return null;
  return { start: open, query: after };
}

/** Filtra tokens de variáveis pelo texto digitado após `[`. */
export function filterMinuteVars(
  query: string,
  tokens: readonly string[] = AVAILABLE_VARS,
): string[] {
  const q = normalizeSearch(query);
  if (!q) return [...tokens];
  return tokens.filter((token) => {
    const inner = token.slice(1, -1);
    return (
      matchesLooseSearch(inner, query) || matchesLooseSearch(token, query)
    );
  });
}

/** Substitui o `[query` aberto pela variável completa (com colchetes). */
export function applyMinuteVar(
  text: string,
  caret: number,
  match: MinuteVarMatch,
  token: string,
): { text: string; caret: number } {
  const next = text.slice(0, match.start) + token + text.slice(caret);
  return { text: next, caret: match.start + token.length };
}