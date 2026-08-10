export type RoleName =
  | "admin_total"
  | "mestre_conselheiro"
  | "consultor"
  | "presidente_conselho"
  | "escrivao"
  | "tesoureiro"
  | "presidente_comissao"
  | "membro";

export type Permission =
  | "admin"
  | "secretaria"
  | "tesouraria"
  | "comissoes"
  | "conselho"
  | "visualizar"
  | "visualizar_total";

/** Ações granulares (eventos, votos, etc.). */
export type ActionPermission =
  | "eventos.tickets"
  | "eventos.comandas"
  | "eventos.checkout"
  | "eventos.orcamento"
  /** Excluir evento/ingresso e alterar tipo de ingresso vendido. */
  | "eventos.manage"
  | "comissao.view"
  | "comissao.edit"
  /** Excluir dentro da comissão (só presidente; vice tem CRU sem delete). */
  | "comissao.delete"
  | "comissao.vote";

const MATRIX: Record<string, Permission[]> = {
  admin_total: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar", "visualizar_total"],
  mestre_conselheiro: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar", "visualizar_total"],
  consultor: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar", "visualizar_total"],
  presidente_conselho: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar", "visualizar_total"],
  escrivao: ["secretaria", "comissoes", "visualizar", "visualizar_total"],
  tesoureiro: ["tesouraria", "visualizar", "visualizar_total"],
  presidente_comissao: ["comissoes", "visualizar"],
  membro: ["visualizar"],
};

/** Cargos ritualísticos (positions.code) que concedem permissões no termo vigente. */
const POSITION_PERMS: Record<string, Permission[]> = {
  mestre_conselheiro: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar", "visualizar_total"],
  presidente_conselho_consultivo: [
    "admin",
    "secretaria",
    "tesouraria",
    "comissoes",
    "conselho",
    "visualizar",
    "visualizar_total",
  ],
  conselheiro_consultor: [
    "admin",
    "secretaria",
    "tesouraria",
    "comissoes",
    "conselho",
    "visualizar",
    "visualizar_total",
  ],
  escrivao: ["secretaria", "comissoes", "visualizar", "visualizar_total"],
  tesoureiro: ["tesouraria", "visualizar", "visualizar_total"],
  primeiro_conselheiro: ["visualizar", "visualizar_total"],
  segundo_conselheiro: ["visualizar", "visualizar_total"],
};

export type CommissionRoleCtx = {
  code: string;
  role: "presidente" | "vice" | "membro" | "auxiliar_senior" | string;
};

export type AccessContext = {
  roleName: string | null | undefined;
  /** Códigos de cargos ritualísticos do semestre vigente no capítulo. */
  currentPositions?: string[];
  /** Papéis em comissões do semestre vigente. */
  commissionRoles?: CommissionRoleCtx[];
};

function uniquePerms(list: Permission[]): Permission[] {
  return [...new Set(list)];
}

/** Resolve a matriz efetiva: role de sistema + cargos do termo. */
export function resolveAccess(ctx: AccessContext): Permission[] {
  const perms: Permission[] = [...permissionsOf(ctx.roleName)];
  for (const code of ctx.currentPositions ?? []) {
    const extra = POSITION_PERMS[code];
    if (extra) perms.push(...extra);
  }
  return uniquePerms(perms);
}

export function permissionsOf(roleName: string | null | undefined): Permission[] {
  if (!roleName) return [];
  return MATRIX[roleName] ?? ["visualizar"];
}

export function can(roleName: string | null | undefined, perm: Permission): boolean {
  return permissionsOf(roleName).includes(perm);
}

/** Checagem com contexto completo (cargos + role). Preferir em telas novas. */
export function canAccess(ctx: AccessContext, perm: Permission): boolean {
  return resolveAccess(ctx).includes(perm);
}

function hasFullChapterPower(ctx: AccessContext): boolean {
  return canAccess(ctx, "admin") || canAccess(ctx, "conselho");
}

function commissionEntry(ctx: AccessContext, code: string): CommissionRoleCtx | undefined {
  return (ctx.commissionRoles ?? []).find((c) => c.code === code);
}

function hasPos(ctx: AccessContext, code: string): boolean {
  return (ctx.currentPositions ?? []).includes(code);
}

function isMestreConselheiro(ctx: AccessContext): boolean {
  if (ctx.roleName === "mestre_conselheiro") return true;
  return hasPos(ctx, "mestre_conselheiro");
}

function isTesoureiro(ctx: AccessContext): boolean {
  return ctx.roleName === "tesoureiro" || hasPos(ctx, "tesoureiro");
}

function isEscrivao(ctx: AccessContext): boolean {
  return ctx.roleName === "escrivao" || hasPos(ctx, "escrivao");
}

/**
 * Ações específicas (comissões / eventos).
 * Escopo sempre implícito no capítulo do contexto carregado.
 */
