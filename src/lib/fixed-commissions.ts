/**
 * Módulos do sistema que podem ser vinculados a comissões,
 * e comissões obrigatórias dos Capítulos DeMolay.
 */

export type CommissionModuleKey =
  | "hospitalaria"
  | "entretenimento"
  | "auditoria"
  | "financas"
  | "sindicancias"
  | "eventos";

export type CommissionModule = {
  key: CommissionModuleKey;
  label: string;
  /** Rota principal do módulo. */
  path: string;
  /**
   * Só visualização via participação na comissão
   * (CRUD operacional fica com cargos ritualísticos).
   */
  viewOnly: boolean;
};

/** Módulos disponíveis para vínculo (obrigatórias e opcionais). */
export const COMMISSION_MODULES: readonly CommissionModule[] = [
  {
    key: "hospitalaria",
    label: "Hospitalaria",
    path: "/hospitalaria/cardapios",
    viewOnly: false,
  },
  {
    key: "entretenimento",
    label: "Calendário",
    path: "/calendario",
    viewOnly: true,
  },
  {
    key: "auditoria",
    label: "Configurações · Auditoria",
    path: "/configuracoes",
    viewOnly: true,
  },
  {
    key: "financas",
    label: "Tesouraria",
    path: "/tesouraria/fluxo",
    viewOnly: true,
  },
  {
    key: "sindicancias",
    label: "Sindicâncias",
    path: "/sindicancias/sindicarias",
    viewOnly: false,
  },
  {
    key: "eventos",
    label: "Eventos",
    path: "/eventos",
    viewOnly: false,
  },
] as const;

export const COMMISSION_MODULE_KEYS: readonly CommissionModuleKey[] =
  COMMISSION_MODULES.map((m) => m.key);

export function isCommissionModuleKey(
  value: string | null | undefined,
): value is CommissionModuleKey {
  return (
    !!value &&
    (COMMISSION_MODULE_KEYS as readonly string[]).includes(value)
  );
}

export function commissionModuleByKey(
  key: string | null | undefined,
): CommissionModule | undefined {
  if (!key) return undefined;
  return COMMISSION_MODULES.find((m) => m.key === key);
}

export type FixedDemolayCommission = {
  code: CommissionModuleKey;
  label: string;
  sort_order: number;
  moduleKey: CommissionModuleKey;
};

/** Comissões obrigatórias do Capítulo DeMolay (código = módulo). */
export const FIXED_DEMOLAY_COMMISSIONS: readonly FixedDemolayCommission[] = [
  { code: "hospitalaria", label: "Hospitalaria", sort_order: 1, moduleKey: "hospitalaria" },
  { code: "entretenimento", label: "Entretenimento", sort_order: 2, moduleKey: "entretenimento" },
  { code: "auditoria", label: "Auditoria", sort_order: 3, moduleKey: "auditoria" },
  { code: "financas", label: "Finanças", sort_order: 4, moduleKey: "financas" },
  { code: "sindicancias", label: "Sindicâncias", sort_order: 5, moduleKey: "sindicancias" },
  { code: "eventos", label: "Eventos", sort_order: 6, moduleKey: "eventos" },
] as const;

export const FIXED_DEMOLAY_COMMISSION_CODES: readonly string[] =
  FIXED_DEMOLAY_COMMISSIONS.map((c) => c.code);

export function isFixedDemolayCommissionCode(code: string): boolean {
  return (FIXED_DEMOLAY_COMMISSION_CODES as readonly string[]).includes(code);
}

export function fixedDemolayCommissionByCode(
  code: string,
): FixedDemolayCommission | undefined {
  return FIXED_DEMOLAY_COMMISSIONS.find((c) => c.code === code);
}

/** Módulo efetivo: vínculo explícito ou código, se for módulo conhecido. */
export function effectiveCommissionModuleKey(
  code: string,
  moduleKey?: string | null,
): CommissionModuleKey | null {
  if (isCommissionModuleKey(moduleKey)) return moduleKey;
  if (isCommissionModuleKey(code)) return code;
  return null;
}
