import { currentYearMonthInAppTz } from "@/lib/timezone";

export type Term = { year: number; semester: 1 | 2 };

export function currentTerm(now = new Date()): Term {
  const { year, month } = currentYearMonthInAppTz(now);
  return { year, semester: month <= 6 ? 1 : 2 };
}

export function termLabel(year: number, semester: number): string {
  return `${semester}º semestre de ${year}`;
}

/** Código curto: 2022/01 (1º) ou 2022/02 (2º). */
export function termCode(year: number, semester: number): string {
  return `${year}/${String(semester).padStart(2, "0")}`;
}

export function termKey(t: Term): string {
  return `${t.year}-${t.semester}`;
}

export function parseTermKey(key: string): Term | null {
  const [y, s] = key.split("-");
  const year = Number(y);
  const semester = Number(s);
  if (!Number.isFinite(year) || (semester !== 1 && semester !== 2)) return null;
  return { year, semester };
}

/** Busca por rótulo, ano ou código curto (ex.: 2022/01, 2022/1, 2022-01). */
export function matchesTermSearch(term: Term, search: string): boolean {
  const q = search.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return true;

  const label = termLabel(term.year, term.semester).toLowerCase().replace(/\s+/g, "");
  const code = termCode(term.year, term.semester).toLowerCase();
  const codeShort = `${term.year}/${term.semester}`;
  const dashed = `${term.year}-${String(term.semester).padStart(2, "0")}`;
  const dashedShort = `${term.year}-${term.semester}`;

  if (
    label.includes(q) ||
    code.includes(q) ||
    codeShort.includes(q) ||
    dashed.includes(q) ||
    dashedShort.includes(q) ||
    String(term.year).includes(q)
  ) {
    return true;
  }

  const m = q.match(/^(\d{4})[/\-.](\d{1,2})$/);
  if (m) {
    return Number(m[1]) === term.year && Number(m[2]) === term.semester;
  }

  return false;
}

/** Converte data local (YYYY-MM-DD) no semestre correspondente. */
export function termFromDate(input: string | Date): Term | null {
  const d =
    typeof input === "string"
      ? (() => {
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
          if (!m) return null;
          return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        })()
      : input;
  if (!d || Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), semester: d.getMonth() < 6 ? 1 : 2 };
}

export function compareTerms(a: Term, b: Term): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.semester - b.semester;
}

/** Lê a data de fundação salva em chapters.settings.founded_at. */
export function chapterFoundedAt(
  chapter?: { settings?: Record<string, unknown> | null } | null,
): string | null {
  const v = chapter?.settings?.founded_at;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * Lista vigências do semestre de fundação até o próximo ano civil.
 * Sem data de fundação, usa fallbackSpan anos atrás (padrão: 4).
 * Ordenadas do mais recente ao mais antigo.
 */
export function termOptions(opts?: {
  foundedAt?: string | null;
  /** Anos no futuro além do atual (default 1). */
  futureYears?: number;
  /** Anos no passado se não houver fundação (default 4). */
  fallbackSpan?: number;
}): Term[] {
  const current = currentTerm();
  const futureYears = opts?.futureYears ?? 1;
  const end: Term = { year: current.year + futureYears, semester: 2 };

  const fromFounded = opts?.foundedAt ? termFromDate(opts.foundedAt) : null;
  const start: Term = fromFounded ?? {
    year: current.year - (opts?.fallbackSpan ?? 4),
    semester: 1,
  };

  // Se a fundação for depois do fim da janela, devolve só o semestre atual.
  if (compareTerms(start, end) > 0) {
    return [current];
  }

  const out: Term[] = [];
  let y = end.year;
  let s: 1 | 2 = end.semester;
  while (compareTerms({ year: y, semester: s }, start) >= 0) {
    out.push({ year: y, semester: s });
    if (s === 2) {
      s = 1;
    } else {
      s = 2;
      y -= 1;
    }
  }
  return out;
}