export function canAction(
  ctx: AccessContext,
  action: ActionPermission,
  commissionCode?: string,
): boolean {
  // Excluir evento/ingresso e trocar tipo: só MC ou presidente da Com. Eventos.
  // Não incluir PCC/consultor (mesmo com poder amplo no restante do sistema).
  if (action === "eventos.manage") {
    if (ctx.roleName === "admin_total") return true;
    if (isMestreConselheiro(ctx)) return true;
    return commissionEntry(ctx, "eventos")?.role === "presidente";
  }

  if (hasFullChapterPower(ctx)) return true;

  if (action === "comissao.view" || action === "comissao.vote") {
    if (!commissionCode) return false;
    // 1º/2º Conselheiro (e demais com visualizar_total): veem todos os setores
    if (action === "comissao.view" && canAccess(ctx, "visualizar_total")) {
      return true;
    }
    if (action === "comissao.view" && canAccess(ctx, "comissoes") && commissionCode === "sindicancias") {
      // Escrivão: acesso total à comissão de sindicâncias
      if (canAccess(ctx, "secretaria") && ctx.roleName === "escrivao") return true;
      if ((ctx.currentPositions ?? []).includes("escrivao")) return true;
    }
    if (
      action === "comissao.view" &&
      canAccess(ctx, "tesouraria") &&
      commissionCode === "eventos"
    ) {
      if (ctx.roleName === "tesoureiro" || (ctx.currentPositions ?? []).includes("tesoureiro")) {
        return true;
      }
    }
    return Boolean(commissionEntry(ctx, commissionCode));
  }

  if (action === "comissao.edit") {
    if (!commissionCode) return false;
    if (canAccess(ctx, "admin")) return true;
    // Cargos com CRU/CRUD na comissão (matriz DeMolay)
    if (
      commissionCode === "eventos" &&
      (isTesoureiro(ctx) || hasPos(ctx, "primeiro_conselheiro"))
    ) {
      return true;
    }
    if (
      commissionCode === "sindicancias" &&
      (isEscrivao(ctx) || hasPos(ctx, "segundo_conselheiro"))
    ) {
      return true;
    }
    const entry = commissionEntry(ctx, commissionCode);
    // Presidente e Vice: create/edit (CRU). Delete → comissao.delete.
    return entry?.role === "presidente" || entry?.role === "vice";
  }

  if (action === "comissao.delete") {
    if (!commissionCode) return false;
    if (canAccess(ctx, "admin")) return true;
    // CRUD (com delete): Tesoureiro / 1º Conselheiro em Eventos; presidente da comissão
    if (
      commissionCode === "eventos" &&
      (isTesoureiro(ctx) || hasPos(ctx, "primeiro_conselheiro"))
    ) {
      return true;
    }
    const entry = commissionEntry(ctx, commissionCode);
    return entry?.role === "presidente";
  }

  // Eventos: tickets, comandas, checkout, orçamento
  if (
    action === "eventos.tickets" ||
    action === "eventos.comandas" ||
    action === "eventos.checkout" ||
    action === "eventos.orcamento"
  ) {
    if (canAccess(ctx, "tesouraria") || canAccess(ctx, "comissoes") || canAccess(ctx, "admin")) {
      return true;
    }
    const entry = commissionEntry(ctx, "eventos");
    return Boolean(entry); // qualquer papel na Com. Eventos
  }

  return false;
}

/** Administradores (MC, Presidente, Consultor) e Escrivão gerenciam chamada, ata e presenças. */
export function canManageAttendance(roleName: string | null | undefined): boolean {
  return can(roleName, "secretaria") || can(roleName, "conselho") || can(roleName, "admin");
}

export function canManageAttendanceAccess(ctx: AccessContext): boolean {
  return (
    canAccess(ctx, "secretaria") || canAccess(ctx, "conselho") || canAccess(ctx, "admin")
  );
}

/** Leitura de presenças/chamada: gestores + quem tem visualização ampla (1º/2º Conselheiro). */
export function canViewAttendanceAccess(ctx: AccessContext): boolean {
  return canManageAttendanceAccess(ctx) || canAccess(ctx, "visualizar_total");
}

/** Navegação completa em modo leitura (Secretaria, Tesouraria, Comissões…). */
export function canBrowseAllScreens(ctx: AccessContext): boolean {
  return canAccess(ctx, "visualizar_total");
}

/** Escrivão, PCC (Presidente do Conselho) e MC gerenciam senhas dos tipos de ata. */
export function canManageMinutePasswords(
  roleName: string | null | undefined,
): boolean {
  return (
    roleName === "escrivao" ||
    roleName === "presidente_conselho" ||
    roleName === "mestre_conselheiro" ||
    roleName === "admin_total"
  );
}

export function canManageMinutePasswordsAccess(ctx: AccessContext): boolean {
  if (canManageMinutePasswords(ctx.roleName)) return true;
  const positions = ctx.currentPositions ?? [];
  return (
    positions.includes("escrivao") ||
    positions.includes("mestre_conselheiro") ||
    positions.includes("presidente_conselho_consultivo")
  );
}

/** Telas básicas liberadas a qualquer membro do capítulo (role membro). */
export function canViewMemberBasics(ctx: AccessContext): boolean {
  return canAccess(ctx, "visualizar") || canAccess(ctx, "visualizar_total");
}

export const ROLE_LABELS: Record<string, string> = {
  admin_total: "Administrador Total",
  mestre_conselheiro: "Mestre Conselheiro",
  consultor: "Consultor",
  presidente_conselho: "Presidente do Conselho",
  escrivao: "Escrivão",
  tesoureiro: "Tesoureiro",
  presidente_comissao: "Presidente de Comissão",
  membro: "Membro",
};

/** Roles atribuíveis pela UI (admin_total excluído). */
export const ASSIGNABLE_ROLES = (Object.keys(ROLE_LABELS) as RoleName[]).filter(
  (r) => r !== "admin_total",
);
