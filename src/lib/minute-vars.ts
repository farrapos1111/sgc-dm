/** Resolução das variáveis dinâmicas entre colchetes nos modelos de ata. */

import { datePartsInAppTz, formatTimeInAppTz } from "@/lib/timezone";

export type MinuteVarContext = {
  chapterName?: string | null;
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

export function buildVarMap(ctx: MinuteVarContext): Record<string, string> {
  const start = ctx.date ? new Date(ctx.date) : new Date();
  const parts = datePartsInAppTz(start);
  const officers = ctx.officers ?? {};
  const capitulo = [
    ctx.chapterName,
    ctx.chapterCity ? `— ${ctx.chapterCity}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const horaInicio = new Date(start.getTime() + 30 * 60 * 1000);
  const horaFim = new Date(start.getTime() + (2 * 60 + 30) * 60 * 1000);

  return {
    dia: String(parts.day).padStart(2, "0"),
    mês: MESES[parts.month - 1],
    mes: MESES[parts.month - 1],
    "ano por extenso": anoPorExtenso(parts.year),
    ano: String(parts.year),
    "nome da loja/capítulo": capitulo || "[nome da loja/capítulo]",
    local: ctx.location || "[local]",
    Local: ctx.location || "[Local]",
    endereco: ctx.address || "[endereco]",
    endereço: ctx.address || "[endereço]",
    "endereço completo": ctx.address || ctx.location || "[endereço completo]",
    Membro_MC: officers.mestre_conselheiro ?? "[Membro_MC]",
    Membro_1C: officers.primeiro_conselheiro ?? "[Membro_1C]",
    Membro_2C: officers.segundo_conselheiro ?? "[Membro_2C]",
    Membro_Escrivao: officers.escrivao ?? "[Membro_Escrivao]",
    Membro_Tesoureiro: officers.tesoureiro ?? "[Membro_Tesoureiro]",
    Membro_Presidente: officers.presidente_conselho_consultivo ?? "[Membro_Presidente]",
    "nome do escrivão": officers.escrivao ?? "[nome do escrivão]",
    hora_inicio: formatTimeInAppTz(horaInicio),
    hora_fim: formatTimeInAppTz(horaFim),
  };
}

/** Substitui as variáveis conhecidas; as demais permanecem entre colchetes para preenchimento. */
export function applyVars(text: string, ctx: MinuteVarContext): string {
  const map = buildVarMap(ctx);
  return text.replace(/\[([^\]\n]+)\]/g, (full, key: string) => {
    const v = map[key.trim()];
    return v ?? full;
  });
}

/** Lista de variáveis disponíveis para exibição no editor. */
export const AVAILABLE_VARS = [
  "[dia]",
  "[mês]",
  "[ano por extenso]",
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
