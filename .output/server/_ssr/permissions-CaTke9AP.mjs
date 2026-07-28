//#region node_modules/.nitro/vite/services/ssr/assets/permissions-CaTke9AP.js
var MATRIX = {
	admin_total: [
		"admin",
		"secretaria",
		"tesouraria",
		"comissoes",
		"conselho",
		"visualizar"
	],
	mestre_conselheiro: [
		"admin",
		"secretaria",
		"tesouraria",
		"comissoes",
		"conselho",
		"visualizar"
	],
	consultor: ["conselho", "visualizar"],
	presidente_conselho: ["conselho", "visualizar"],
	escrivao: [
		"secretaria",
		"comissoes",
		"visualizar"
	],
	tesoureiro: ["tesouraria", "visualizar"],
	presidente_comissao: ["comissoes", "visualizar"],
	membro: ["visualizar"]
};
function permissionsOf(roleName) {
	if (!roleName) return [];
	return MATRIX[roleName] ?? ["visualizar"];
}
function can(roleName, perm) {
	return permissionsOf(roleName).includes(perm);
}
/** Administradores (MC, Presidente, Consultor) e Escrivão gerenciam chamada, ata e presenças. */
function canManageAttendance(roleName) {
	return can(roleName, "secretaria") || can(roleName, "conselho") || can(roleName, "admin");
}
//#endregion
export { canManageAttendance as n, can as t };
