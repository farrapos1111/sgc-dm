import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(dir, "farrapos-demolay-ids.txt"), "utf8");
const rows = [];
for (const [i, line] of raw.split(/\r?\n/).entries()) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const m = t.match(/^(.+?)\s*[-–—]\s*(\S+)\s*$/);
  if (!m) {
    console.error("bad line", i + 1, t);
    continue;
  }
  rows.push([m[1].trim(), m[2].trim()]);
}

function esc(s) {
  return s.replace(/'/g, "''");
}

const values = rows.map(([n, id]) => `  ('${esc(n)}', '${esc(id)}')`).join(",\n");
const accentFrom = "ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ";
const accentTo = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn";

const sql = `-- Atualiza demolay_id dos membros do Farrapos
-- Cole no SQL Editor do Supabase e execute.
-- Retorna as linhas atualizadas.

WITH chapter AS (
  SELECT id FROM public.chapters
  WHERE name ILIKE '%Farrapos%'
  LIMIT 1
),
updates(full_name, demolay_id) AS (
  VALUES
${values}
),
norm AS (
  SELECT
    full_name,
    demolay_id,
    lower(translate(full_name, '${accentFrom}', '${accentTo}')) AS name_key
  FROM updates
),
matched AS (
  UPDATE public.members m
  SET demolay_id = n.demolay_id,
      updated_at = now()
  FROM norm n, chapter c
  WHERE m.chapter_id = c.id
    AND lower(translate(m.full_name, '${accentFrom}', '${accentTo}')) = n.name_key
  RETURNING m.full_name, m.demolay_id
)
SELECT * FROM matched
ORDER BY full_name;
`;

const checkSql = `
-- Conferir quem da lista NÃO bateu (rode depois do UPDATE):
WITH chapter AS (
  SELECT id FROM public.chapters WHERE name ILIKE '%Farrapos%' LIMIT 1
),
updates(full_name, demolay_id) AS (
  VALUES
${values}
)
SELECT u.full_name, u.demolay_id AS id_esperado
FROM updates u
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m, chapter c
  WHERE m.chapter_id = c.id
    AND lower(translate(m.full_name, '${accentFrom}', '${accentTo}'))
      = lower(translate(u.full_name, '${accentFrom}', '${accentTo}'))
)
ORDER BY u.full_name;
`;

writeFileSync(resolve(dir, "farrapos-demolay-ids.sql"), sql + "\n" + checkSql);
console.log(`OK: ${rows.length} linhas → scripts/farrapos-demolay-ids.sql`);
