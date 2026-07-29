/** Regras de elegibilidade e isenção de mensalidades. */

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
  /** Períodos de irregularidade (afastamento). */
  awayPeriods?: AwayPeriod[];
  /** Incluído manualmente neste calendário anual. */
  manualInclude?: boolean;
};

export type MonthAutoStatus = "em_aberto" | "isento" | "desligado";

function parseYmd(iso: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return {
    y: Number(iso.slice(0, 4)),
    m: Number(iso.slice(5, 7)),
    d: Number(iso.slice(8, 10)),
  };
}

/** Data em que completa 21 anos (aniversário). */
export function turns21On(birthDate: string | null | undefined): { y: number; m: number; d: number } | null {
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
export function initiationOn(m: DueMemberLite): { y: number; m: number; d: number } | null {
  return parseYmd(m.iniciacao_ordem) ?? parseYmd(m.exam_grau_iniciatico ?? null);
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
 * Status automático do mês (antes de qualquer pagamento manual):
 * - Janeiro e dezembro → isento (padrão do capítulo)
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
  if (month === 1 || month === 12) {
    return "isento";
  }

  if (monthInAwayPeriod(year, month, m.awayPeriods)) {
    return "desligado";
  }
  // Irregular ainda sem período registrado: não cobra mensalidade
  if (m.status === "irregular" && !(m.awayPeriods && m.awayPeriods.length > 0)) {
    return "desligado";
  }

  const t21 = turns21On(m.birth_date);
  if (t21 && cmpYm(year, month, t21.y, t21.m) >= 0) {
    return "isento";
  }

  const init = initiationOn(m);
  if (init && cmpYm(year, month, init.y, init.m) <= 0) {
    return "isento";
  }

  return "em_aberto";
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
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return t >= dueDay;
}

export const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const MONTH_LONG = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
