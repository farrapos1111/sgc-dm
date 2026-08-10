/** Tipos de instituição (capítulo, bethel, etc.). */
export const ORG_TYPES = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "abelhinhas",
  "arco_iris",
  "apj",
  "loja",
  "outro",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];

/** Abas da tela de Cargos / Permissões (exclui `outro` legado). */
export const ORG_TYPES_UI = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "abelhinhas",
  "arco_iris",
  "apj",
  "loja",
] as const satisfies readonly OrgType[];

export type OrgTypeUi = (typeof ORG_TYPES_UI)[number];

/** Categorias com Ritualísticos | Conselho | Comissões. */
export const ORG_TYPES_WITH_ROLE_GROUPS = [
  "capitulo",
  "priorado",
  "castelo",
  "bethel",
  "abelhinhas",
] as const satisfies readonly OrgType[];

/** Categorias com lista plana. */
export const ORG_TYPES_FLAT = [
  "arco_iris",
  "apj",
  "loja",
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
  comissoes: "Comissões",
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  capitulo: "Capítulo",
  priorado: "Priorado",
  castelo: "Castelo",
  bethel: "Bethel",
  abelhinhas: "Abelhinhas",
  arco_iris: "Arco Íris",
  apj: "APJ",
  loja: "Loja",
  outro: "Outro",
};

/** Plural curto para filtros/chips. */
export const ORG_TYPE_FILTER_LABELS: Record<OrgType, string> = {
  capitulo: "Capítulos",
  priorado: "Priorados",
  castelo: "Castelos",
  bethel: "Betheis",
  abelhinhas: "Abelhinhas",
  arco_iris: "Arco Íris",
  apj: "APJ",
  loja: "Lojas",
  outro: "Outros",
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
  if (/\babelhinha/.test(n)) return "abelhinhas";
  if (/\barco\s*iris\b/.test(n) || /\barcoiris\b/.test(n)) return "arco_iris";
  if (/\bbethel\b/.test(n)) return "bethel";
  if (/\bpriorado\b/.test(n)) return "priorado";
  if (/\bcastelo\b/.test(n)) return "castelo";
  if (/\bapj\b/.test(n) || /\bassambleia\b/.test(n)) return "apj";
  if (/\bloja\b/.test(n)) return "loja";
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
