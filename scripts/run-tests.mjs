// Roda cada src/**/*.test.ts com tsx (os testes usam node:assert direto,
// sem framework). Sai com código ≠ 0 se algum arquivo falhar.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function findTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findTests(full));
    else if (name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const files = findTests("src").sort();
let failed = 0;
for (const file of files) {
  const res = spawnSync("npx", ["tsx", file], { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    failed++;
    console.error(`✗ ${file}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} arquivos de teste passaram`);
process.exit(failed ? 1 : 0);
