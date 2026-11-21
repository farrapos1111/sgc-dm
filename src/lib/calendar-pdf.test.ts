/**
 * Executar: npx tsx src/lib/calendar-pdf.test.ts
 */
import assert from "node:assert/strict";
import { layoutCalendarRows } from "./calendar-pdf";

const mk = (iso: string) => ({
  start_at: iso,
  end_at: null,
  typeLabel: "Sessão",
  title: "x",
});

// Jul: 4, Ago: 5, Set: 7 (quebra em 5 + 2), Out: 1 → 5 linhas → 2 páginas (3 + 2)
const items = [
  ...[6, 13, 20, 27].map((d) => mk(`2026-07-${String(d).padStart(2, "0")}T20:00:00-03:00`)),
  ...[3, 10, 17, 24, 31].map((d) => mk(`2026-08-${String(d).padStart(2, "0")}T20:00:00-03:00`)),
  ...[1, 2, 3, 4, 5, 6, 7].map((d) => mk(`2026-09-0${d}T20:00:00-03:00`)),
  mk("2026-10-05T20:00:00-03:00"),
];
const pages = layoutCalendarRows(items, "2026-08-15");
assert.equal(pages.length, 2);
assert.deepEqual(pages[0].map((r) => r.length), [4, 5, 5]);
assert.deepEqual(pages[1].map((r) => r.length), [2, 1]);
assert.ok(pages.flat(2).every((c) => c.dayKey < "2026-08-15" === c.past));
assert.deepEqual(layoutCalendarRows([], "2026-01-01"), []);
console.log("calendar-pdf ok");
