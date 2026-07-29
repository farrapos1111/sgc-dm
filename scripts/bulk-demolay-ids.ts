/**
 * Atualização em massa de demolay_id no capítulo Farrapos.
 *
 * 1. Cole a lista em scripts/farrapos-demolay-ids.txt (uma por linha):
 *      Nome Completo - 123456
 *
 * 2. Dry-run (só mostra o que faria):
 *      npx tsx scripts/bulk-demolay-ids.ts
 *
 * 3. Aplicar de verdade:
 *      npx tsx scripts/bulk-demolay-ids.ts --apply
 *
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const LIST_FILE = resolve(SCRIPT_DIR, "farrapos-demolay-ids.txt");
const CHAPTER_NAME = "Farrapos";
const APPLY = process.argv.includes("--apply");

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseList(raw: string): { name: string; id: string; line: number }[] {
  const rows: { name: string; id: string; line: number }[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    // "Nome - ID" (último hífen separa, para nomes com hífen)
    const m = trimmed.match(/^(.+?)\s*[-–—]\s*(\S+)\s*$/);
    if (!m) {
      console.warn(`Linha ${i + 1} ignorada (formato esperado: Nome - ID): ${trimmed}`);
      return;
    }
    rows.push({ name: m[1].trim(), id: m[2].trim(), line: i + 1 });
  });
  return rows;
}

async function main() {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      [
        "Falta SUPABASE_SERVICE_ROLE_KEY no .env.local (a chave anon não serve).",
        "Opções:",
        "  1) Dashboard Supabase → Project Settings → API → service_role → cole no .env.local",
        "  2) Ou rode o SQL pronto: scripts/farrapos-demolay-ids.sql no SQL Editor",
      ].join("\n"),
    );
    process.exit(1);
  }
  if (!existsSync(LIST_FILE)) {
    console.error(`Arquivo não encontrado: ${LIST_FILE}`);
    console.error("Crie o arquivo com linhas no formato: Nome Completo - 123456");
    process.exit(1);
  }

  const list = parseList(readFileSync(LIST_FILE, "utf8"));
  if (list.length === 0) {
    console.error("Lista vazia.");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: chapters, error: chErr } = await supabase
    .from("chapters")
    .select("id, name, number")
    .ilike("name", `%${CHAPTER_NAME}%`);
  if (chErr) throw new Error(chErr.message);
  if (!chapters?.length) {
    console.error(`Capítulo "${CHAPTER_NAME}" não encontrado.`);
    process.exit(1);
  }
  if (chapters.length > 1) {
    console.error("Mais de um capítulo bateu com Farrapos:");
    for (const c of chapters) console.error(`  - ${c.name} (#${c.number}) ${c.id}`);
    process.exit(1);
  }
  const chapter = chapters[0];
  console.log(`Capítulo: ${chapter.name} (#${chapter.number}) ${chapter.id}`);
  console.log(`Modo: ${APPLY ? "APLICAR" : "DRY-RUN (passe --apply para gravar)"}\n`);

  const { data: members, error: mErr } = await supabase
    .from("members")
    .select("id, full_name, demolay_id")
    .eq("chapter_id", chapter.id)
    .order("full_name");
  if (mErr) throw new Error(mErr.message);

  const byNorm = new Map<string, typeof members>();
  for (const m of members ?? []) {
    const key = normalizeName(m.full_name);
    const arr = byNorm.get(key) ?? [];
    arr.push(m);
    byNorm.set(key, arr);
  }

  let ok = 0;
  let skipped = 0;
  let missing = 0;
  let ambiguous = 0;

  for (const row of list) {
    const key = normalizeName(row.name);
    const matches = byNorm.get(key) ?? [];
    if (matches.length === 0) {
      console.log(`✗ NÃO ENCONTRADO  L${row.line}  ${row.name} → ${row.id}`);
      missing++;
      continue;
    }
    if (matches.length > 1) {
      console.log(`? AMBÍGUO         L${row.line}  ${row.name} → ${row.id}`);
      for (const m of matches) console.log(`    ${m.id}  ${m.full_name}  (atual: ${m.demolay_id ?? "—"})`);
      ambiguous++;
      continue;
    }
    const member = matches[0];
    if (member.demolay_id === row.id) {
      console.log(`= JÁ ATUALIZADO   ${member.full_name} → ${row.id}`);
      skipped++;
      continue;
    }
    console.log(
      `→ ATUALIZAR       ${member.full_name}  (${member.demolay_id ?? "—"} → ${row.id})`,
    );
    if (APPLY) {
      const { error } = await supabase
        .from("members")
        .update({ demolay_id: row.id })
        .eq("id", member.id)
        .eq("chapter_id", chapter.id);
      if (error) {
        console.error(`  ERRO: ${error.message}`);
        continue;
      }
    }
    ok++;
  }

  console.log(`\nResumo: ${ok} ok · ${skipped} já ok · ${missing} não encontrados · ${ambiguous} ambíguos`);
  if (!APPLY && ok > 0) {
    console.log("Nada foi gravado. Rode de novo com --apply para aplicar.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
