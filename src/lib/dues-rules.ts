/** Regras de elegibilidade e isenção de mensalidades. */

import { currentYearMonthInAppTz, datePartsInAppTz } from "@/lib/timezone";

export type AwayPeriod = {
  started_on: string;
  ended_on: string | null;
};

export type DueMemberLite = {
  id: string;
  full_name: string;
  status: string;
  kind: string;
  birth_date: string | null;
  iniciacao_ordem: string | null;
  /** Fallback de iniciação quando iniciacao_ordem está vazia. */
  exam_grau_iniciatico?: string | null;
  exam_grau_demolay?: string | null;
  /** Períodos de irregularidade (afastamento). */
  awayPeriods?: AwayPeriod[];
  /** Incluído manualmente neste calendário anual. */
  manualInclude?: boolean;
};

export type MonthAutoStatus = "em_aberto" | "isento" | "desligado";

function parseYmd(
  iso: string | null | undefined,
): { y: number; m: number; d: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return {
    y: Number(iso.slice(0, 4)),
    m: Number(iso.slice(5, 7)),
    d: Number(iso.slice(8, 10)),
  };
}

/** Data em que completa 21 anos (aniversário). */
export function turns21On(
  birthDate: string | null | undefined,
): { y: number; m: number; d: number } | null {
  const bd = parseYmd(birthDate);
  if (!bd) return null;
  return { y: bd.y + 21, m: bd.m, d: bd.d };
}

/** Compara (y,m) com (y2,m2): -1 se anterior, 0 igual, 1 posterior. */
function cmpYm(y: number, m: number, y2: number, m2: number) {
  if (y !== y2) return y < y2 ? -1 : 1;
  if (m !== m2) return m < m2 ? -1 : 1;
  return 0;
}

/** Compara datas Y-M-D: -1 se a < b, 0 igual, 1 se a > b. */
function cmpYmd(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
) {
  if (a.y !== b.y) return a.y < b.y ? -1 : 1;
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.d !== b.d) return a.d < b.d ? -1 : 1;
  return 0;
}

/**
 * Mês dentro de um período de afastamento:
 * inclui o mês de started_on; exclui o mês de ended_on (retorno = volta a contar).
 */
export function monthInAwayPeriod(
  year: number,
  month: number,
  periods: AwayPeriod[] | undefined,
): boolean {
  if (!periods?.length) return false;
  for (const p of periods) {
    const start = parseYmd(p.started_on);
    if (!start) continue;
    if (cmpYm(year, month, start.y, start.m) < 0) continue;
    if (!p.ended_on) return true;
    const end = parseYmd(p.ended_on);
    if (!end) return true;
    // Mês do retorno não é desligado
    if (cmpYm(year, month, end.y, end.m) < 0) return true;
  }
  return false;
}

/** Data de iniciação: iniciacao_ordem, ou exame do grau iniciático como fallback. */
export function initiationOn(
  m: DueMemberLite,
): { y: number; m: number; d: number } | null {
  return (
    parseYmd(m.iniciacao_ordem) ?? parseYmd(m.exam_grau_iniciatico ?? null)
  );
}

/**
 * Membro entra na tabela do ano se:
 * - Regular, Demolay Ativo ou Senior (não Maçom)
 * - Iniciação neste ano ou antes (se houver data; cadastro sem data ainda entra)
 * - Ainda não era Senior no início do ano (21º aniversário neste ano ou depois)
 *
 * Assim, quem iniciou em 2023 e virou Senior em 2025 aparece de 2023 até 2025
 * (com isenções nos meses corretos). Quem já era Senior antes do ano fica de fora.
 */
export function memberInYearTable(m: DueMemberLite, year: number): boolean {
  if (m.status !== "regular") return false;
  if (m.kind === "macom") return false;
  if (m.kind !== "demolay_ativo" && m.kind !== "senior") return false;

  const init = initiationOn(m);
  // Sem data: ainda entra (cadastro incompleto) — use Incluir membro se precisar forçar
  if (init && init.y > year) return false;

  const t21 = turns21On(m.birth_date);
  // Já tinha 21 anos antes deste ano → Senior desde o início → fora
  if (t21 && t21.y < year) return false;

  return true;
}

/**
 * Membro entra na chamada / frequência de um evento se:
 * - Regular, Demolay Ativo ou Senior (não Maçom)
 * - Data do evento ≥ iniciação (se houver data)
 * - Ainda não era Senior no início do ano do evento (21º aniversário neste ano ou depois)
 * - Se completa 21 no ano do evento: aparece até a data do aniversário (inclusive)
 */
