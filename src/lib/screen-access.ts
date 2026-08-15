/** Matriz global de acesso por tela (cargo × org_type). */

import {
  hasOrgLeaderPosition,
  isOrgLeader,
  type AccessContext,
} from "@/lib/permissions";
import { normalizeOrgType, type OrgType } from "@/lib/org-types";

export type ScreenAction = "view" | "edit" | "create" | "delete";

export type ScreenId =
  | "inicio"
  | "perfil"
  | "membros"
  | "atas"
  | "oficios"
  | "presencas"
  | "caixa"
  | "mensalidades"
  | "cobrancas"
  | "calendario"
  | "gestao"
  | "configuracoes"
  | "eventos"
  | "eventos_checkins"
  | "sindicancias_fichas"
  | "sindicancias"
  | "sindicancias_config"
  | "permissoes";

export type PlatformAccessGrant = {
  role_id: string;
  org_type: OrgType;
  screen_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_create: boolean;
  can_delete: boolean;
};

export type PlatformAccessRole = {
  id: string;
  key: string;
  label: string;
  is_system: boolean;
  match_kind: "position" | "role_fallback" | "commission_president" | "account_role";
  match_code: string | null;
  sort_order: number;
};

export type PlatformAccessRoleOrgType = {
  role_id: string;
  org_type: OrgType;
  role_group: "ritualisticos" | "conselho" | "comissoes" | null;
  sort_order: number;
};

export type PlatformAccessScreen = {
  id: string;
  label: string;
  sort_order: number;
};

export type ScreenGrantFlags = {
  can_view: boolean;
  can_edit: boolean;
  can_create: boolean;
  can_delete: boolean;
};

const ACCOUNT_ROLE_TO_KEYS: Record<string, string> = {
  mestre_conselheiro: "account_mc",
  escrivao: "account_esc",
  tesoureiro: "account_tes",
  consultor: "account_cc",
  presidente_conselho: "account_pcc",
  presidente_comissao: "account_pres_com",
  membro: "membro",
};

/** Mapeia path do menu → screen_id. */
export const PATH_TO_SCREEN: Record<string, ScreenId> = {
  "/inicio": "inicio",
  "/perfil": "perfil",
  "/membros": "membros",
  "/atas": "atas",
  "/oficios": "oficios",
  "/oficios/novo": "oficios",
  "/presencas": "presencas",
  "/tesouraria/fluxo": "caixa",
  "/tesouraria/mensalidades": "mensalidades",
  "/tesouraria/atrasados": "mensalidades",
  "/tesouraria/cobrancas": "cobrancas",
  "/calendario": "calendario",
  "/gestao": "gestao",
  "/configuracoes": "configuracoes",
  "/configuracoes-globais/cargos": "configuracoes",
  "/configuracoes-globais/inbox": "configuracoes",
  "/eventos": "eventos",
  "/eventos/checkins": "eventos_checkins",
  "/sindicancias/fichas": "sindicancias_fichas",
  "/sindicancias/sindicarias": "sindicancias",
  "/sindicancias/config": "sindicancias_config",
};

export function emptyGrantFlags(): ScreenGrantFlags {
  return {
    can_view: false,
    can_edit: false,
    can_create: false,
    can_delete: false,
  };
}

export function mergeGrantFlags(
  a: ScreenGrantFlags,
  b: ScreenGrantFlags,
): ScreenGrantFlags {
  return {
    can_view: a.can_view || b.can_view,
    can_edit: a.can_edit || b.can_edit,
    can_create: a.can_create || b.can_create,
    can_delete: a.can_delete || b.can_delete,
  };
}

/** Quais platform_access_roles.key batem com o contexto do usuário. */
export function matchingRoleKeys(
  ctx: AccessContext,
  roles?: PlatformAccessRole[],
): string[] {
  const keys = new Set<string>(["membro"]);

  if (ctx.roleName && ACCOUNT_ROLE_TO_KEYS[ctx.roleName]) {
    keys.add(ACCOUNT_ROLE_TO_KEYS[ctx.roleName]);
  }

  for (const code of ctx.currentPositions ?? []) {
    if (code === "mestre_conselheiro" || code === "loja_veneravel_mestre")
      keys.add("mc");
    else if (code === "presidente_conselho_consultivo") keys.add("pcc");
    else if (code === "conselheiro_consultor") keys.add("cc");
    else if (code === "primeiro_conselheiro") keys.add("1c");
    else if (code === "segundo_conselheiro") keys.add("2c");
    else if (code === "tesoureiro") keys.add("tes");
    else if (code === "escrivao") keys.add("esc");
  }

  if ((ctx.commissionRoles ?? []).some((c) => c.role === "presidente")) {
    keys.add("presidente_comissao");
  }

  for (const r of roles ?? []) {
    if (r.match_kind === "position" && r.match_code) {
      if ((ctx.currentPositions ?? []).includes(r.match_code)) keys.add(r.key);
    } else if (r.match_kind === "account_role" && r.match_code) {
      if (ctx.roleName === r.match_code) keys.add(r.key);
    } else if (r.match_kind === "commission_president") {
      if ((ctx.commissionRoles ?? []).some((c) => c.role === "presidente")) {
        keys.add(r.key);
      }
    } else if (r.match_kind === "role_fallback" && r.match_code === "membro") {
      keys.add(r.key);
    }
  }

  return [...keys];
}

