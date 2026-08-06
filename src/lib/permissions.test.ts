/**
 * Testes unitários da matriz resolveAccess / canAction (sem DB).
 * Executar: npx tsx src/lib/permissions.test.ts
 */
import assert from "node:assert/strict";
import {
  canAccess,
  canAction,
  resolveAccess,
  ASSIGNABLE_ROLES,
  type AccessContext,
} from "./permissions";

function ctx(
  roleName: string | null,
  positions: string[] = [],
  commissions: AccessContext["commissionRoles"] = [],
): AccessContext {
  return { roleName, currentPositions: positions, commissionRoles: commissions };
}

// Admin total
assert.ok(canAccess(ctx("admin_total"), "admin"));
assert.ok(canAccess(ctx("admin_total"), "secretaria"));
assert.ok(canAccess(ctx("admin_total"), "tesouraria"));

// Admin nunca atribuível pela UI
assert.ok(!(ASSIGNABLE_ROLES as string[]).includes("admin_total"));

// MC por role e por cargo ritualístico
assert.ok(canAccess(ctx("mestre_conselheiro"), "admin"));
assert.ok(canAccess(ctx("membro", ["mestre_conselheiro"]), "admin"));
assert.ok(canAccess(ctx("membro", ["mestre_conselheiro"]), "tesouraria"));

// Escrivão: secretaria + sindicâncias
assert.ok(canAccess(ctx("escrivao"), "secretaria"));
assert.ok(canAccess(ctx("membro", ["escrivao"]), "secretaria"));
assert.ok(canAction(ctx("escrivao"), "comissao.view", "sindicancias"));
assert.ok(!canAccess(ctx("escrivao"), "tesouraria"));

// Tesoureiro: tesouraria + eventos
assert.ok(canAccess(ctx("tesoureiro"), "tesouraria"));
assert.ok(canAccess(ctx("membro", ["tesoureiro"]), "tesouraria"));
assert.ok(canAction(ctx("tesoureiro"), "comissao.view", "eventos"));
assert.ok(canAction(ctx("tesoureiro"), "eventos.checkout"));
assert.ok(!canAccess(ctx("tesoureiro"), "secretaria"));

// 1º e 2º Conselheiros: visualizar total (só cargo)
assert.ok(canAccess(ctx("membro", ["primeiro_conselheiro"]), "visualizar_total"));
assert.ok(canAccess(ctx("membro", ["segundo_conselheiro"]), "visualizar_total"));
assert.ok(!canAccess(ctx("membro", ["primeiro_conselheiro"]), "admin"));
assert.ok(!canAccess(ctx("membro", ["primeiro_conselheiro"]), "secretaria"));

// PCC / Consultor: acesso total
assert.ok(canAccess(ctx("presidente_conselho"), "admin"));
assert.ok(canAccess(ctx("consultor"), "admin"));
assert.ok(
  canAccess(ctx("membro", ["presidente_conselho_consultivo"]), "admin"),
);
assert.ok(canAccess(ctx("membro", ["conselheiro_consultor"]), "secretaria"));

// Presidente de comissão: edição só na comissão
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "presidente" }]),
    "comissao.edit",
    "eventos",
  ),
);
assert.ok(
  !canAction(
    ctx("membro", [], [{ code: "eventos", role: "membro" }]),
    "comissao.edit",
    "eventos",
  ),
);

// Membro/vice/auxiliar eventos: tickets, comandas, checkout, orçamento
for (const role of ["membro", "vice", "auxiliar_senior"] as const) {
  const c = ctx("membro", [], [{ code: "eventos", role }]);
  assert.ok(canAction(c, "eventos.tickets"));
  assert.ok(canAction(c, "eventos.comandas"));
  assert.ok(canAction(c, "eventos.checkout"));
  assert.ok(canAction(c, "eventos.orcamento"));
  assert.ok(canAction(c, "comissao.view", "eventos"));
  assert.ok(canAction(c, "comissao.vote", "eventos"));
  assert.ok(!canAction(c, "eventos.manage"));
}

// Excluir evento/ingresso / trocar tipo: só MC ou presidente da Com. Eventos
assert.ok(canAction(ctx("mestre_conselheiro"), "eventos.manage"));
assert.ok(
  canAction(ctx("membro", ["mestre_conselheiro"]), "eventos.manage"),
);
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "presidente" }]),
    "eventos.manage",
  ),
);
assert.ok(
  !canAction(
    ctx("membro", [], [{ code: "eventos", role: "vice" }]),
    "eventos.manage",
  ),
);
assert.ok(!canAction(ctx("tesoureiro"), "eventos.manage"));
assert.ok(!canAction(ctx("consultor"), "eventos.manage"));
assert.ok(!canAction(ctx("presidente_conselho"), "eventos.manage"));
assert.ok(!canAction(ctx("escrivao"), "eventos.manage"));
assert.ok(canAction(ctx("admin_total"), "eventos.manage"));

// Membro comum: só visualizar
const comum = resolveAccess(ctx("membro"));
assert.deepEqual(comum, ["visualizar"]);
assert.ok(!canAccess(ctx("membro"), "secretaria"));
assert.ok(!canAccess(ctx("membro"), "admin"));

console.log("permissions.test.ts: todos os casos passaram");
