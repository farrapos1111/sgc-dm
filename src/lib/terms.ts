export type Term = { year: number; semester: 1 | 2 };

export function currentTerm(): Term {
  const now = new Date();
  return { year: now.getFullYear(), semester: now.getMonth() < 6 ? 1 : 2 };
}

export function termLabel(year: number, semester: number): string {
  return `${semester}º semestre de ${year}`;
}

export function termOptions(span = 4): Term[] {
  const { year } = currentTerm();
  const out: Term[] = [];
  for (let y = year + 1; y >= year - span; y--) {
    out.push({ year: y, semester: 2 });
    out.push({ year: y, semester: 1 });
  }
  return out;
}
