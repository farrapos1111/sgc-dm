/** Categorias fixas do fluxo de caixa e escopos com subcategorias dinâmicas. */
export const FIXED_CATEGORIES = [
  "Eventos",
  "Hospitalaria",
  "Mensalidades",
  "SCDB / GCE",
  "Entretenimento",
  "Outras",
] as const;

export const DYNAMIC_CATEGORIES = {
  Eventos: "eventos",
  Hospitalaria: "hospitalaria",
} as const;

export type DynamicScope = (typeof DYNAMIC_CATEGORIES)[keyof typeof DYNAMIC_CATEGORIES];

export function scopeOfCategory(category: string): DynamicScope | null {
  return (DYNAMIC_CATEGORIES as Record<string, DynamicScope>)[category] ?? null;
}

export const SCOPE_LABELS: Record<DynamicScope, string> = {
  eventos: "Comissão de Eventos",
  hospitalaria: "Comissão de Hospitalaria",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function competenceLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]}/${year}`;
}

/** Descrição padronizada de mensalidade, inclusive em lançamentos manuais. */
export function duesDescription(
  memberName: string,
  competences: { year: number; month: number }[],
) {
  const labels = competences.map((c) => competenceLabel(c.year, c.month)).join(", ");
  return `Mensalidade - ${memberName} - ${labels}`;
}
