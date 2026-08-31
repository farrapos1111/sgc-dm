/** Categorias fixas do fluxo de caixa e escopos com subcategorias dinâmicas. */
export const FIXED_CATEGORIES = [
  "Eventos",
  "Hospitalaria",
  "Mensalidades",
  "SCDB / GCE",
  "Entretenimento",
  "Outras",
] as const;

/**
 * Categorias que exigem subcategoria configurada pela comissão.
 * Hospitalaria fica como categoria padrão (sem subcategorias) enquanto não houver
 * tela da comissão.
 */
export const DYNAMIC_CATEGORIES = {
  Eventos: "eventos",
} as const;

export type DynamicScope = (typeof DYNAMIC_CATEGORIES)[keyof typeof DYNAMIC_CATEGORIES];

export function scopeOfCategory(category: string): DynamicScope | null {
  return (DYNAMIC_CATEGORIES as Record<string, DynamicScope>)[category] ?? null;
}

export const SCOPE_LABELS: Record<DynamicScope, string> = {
  eventos: "Comissão de Eventos",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function competenceLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]}/${year}`;
}

/** Competência curta no formato MM/AA (ex.: 03/26). */
export function competenceShortLabel(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
}

/** Descrição padronizada de mensalidade, inclusive em lançamentos manuais. */
export function duesDescription(
  memberName: string,
  competences: { year: number; month: number }[],
) {
  const labels = competences
    .map((c) => competenceShortLabel(c.year, c.month))
    .join(", ");
  return `Mensalidade - ${memberName} - ${labels}`;
}

/**
 * Lançamento no fluxo gerado por cobrança paga: "Nome do pagante - nome da cobrança",
 * sem repetir o nome se a descrição já o contém (ingressos, texto legado).
 */
export function chargeCashDescription(
  description: string,
  memberName: string | null | undefined,
): string {
  const desc = description.trim();
  const name = (memberName ?? "").trim();
  if (!desc) return name;
  if (!name) return desc;
  const descFold = desc.toLocaleLowerCase("pt-BR");
  const nameFold = name.toLocaleLowerCase("pt-BR");
  if (descFold.includes(nameFold)) return desc;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`.toLocaleLowerCase("pt-BR");
    if (descFold.includes(firstLast)) return desc;
    const firstTwo = `${parts[0]} ${parts[1]}`.toLocaleLowerCase("pt-BR");
    if (descFold.includes(firstTwo)) return desc;
  } else if (descFold.includes(nameFold)) {
    return desc;
  }
  return `${name} - ${desc}`;
}

function foldPt(s: string) {
  return s.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Um lançamento avulso/importado é o mesmo pagamento da cobrança
 * (evita duplicar no caixa ao baixar a cobrança).
 */
export function cashEntryMatchesCharge(opts: {
  cashDescription: string;
  cashAmount: number | string;
  chargeDescription: string;
  memberName: string | null | undefined;
  payAmount: number | string;
}): boolean {
  const cashCents = Math.round(Number(opts.cashAmount) * 100);
  const payCents = Math.round(Number(opts.payAmount) * 100);
  if (!Number.isFinite(cashCents) || cashCents !== payCents) return false;

  const cashFold = foldPt(opts.cashDescription);
  const descFold = foldPt(opts.chargeDescription);
  if (!cashFold || !descFold) return false;
  if (!cashFold.includes(descFold)) return false;

  const parts = (opts.memberName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const first = foldPt(parts[0]);
  if (first && !cashFold.includes(first)) return false;
  if (parts.length >= 2) {
    const last = foldPt(parts[parts.length - 1]);
    const second = foldPt(parts[1]);
    const lastOk = last.length >= 3 && cashFold.includes(last);
    const secondOk = second.length >= 3 && cashFold.includes(second);
    if (!lastOk && !secondOk) return false;
  }
  return true;
}