export function memberEligibleForAttendance(
  m: DueMemberLite,
  eventDateIso: string,
): boolean {
  if (m.status !== "regular") return false;
  if (m.kind === "macom") return false;
  if (m.kind !== "demolay_ativo" && m.kind !== "senior") return false;

  // Prefixo ISO YYYY-MM-DD — evita fuso local (cliente vs servidor)
  const event = parseYmd(eventDateIso.slice(0, 10));
  if (!event) return false;

  const init = initiationOn(m);
  if (init && cmpYmd(event, init) < 0) return false;

  const t21 = turns21On(m.birth_date);
  if (t21) {
    // Já tinha 21 antes do ano do evento → Senior desde o início → fora
    if (t21.y < event.y) return false;
    // Depois do aniversário de 21 no ano → fora
    if (cmpYmd(event, t21) > 0) return false;
  }

  return true;
}

/**
 * Status automático do mês (antes de qualquer pagamento manual):
 * - Janeiro → isento (padrão do capítulo; dezembro é cobrado)
 * - Meses em período de irregularidade → desligado
 * - Meses a partir do aniversário de 21 no ano → isento
 * - Meses anteriores à iniciação e o mês da iniciação → isento
 * - Demais → em_aberto
 */
export function autoDueStatus(
  m: DueMemberLite,
  year: number,
  month: number,
): MonthAutoStatus {
  if (month === 1) {
    return "isento";
  }

  if (monthInAwayPeriod(year, month, m.awayPeriods)) {
    return "desligado";
  }
  // Irregular ainda sem período registrado: não cobra mensalidade
  if (
    m.status === "irregular" &&
    !(m.awayPeriods && m.awayPeriods.length > 0)
  ) {
    return "desligado";
  }

  const t21 = turns21On(m.birth_date);
  // Senior DeMolay: isento a partir do aniversário de 21 (sem data → isento no ano)
  if (m.kind === "senior") {
    if (!t21) return "isento";
    if (cmpYm(year, month, t21.y, t21.m) >= 0) return "isento";
  } else if (t21 && cmpYm(year, month, t21.y, t21.m) >= 0) {
    return "isento";
  }

  const init = initiationOn(m);
  if (init && cmpYm(year, month, init.y, init.m) <= 0) {
    return "isento";
  }

  return "em_aberto";
}

export type AutoExemptKind = "janeiro" | "senior" | "iniciacao";

/** Motivo automático de isenção (para tip), na mesma ordem de autoDueStatus. */
export function autoDueExemptKind(
  m: DueMemberLite,
  year: number,
  month: number,
): AutoExemptKind | null {
  if (month === 1) return "janeiro";

  const t21 = turns21On(m.birth_date);
  if (m.kind === "senior") {
    if (!t21) return "senior";
    if (cmpYm(year, month, t21.y, t21.m) >= 0) return "senior";
  } else if (t21 && cmpYm(year, month, t21.y, t21.m) >= 0) {
    return "senior";
  }

  const init = initiationOn(m);
  if (init && cmpYm(year, month, init.y, init.m) <= 0) return "iniciacao";

  return null;
}

/** Texto de tip no hover para isenção automática (Senior / iniciação / janeiro). */
export function autoDueExemptTip(
  m: DueMemberLite,
  year: number,
  month: number,
): string | null {
  const kind = autoDueExemptKind(m, year, month);
  if (kind === "senior") {
    return "Isento: a partir do aniversário de 21 anos (Senior).";
  }
  if (kind === "iniciacao") {
    return "Isento: mês da iniciação ou anterior à data de iniciação.";
  }
  if (kind === "janeiro") {
    return "Isento: janeiro (padrão do capítulo).";
  }
  return null;
}

/**
 * Cobrança atrasada a partir do dia 15 da competência
 * (e competências anteriores ainda em aberto).
 */
export function isDueOverdue(
  year: number,
  month: number,
  status: string,
  today: Date = new Date(),
): boolean {
  if (status !== "em_aberto") return false;
  const dueDay = new Date(year, month - 1, 15);
  const p = datePartsInAppTz(today);
  const t = new Date(p.year, p.month - 1, p.day);
  return t >= dueDay;
}

/** Competência ainda no futuro (mês civil corrente ou posterior). */
export function isFutureMonth(year: number, month: number, today = new Date()) {
  const { year: cy, month: cm } = currentYearMonthInAppTz(today);
  if (year > cy) return true;
  if (year < cy) return false;
  return month > cm;
}

/** Valor padrão de mensalidade em chapters.settings (fallback 50). */
export function getChapterDefaultDuesAmount(
  chapter?: { settings?: Record<string, unknown> | null } | null,
): number {
  const raw = chapter?.settings?.default_dues_amount;
  // null/undefined são inválidos (Number(null) === 0)
  if (raw == null) return 50;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 50;
}

export const MONTH_SHORT = [
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

export const MONTH_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