export function isAdminTotal(ctx: AccessContext): boolean {
  return ctx.roleName === "admin_total";
}

/**
 * União dos grants dos cargos que batem, filtrados por org_type.
 * Só considera cargos habilitados para o tipo de instituição.
 */
export function resolveScreenGrants(opts: {
  ctx: AccessContext;
  orgType: string | null | undefined;
  roles: PlatformAccessRole[];
  grants: PlatformAccessGrant[];
  roleOrgTypes?: PlatformAccessRoleOrgType[];
}): Map<string, ScreenGrantFlags> {
  const orgType = normalizeOrgType(opts.orgType);
  const map = new Map<string, ScreenGrantFlags>();

  if (isAdminTotal(opts.ctx)) {
    for (const s of new Set(opts.grants.map((g) => g.screen_id))) {
      map.set(s, {
        can_view: true,
        can_edit: true,
        can_create: true,
        can_delete: true,
      });
    }
    for (const id of Object.values(PATH_TO_SCREEN)) {
      map.set(id, {
        can_view: true,
        can_edit: true,
        can_create: true,
        can_delete: true,
      });
    }
    return map;
  }

  const scopedRoleIds = new Set(
    (opts.roleOrgTypes ?? [])
      .filter((x) => x.org_type === orgType)
      .map((x) => x.role_id),
  );
  // Sem escopos carregados: comportamento legado (todos os cargos)
  const enforceScope = (opts.roleOrgTypes?.length ?? 0) > 0;

  const keys = new Set(matchingRoleKeys(opts.ctx, opts.roles));
  const roleIds = new Set(
    opts.roles
      .filter((r) => keys.has(r.key))
      .filter((r) => !enforceScope || scopedRoleIds.has(r.id))
      .map((r) => r.id),
  );

  for (const g of opts.grants) {
    if (g.org_type !== orgType) continue;
    if (!roleIds.has(g.role_id)) continue;
    const prev = map.get(g.screen_id) ?? emptyGrantFlags();
    map.set(
      g.screen_id,
      mergeGrantFlags(prev, {
        can_view: g.can_view,
        can_edit: g.can_edit,
        can_create: g.can_create,
        can_delete: g.can_delete,
      }),
    );
  }

  return map;
}

/** Cargos visíveis na UI para um tipo de instituição. */
export function rolesForOrgType(
  roles: PlatformAccessRole[],
  roleOrgTypes: PlatformAccessRoleOrgType[],
  orgType: OrgType,
): PlatformAccessRole[] {
  const allowed = new Set(
    roleOrgTypes.filter((x) => x.org_type === orgType).map((x) => x.role_id),
  );
  return visiblePlatformRoles(roles).filter((r) => allowed.has(r.id));
}

export function canScreenFromMap(
  map: Map<string, ScreenGrantFlags>,
  screenId: string,
  action: ScreenAction,
  adminBypass: boolean,
): boolean {
  if (adminBypass) return true;
  const flags = map.get(screenId);
  if (!flags) return false;
  if (action === "view") return flags.can_view;
  if (action === "edit") return flags.can_edit;
  if (action === "create") return flags.can_create;
  return flags.can_delete;
}

const ALL_CHAPTER_SCREENS: ScreenId[] = [
  "inicio",
  "perfil",
  "membros",
  "atas",
  "oficios",
  "presencas",
  "caixa",
  "mensalidades",
  "cobrancas",
  "calendario",
  "gestao",
  "configuracoes",
  "eventos",
  "eventos_checkins",
  "sindicancias_fichas",
  "sindicancias",
  "sindicancias_config",
];

const SECRETARIA = ["membros", "atas", "oficios", "presencas"] as const;
const TESOURARIA = ["caixa", "mensalidades", "cobrancas"] as const;
const GESTAO_MENU = ["calendario", "gestao", "configuracoes"] as const;
const EVENTOS = ["eventos", "eventos_checkins"] as const;
const SIND = ["sindicancias_fichas", "sindicancias", "sindicancias_config"] as const;

function viewOnly(): ScreenGrantFlags {
  return { can_view: true, can_edit: false, can_create: false, can_delete: false };
}
function cru(): ScreenGrantFlags {
  return { can_view: true, can_edit: true, can_create: true, can_delete: false };
}
function crud(): ScreenGrantFlags {
  return { can_view: true, can_edit: true, can_create: true, can_delete: true };
}

function grantMany(
  map: Map<string, ScreenGrantFlags>,
  ids: readonly string[],
  flags: ScreenGrantFlags,
) {
  for (const id of ids) {
    map.set(id, mergeGrantFlags(map.get(id) ?? emptyGrantFlags(), flags));
  }
}

