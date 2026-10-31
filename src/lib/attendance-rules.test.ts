/**
 * Executar: npx tsx src/lib/attendance-rules.test.ts
 */
import assert from "node:assert/strict";
import {
  attendanceCountLabel,
  eventCountsForAttendance,
  supportsAttendance,
} from "./calendar-types";
import { memberEligibleForAttendance, type DueMemberLite } from "./dues-rules";
import { fromAppTzDateTimeLocal } from "./timezone";

// Só sessões e filantropia têm chamada.
assert.equal(supportsAttendance("sessao_ritualistica"), true);
assert.equal(supportsAttendance("sessao_administrativa"), true);
assert.equal(supportsAttendance("filantropia"), true);
assert.equal(supportsAttendance("evento"), false);
assert.equal(supportsAttendance("entretenimento"), false);
assert.equal(supportsAttendance("sindicancia"), false);

// Conta na frequência: tipo com chamada E obrigatório.
assert.equal(
  eventCountsForAttendance({ event_type: "sessao_ritualistica", mandatory: true }),
  true,
);
assert.equal(
  eventCountsForAttendance({ event_type: "filantropia", mandatory: true }),
  true,
);
assert.equal(
  eventCountsForAttendance({ event_type: "sessao_ritualistica", mandatory: false }),
  false,
);
// Evento/entretenimento obrigatórios não contam.
assert.equal(eventCountsForAttendance({ event_type: "evento", mandatory: true }), false);
assert.equal(
  eventCountsForAttendance({ event_type: "entretenimento", mandatory: true }),
  false,
);
assert.equal(attendanceCountLabel({ event_type: "evento", mandatory: true }), "Não conta");
assert.equal(
  attendanceCountLabel({ event_type: "filantropia", mandatory: false }),
  "Facultativo",
);
assert.equal(
  attendanceCountLabel({ event_type: "sessao_administrativa", mandatory: true }),
  "Contabilizável",
);

// Elegibilidade usa a data no fuso do app (São Paulo), não o dia em UTC.
const base: DueMemberLite = {
  id: "m",
  full_name: "Membro",
  status: "regular",
  kind: "demolay_ativo",
  birth_date: "2010-01-01",
  iniciacao_ordem: "2026-05-10",
};
const at = (local: string) => fromAppTzDateTimeLocal(local).toISOString();

// Sessão às 21h da véspera da iniciação: em UTC já é o dia 10, mas não conta.
assert.equal(memberEligibleForAttendance(base, at("2026-05-09T21:00")), false);
assert.equal(memberEligibleForAttendance(base, at("2026-05-09T20:00")), false);
// No próprio dia da iniciação, à noite, conta.
assert.equal(memberEligibleForAttendance(base, at("2026-05-10T21:30")), true);

// Aniversário de 21 anos: a sessão do próprio dia conta, mesmo às 21h+.
const turning21: DueMemberLite = {
  ...base,
  birth_date: "2005-05-10",
  iniciacao_ordem: "2020-01-01",
};
assert.equal(memberEligibleForAttendance(turning21, at("2026-05-10T20:00")), true);
assert.equal(memberEligibleForAttendance(turning21, at("2026-05-10T21:00")), true);
assert.equal(memberEligibleForAttendance(turning21, at("2026-05-11T19:30")), false);

// Data pura (YYYY-MM-DD) continua aceita.
assert.equal(memberEligibleForAttendance(base, "2026-05-10"), true);
assert.equal(memberEligibleForAttendance(base, "2026-05-09"), false);

console.log("attendance-rules: ok");
