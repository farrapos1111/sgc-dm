import assert from "node:assert/strict";
import {
  addDaysYmd,
  eventDisplayStatus,
  eventFinanceCloseYmd,
  eventStartYmd,
  isEventFinanceOpen,
} from "./event-lifecycle";

assert.equal(addDaysYmd("2026-01-01", 30), "2026-01-31");
assert.equal(addDaysYmd("2026-01-15", 30), "2026-02-14");

// starts_at UTC that is clearly 2026-03-10 in Sao Paulo depends on hour;
// use noon UTC to stay on the same civil day in BR.
const starts = "2026-03-10T15:00:00.000Z";
assert.equal(eventStartYmd(starts), "2026-03-10");
assert.equal(eventFinanceCloseYmd(starts), "2026-04-09");

assert.equal(
  isEventFinanceOpen(starts, "publicado", new Date("2026-04-09T15:00:00.000Z")),
  true,
);
assert.equal(
  isEventFinanceOpen(starts, "publicado", new Date("2026-04-10T15:00:00.000Z")),
  false,
);
assert.equal(isEventFinanceOpen(starts, "encerrado", new Date("2026-03-11")), false);

assert.equal(
  eventDisplayStatus(starts, "publicado", new Date("2026-04-10T15:00:00.000Z")),
  "fechado",
);
assert.equal(
  eventDisplayStatus(starts, "rascunho", new Date("2026-04-10T15:00:00.000Z")),
  "rascunho",
);

console.log("event-lifecycle.test.ts: ok");