function hasPos(ctx: AccessContext, code: string): boolean {
  return (ctx.currentPositions ?? []).includes(code);
}

function isFullChapterLeader(ctx: AccessContext): boolean {
  if (ctx.roleName === "admin_total") return true;
  if (isOrgLeader(ctx)) return true;
  if (
    ctx.roleName === "consultor" ||
    ctx.roleName === "presidente_conselho"
  ) {
    return true;
  }
  return (
    hasOrgLeaderPosition(ctx.currentPositions) ||
    hasPos(ctx, "presidente_conselho_consultivo") ||
    hasPos(ctx, "conselheiro_consultor")
  );
}

function isTesoureiro(ctx: AccessContext): boolean {
  return ctx.roleName === "tesoureiro" || hasPos(ctx, "tesoureiro");
}

function isEscrivao(ctx: AccessContext): boolean {
  return ctx.roleName === "escrivao" || hasPos(ctx, "escrivao");
}

function is1C(ctx: AccessContext): boolean {
  return hasPos(ctx, "primeiro_conselheiro");
}

function is2C(ctx: AccessContext): boolean {
  return hasPos(ctx, "segundo_conselheiro");
}

/**
 * Matriz hardcoded Capítulo DeMolay (view/edit/create/delete por tela).
 * Escopo reservado: no futuro pode voltar a ler platform_access_*.
 */
export function resolveHardcodedScreenAccess(
  ctx: AccessContext,
): Map<string, ScreenGrantFlags> {
  const map = new Map<string, ScreenGrantFlags>();

  if (isAdminTotal(ctx) || isFullChapterLeader(ctx)) {
    grantMany(map, ALL_CHAPTER_SCREENS, crud());
    return map;
  }

  // Membro comum (base)
  map.set("inicio", viewOnly());
  map.set("perfil", { can_view: true, can_edit: true, can_create: false, can_delete: false });
  grantMany(map, ["atas", "oficios", "presencas"], viewOnly());
  grantMany(map, ["caixa", "mensalidades"], viewOnly());
  grantMany(map, ["calendario", "gestao"], viewOnly());

  if (isTesoureiro(ctx)) {
    grantMany(map, SECRETARIA, viewOnly());
    grantMany(map, TESOURARIA, crud());
    grantMany(map, GESTAO_MENU, viewOnly());
    grantMany(map, EVENTOS, crud());
  }

  if (isEscrivao(ctx)) {
    grantMany(map, SECRETARIA, cru());
    // Atas: exclusão lógica (lixeira 30 dias)
    map.set(
      "atas",
      mergeGrantFlags(map.get("atas") ?? emptyGrantFlags(), crud()),
    );
    grantMany(map, TESOURARIA, viewOnly());
    grantMany(map, GESTAO_MENU, viewOnly());
    grantMany(map, SIND, cru());
  }

  if (is1C(ctx)) {
    grantMany(map, ALL_CHAPTER_SCREENS, viewOnly());
    grantMany(map, EVENTOS, crud());
  }

  if (is2C(ctx)) {
    grantMany(map, ALL_CHAPTER_SCREENS, viewOnly());
    grantMany(map, SIND, cru());
  }

  // Participação em comissão (sobreposta)
  for (const entry of ctx.commissionRoles ?? []) {
    const screens =
      entry.code === "eventos"
        ? EVENTOS
        : entry.code === "sindicancias"
          ? SIND
          : null;
    if (!screens) continue;
    if (entry.role === "presidente") {
      grantMany(map, screens, crud());
    } else if (entry.role === "vice") {
      grantMany(map, screens, cru());
    } else {
      // membro / auxiliar_senior
      grantMany(map, screens, viewOnly());
    }
  }

  return map;
}

export function resolveHardcodedCanScreen(
  ctx: AccessContext,
  screenId: string,
  action: ScreenAction,
  adminBypass: boolean,
): boolean {
  if (adminBypass || isAdminTotal(ctx)) return true;
  if (screenId === "permissoes") return false;
  return canScreenFromMap(
    resolveHardcodedScreenAccess(ctx),
    screenId,
    action,
    false,
  );
}

/** Há algum can_view para o org_type (qualquer cargo do contexto)? */
export function orgTypeHasAnyView(opts: {
  ctx: AccessContext;
  orgType: string | null | undefined;
  roles: PlatformAccessRole[];
  grants: PlatformAccessGrant[];
}): boolean {
  if (isAdminTotal(opts.ctx)) return true;
  // Preferir matriz hardcoded (runtime atual)
  const hard = resolveHardcodedScreenAccess(opts.ctx);
  for (const flags of hard.values()) {
    if (flags.can_view) return true;
  }
  const map = resolveScreenGrants(opts);
  for (const flags of map.values()) {
    if (flags.can_view) return true;
  }
  return false;
}

/** Roles exibidos na UI de permissões (oculta aliases de conta). */
export function visiblePlatformRoles(
  roles: PlatformAccessRole[],
): PlatformAccessRole[] {
  return roles
    .filter((r) => r.match_kind !== "account_role" && r.sort_order < 1000)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}
