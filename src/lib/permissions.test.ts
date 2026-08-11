/**
 * Testes unitários da matriz resolveAccess / canAction / screen hardcoded (sem DB).
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
import { resolveHardcodedCanScreen } from "./screen-access";

function ctx(
  roleName: string | null,
  positions: string[] = [],
  commissions: AccessContext["commissionRoles"] = [],
): AccessContext {
  return { roleName, currentPositions: positions, commissionRoles: commissions };
}

function screen(
  c: AccessContext,
  screenId: string,
  action: "view" | "edit" | "create" | "delete",
) {
  return resolveHardcodedCanScreen(c, screenId, action, false);
}

// Admin total
assert.ok(canAccess(ctx("admin_total"), "admin"));
assert.ok(canAccess(ctx("admin_total"), "secretaria"));
assert.ok(canAccess(ctx("admin_total"), "tesouraria"));
assert.ok(screen(ctx("admin_total"), "membros", "delete"));

// Admin nunca atribuível pela UI
assert.ok(!(ASSIGNABLE_ROLES as string[]).includes("admin_total"));

// MC por role e por cargo ritualístico — CRUD total
assert.ok(canAccess(ctx("mestre_conselheiro"), "admin"));
assert.ok(canAccess(ctx("membro", ["mestre_conselheiro"]), "admin"));
assert.ok(canAccess(ctx("membro", ["mestre_conselheiro"]), "tesouraria"));
assert.ok(screen(ctx("membro", ["mestre_conselheiro"]), "cobrancas", "delete"));

// Venerável Mestre (Loja) — mesmo CRUD total do MC
assert.ok(canAccess(ctx("membro", ["loja_veneravel_mestre"]), "admin"));
assert.ok(canAccess(ctx("membro", ["loja_veneravel_mestre"]), "secretaria"));
assert.ok(canAccess(ctx("membro", ["loja_veneravel_mestre"]), "tesouraria"));
assert.ok(canAccess(ctx("membro", ["loja_veneravel_mestre"]), "conselho"));
assert.ok(screen(ctx("membro", ["loja_veneravel_mestre"]), "membros", "delete"));
assert.ok(screen(ctx("membro", ["loja_veneravel_mestre"]), "caixa", "delete"));
assert.ok(screen(ctx("membro", ["loja_veneravel_mestre"]), "configuracoes", "edit"));
assert.ok(canAction(ctx("membro", ["loja_veneravel_mestre"]), "eventos.manage"));

// Escrivão: Secretaria CRU; Tesouraria view; Gestão view; Sindicâncias CRU
assert.ok(canAccess(ctx("escrivao"), "secretaria"));
assert.ok(canAccess(ctx("membro", ["escrivao"]), "secretaria"));
assert.ok(canAction(ctx("escrivao"), "comissao.view", "sindicancias"));
assert.ok(canAction(ctx("escrivao"), "comissao.edit", "sindicancias"));
assert.ok(!canAction(ctx("escrivao"), "comissao.delete", "sindicancias"));
assert.ok(!canAccess(ctx("escrivao"), "tesouraria"));
assert.ok(screen(ctx("escrivao"), "atas", "edit"));
assert.ok(screen(ctx("escrivao"), "atas", "create"));
assert.ok(!screen(ctx("escrivao"), "atas", "delete"));
assert.ok(screen(ctx("escrivao"), "caixa", "view"));
assert.ok(!screen(ctx("escrivao"), "caixa", "edit"));
assert.ok(screen(ctx("escrivao"), "gestao", "view"));
assert.ok(!screen(ctx("escrivao"), "gestao", "edit"));
assert.ok(screen(ctx("escrivao"), "sindicancias", "edit"));
assert.ok(!screen(ctx("escrivao"), "sindicancias", "delete"));

// Tesoureiro: Secretaria view; Tesouraria CRUD; Gestão view; Eventos CRUD
assert.ok(canAccess(ctx("tesoureiro"), "tesouraria"));
assert.ok(canAccess(ctx("membro", ["tesoureiro"]), "tesouraria"));
assert.ok(canAction(ctx("tesoureiro"), "comissao.view", "eventos"));
assert.ok(canAction(ctx("tesoureiro"), "comissao.edit", "eventos"));
assert.ok(canAction(ctx("tesoureiro"), "comissao.delete", "eventos"));
assert.ok(canAction(ctx("tesoureiro"), "eventos.checkout"));
assert.ok(!canAccess(ctx("tesoureiro"), "secretaria"));
assert.ok(screen(ctx("tesoureiro"), "membros", "view"));
assert.ok(!screen(ctx("tesoureiro"), "membros", "edit"));
assert.ok(screen(ctx("tesoureiro"), "caixa", "delete"));
assert.ok(screen(ctx("tesoureiro"), "gestao", "view"));
assert.ok(!screen(ctx("tesoureiro"), "gestao", "edit"));
assert.ok(screen(ctx("tesoureiro"), "eventos", "delete"));

// 1º Conselheiro: view total + Eventos CRUD
assert.ok(canAccess(ctx("membro", ["primeiro_conselheiro"]), "visualizar_total"));
assert.ok(!canAccess(ctx("membro", ["primeiro_conselheiro"]), "admin"));
assert.ok(!canAccess(ctx("membro", ["primeiro_conselheiro"]), "secretaria"));
assert.ok(!canAccess(ctx("membro", ["primeiro_conselheiro"]), "tesouraria"));
assert.ok(
  canAction(ctx("membro", ["primeiro_conselheiro"]), "comissao.view", "eventos"),
);
assert.ok(
  canAction(ctx("membro", ["primeiro_conselheiro"]), "comissao.edit", "eventos"),
);
assert.ok(
  canAction(ctx("membro", ["primeiro_conselheiro"]), "comissao.delete", "eventos"),
);
assert.ok(screen(ctx("membro", ["primeiro_conselheiro"]), "membros", "view"));
assert.ok(!screen(ctx("membro", ["primeiro_conselheiro"]), "membros", "edit"));
assert.ok(screen(ctx("membro", ["primeiro_conselheiro"]), "eventos", "delete"));
assert.ok(!screen(ctx("membro", ["primeiro_conselheiro"]), "sindicancias", "edit"));

// 2º Conselheiro: view total + Sindicâncias CRU
assert.ok(canAccess(ctx("membro", ["segundo_conselheiro"]), "visualizar_total"));
assert.ok(
  canAction(
    ctx("membro", ["segundo_conselheiro"]),
    "comissao.view",
    "sindicancias",
  ),
);
assert.ok(
  canAction(
    ctx("membro", ["segundo_conselheiro"]),
    "comissao.edit",
    "sindicancias",
  ),
);
assert.ok(
  !canAction(
    ctx("membro", ["segundo_conselheiro"]),
    "comissao.delete",
    "sindicancias",
  ),
);
assert.ok(screen(ctx("membro", ["segundo_conselheiro"]), "sindicancias", "edit"));
assert.ok(!screen(ctx("membro", ["segundo_conselheiro"]), "sindicancias", "delete"));
assert.ok(!screen(ctx("membro", ["segundo_conselheiro"]), "eventos", "edit"));

// PCC / Consultor: acesso total
assert.ok(canAccess(ctx("presidente_conselho"), "admin"));
assert.ok(canAccess(ctx("consultor"), "admin"));
assert.ok(
  canAccess(ctx("membro", ["presidente_conselho_consultivo"]), "admin"),
);
assert.ok(canAccess(ctx("membro", ["conselheiro_consultor"]), "secretaria"));
assert.ok(screen(ctx("consultor"), "configuracoes", "delete"));

// Presidente de comissão: CRUD na comissão
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "presidente" }]),
    "comissao.edit",
    "eventos",
  ),
);
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "presidente" }]),
    "comissao.delete",
    "eventos",
  ),
);
assert.ok(screen(ctx("membro", [], [{ code: "eventos", role: "presidente" }]), "eventos", "delete"));

// Vice: CRU (sem delete)
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "vice" }]),
    "comissao.edit",
    "eventos",
  ),
);
assert.ok(
  !canAction(
    ctx("membro", [], [{ code: "eventos", role: "vice" }]),
    "comissao.delete",
    "eventos",
  ),
);
assert.ok(screen(ctx("membro", [], [{ code: "eventos", role: "vice" }]), "eventos", "edit"));
assert.ok(!screen(ctx("membro", [], [{ code: "eventos", role: "vice" }]), "eventos", "delete"));
assert.ok(
  canAction(
    ctx("membro", [], [{ code: "eventos", role: "vice" }]),
    "comissao.view",
    "eventos",
  ),
);

// Membro / Auxiliar Sênior: view only na comissão
for (const role of ["membro", "auxiliar_senior"] as const) {
  const c = ctx("membro", [], [{ code: "sindicancias", role }]);
  assert.ok(canAction(c, "comissao.view", "sindicancias"));
  assert.ok(!canAction(c, "comissao.edit", "sindicancias"));
  assert.ok(!canAction(c, "comissao.delete", "sindicancias"));
  assert.ok(!canAction(c, "comissao.view", "eventos"));
  assert.ok(screen(c, "sindicancias", "view"));
  assert.ok(!screen(c, "sindicancias", "edit"));
}
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

// Membro comum: Início; Perfil edit; Atas/Ofícios/Presenças view; Caixa/Mensalidades view; Calendário + Gestão view
const comum = resolveAccess(ctx("membro"));
assert.deepEqual(comum, ["visualizar"]);
assert.ok(!canAccess(ctx("membro"), "secretaria"));
assert.ok(!canAccess(ctx("membro"), "admin"));
assert.ok(screen(ctx("membro"), "inicio", "view"));
assert.ok(screen(ctx("membro"), "perfil", "edit"));
assert.ok(screen(ctx("membro"), "atas", "view"));
assert.ok(!screen(ctx("membro"), "atas", "edit"));
assert.ok(screen(ctx("membro"), "caixa", "view"));
assert.ok(!screen(ctx("membro"), "caixa", "edit"));
assert.ok(screen(ctx("membro"), "calendario", "view"));
assert.ok(screen(ctx("membro"), "gestao", "view"));
assert.ok(!screen(ctx("membro"), "membros", "view"));
assert.ok(!screen(ctx("membro"), "cobrancas", "view"));
assert.ok(!screen(ctx("membro"), "configuracoes", "view"));

// Multifiliação: elevado só no capítulo X
const chapterY = ctx("membro", []);
assert.deepEqual(resolveAccess(chapterY), ["visualizar"]);
assert.ok(!canAccess(chapterY, "admin"));
assert.ok(!canAccess(chapterY, "secretaria"));
assert.ok(!canAccess(chapterY, "tesouraria"));
assert.ok(!canAccess(chapterY, "conselho"));

const elevatedOnlyInX = [
  ["mestre_conselheiro"],
  ["loja_veneravel_mestre"],
  ["escrivao"],
  ["tesoureiro"],
  ["presidente_conselho_consultivo"],
  ["conselheiro_consultor"],
  ["primeiro_conselheiro"],
  ["segundo_conselheiro"],
] as const;
for (const positions of elevatedOnlyInX) {
  const inX = ctx("membro", [...positions]);
  const inY = ctx("membro", []);
  assert.ok(resolveAccess(inX).length >= resolveAccess(inY).length);
  assert.deepEqual(resolveAccess(inY), ["visualizar"]);
  if (
    positions[0] === "mestre_conselheiro" ||
    positions[0] === "loja_veneravel_mestre"
  ) {
    assert.ok(canAccess(inX, "admin"));
    assert.ok(!canAccess(inY, "admin"));
  }
  if (positions[0] === "escrivao") {
    assert.ok(canAccess(inX, "secretaria"));
    assert.ok(!canAccess(inY, "secretaria"));
  }
  if (positions[0] === "tesoureiro") {
    assert.ok(canAccess(inX, "tesouraria"));
    assert.ok(!canAccess(inY, "tesouraria"));
  }
}

console.log("permissions.test.ts: todos os casos passaram");
