/** Tipos de instituição (capítulo, bethel, loja, etc.). */
export const ORG_TYPES = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "arco_iris",
  "apj",
  "loja",
  "alumni",
  "outro",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];

/** Abas da tela de Cargos / Permissões (exclui `outro` legado). */
export const ORG_TYPES_UI = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "arco_iris",
  "apj",
  "loja",
  "alumni",
] as const satisfies readonly OrgType[];

export type OrgTypeUi = (typeof ORG_TYPES_UI)[number];

/** Categorias com Ritualísticos | Conselho | Comissões. */
export const ORG_TYPES_WITH_ROLE_GROUPS = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
] as const satisfies readonly OrgType[];

/** Categorias com lista plana. */
export const ORG_TYPES_FLAT = [
  "arco_iris",
  "apj",
  "loja",
  "alumni",
] as const satisfies readonly OrgType[];

export const ROLE_GROUPS = [
  "ritualisticos",
  "conselho",
  "comissoes",
] as const;

export type RoleGroup = (typeof ROLE_GROUPS)[number];

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  ritualisticos: "Ritualísticos",
  conselho: "Conselho",
  comissoes: "Funções de comissão",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  capitulo: "Capítulo",
  priorado: "Priorado",
  castelo: "Castelo",
  bethel: "Bethel",
  arco_iris: "Arco Íris",
  apj: "APJ",
  loja: "Loja",
  alumni: "Colégio Alumni",
  outro: "Outro",
};

/** Plural curto para filtros/chips. */
export const ORG_TYPE_FILTER_LABELS: Record<OrgType, string> = {
  capitulo: "Capítulos",
  priorado: "Priorados",
  castelo: "Castelos",
  bethel: "Betheis",
  arco_iris: "Arco Íris",
  apj: "APJ",
  loja: "Lojas",
  alumni: "Alumni",
  outro: "Outros",
};

export type BillingModel = "pago" | "gratuito";

export type OrgTypeFormSchema = {
  admin_max_label?: string;
  id_field_label?: string;
  uses_grau?: boolean;
  sponsor_kind?: "loja" | "capitulo" | null;
  uses_demolay_id?: boolean;
  reuses_demolay_membership?: boolean;
  membership_kind?: string;
  cargos_juvenis?: string;
};

export function isOrgType(value: string | null | undefined): value is OrgType {
  return Boolean(value && (ORG_TYPES as readonly string[]).includes(value));
}

export function normalizeOrgType(
  value: string | null | undefined,
): OrgType {
  return isOrgType(value) ? value : "capitulo";
}

export function orgTypeHasRoleGroups(orgType: OrgType): boolean {
  return (ORG_TYPES_WITH_ROLE_GROUPS as readonly string[]).includes(orgType);
}

/** Inferência leve a partir do nome (backfill / legado). */
export function inferOrgTypeFromName(name: string): OrgType {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\babelhinha/.test(n)) return "bethel";
  if (/\balumni\b/.test(n) || /\bcolegio\b/.test(n)) return "alumni";
  if (/\barco\s*iris\b/.test(n) || /\barcoiris\b/.test(n)) return "arco_iris";
  if (/\bbethel\b/.test(n)) return "bethel";
  if (/\bpriorado\b/.test(n)) return "priorado";
  if (/\bcastelo\b/.test(n)) return "castelo";
  if (/\bapj\b/.test(n)) return "apj";
  if (/\bloja\b/.test(n)) return "loja";
  if (/\bassambleia\b/.test(n)) return "arco_iris";
  if (/\bcapitulo\b/.test(n)) return "capitulo";
  return "capitulo";
}

/** Ordenação numérica de número de instituição (ex.: "92" antes de "967"). */
export function compareOrgNumbers(a: string, b: string): number {
  const an = Number(String(a).replace(/\D/g, ""));
  const bn = Number(String(b).replace(/\D/g, ""));
  if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

export function sponsorFieldLabel(
  sponsorKind: OrgTypeFormSchema["sponsor_kind"],
): string {
  if (sponsorKind === "capitulo") return "Capítulo patrocinador";
  return "Loja patrocinadora";
}

export function needsSponsor(
  sponsorKind: OrgTypeFormSchema["sponsor_kind"],
): boolean {
  return sponsorKind === "loja" || sponsorKind === "capitulo";
}

/**
 * Sufixo do seletor de cargo ritualístico.
 * `positions.scope` legado usa "capitulo" também para Loja — o rótulo segue o org_type ativo.
 */
export function positionScopeSuffix(
  scope: string | null | undefined,
  orgType?: string | null,
): string {
  if (scope === "consultivo") return "Conselho";
  if (scope === "comissao" || scope === "comissoes") return "Comissão";
  if (scope === "regional") return "Regional";
  const sphere = normalizeOrgType(orgType);
  return ORG_TYPE_LABELS[sphere] ?? "Instituição";
}

export function formatPositionOptionLabel(
  label: string,
  scope: string | null | undefined,
  orgType?: string | null,
): string {
  return `${label} · ${positionScopeSuffix(scope, orgType)}`;
}

/** Rótulo do campo de instituição de iniciação (perfil / formulário). */
export function initiationOrgFieldLabel(orgType?: string | null): string {
  const sphere = normalizeOrgType(orgType);
  switch (sphere) {
    case "loja":
      return "Loja de iniciação";
    case "bethel":
      return "Bethel de iniciação";
    case "arco_iris":
      return "Assembleia de iniciação";
    case "apj":
      return "Núcleo de iniciação";
    case "castelo":
      return "Castelo de iniciação";
    case "priorado":
      return "Priorado de iniciação";
    case "alumni":
      return "Colégio de iniciação";
    default:
      return "Capítulo de iniciação";
  }
}

/** Rótulo do campo de instituição originária. */
export function originOrgFieldLabel(orgType?: string | null): string {
  const sphere = normalizeOrgType(orgType);
  switch (sphere) {
    case "loja":
      return "Loja originária";
    case "bethel":
      return "Bethel originário";
    case "arco_iris":
      return "Assembleia originária";
    case "apj":
      return "Núcleo originário";
    case "castelo":
      return "Castelo originário";
    case "priorado":
      return "Priorado originário";
    case "alumni":
      return "Colégio originário";
    default:
      return "Capítulo originário";
  }
}

/** Título da lista de afiliações ativas. */
export function affiliatedOrgsHeading(orgType?: string | null): string {
  const sphere = normalizeOrgType(orgType);
  const plural = ORG_TYPE_FILTER_LABELS[sphere] ?? "Instituições";
  return `${plural} vinculadas`;
}

/** Campos ritualísticos / grau DeMolay (só Capítulo). */
export function usesDemolayRitualFields(orgType?: string | null): boolean {
  return normalizeOrgType(orgType) === "capitulo";
}

/** Campo ID DeMolay no cadastro. */
export function usesDemolayIdField(orgType?: string | null): boolean {
  const sphere = normalizeOrgType(orgType);
  return sphere === "capitulo" || sphere === "priorado" || sphere === "alumni";
}
