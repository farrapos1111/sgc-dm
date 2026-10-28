/**
 * Paridade entre a matriz de cargos em TypeScript (permissions.ts) e a função
 * SQL has_permission (última migration que a define). Falha quando alguém muda
 * só uma das pontas — a UI esconderia o botão e o banco aceitaria a escrita,
 * ou o contrário.
 * Executar: npx tsx src/lib/permissions-sql-parity.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permissionsOf, type Permission } from "./permissions";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const ROLES = [
  "admin_total",
  "mestre_conselheiro",
  "consultor",
  "presidente_conselho",
  "escrivao",
  "tesoureiro",
  "presidente_comissao",
  "membro",
] as const;
const CHECKED: Permission[] = ["admin", "secretaria", "tesouraria", "comissoes", "conselho"];

function latestHasPermissionSql(): string {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let body: string | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");
    const start = sql.indexOf("FUNCTION public.has_permission(_chapter_id uuid, _perm text)");
    if (start === -1) continue;
    const end = sql.indexOf("$$;", sql.indexOf("AS $$", start));
    body = sql.slice(start, end);
  }
  assert.ok(body, "has_permission não encontrada nas migrations");
  return body;
}

/** Cargos de conta (has_any_role) aceitos em cada WHEN do CASE. */
function sqlRolesByPermission(body: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const blocks = body.split(/\n\s*WHEN '/).slice(1);
  for (const block of blocks) {
    const perm = block.slice(0, block.indexOf("'"));
    const roles = new Set<string>();
    for (const m of block.matchAll(/has_any_role\(_chapter_id,\s*ARRAY\[([^\]]+)\]\)/g)) {
      for (const r of m[1].matchAll(/'([a-z_]+)'/g)) roles.add(r[1]);
    }
    out.set(perm, roles);
  }
  return out;
}

const sql = sqlRolesByPermission(latestHasPermissionSql());

for (const perm of CHECKED) {
  const sqlRoles = sql.get(perm);
  assert.ok(sqlRoles, `has_permission não trata '${perm}'`);
  const tsRoles = ROLES.filter((r) => permissionsOf(r).includes(perm));
  assert.deepEqual(
    [...sqlRoles].sort(),
    [...tsRoles].sort(),
    `Divergência em '${perm}': SQL=${[...sqlRoles].sort().join(",")} TS=${tsRoles.sort().join(",")}`,
  );
}

console.log("permissions-sql-parity.test.ts: matriz TS e has_permission conferem");
