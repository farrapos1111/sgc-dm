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
  | "visualizar";

const MATRIX: Record<string, Permission[]> = {
  admin_total: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar"],
  mestre_conselheiro: ["admin", "secretaria", "tesouraria", "comissoes", "conselho", "visualizar"],
  consultor: ["conselho", "visualizar"],
  presidente_conselho: ["conselho", "visualizar"],
  escrivao: ["secretaria", "comissoes", "visualizar"],
  tesoureiro: ["tesouraria", "visualizar"],
  presidente_comissao: ["comissoes", "visualizar"],
  membro: ["visualizar"],
};

export function permissionsOf(roleName: string | null | undefined): Permission[] {
  if (!roleName) return [];
  return MATRIX[roleName] ?? ["visualizar"];
}

export function can(roleName: string | null | undefined, perm: Permission): boolean {
  return permissionsOf(roleName).includes(perm);
}

/** Administradores (MC, Presidente, Consultor) e Escrivão gerenciam chamada, ata e presenças. */
export function canManageAttendance(roleName: string | null | undefined): boolean {
  return can(roleName, "secretaria") || can(roleName, "conselho") || can(roleName, "admin");
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
