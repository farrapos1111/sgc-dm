/**
 * Testes de parseChargeAmount + schema upsertMemberCharge (amount).
 * Executar: npx tsx src/lib/charge-amount.test.ts
 */
import assert from "node:assert/strict";
import {
  memberChargeAmountSchema,
  parseChargeAmount,
} from "./charge-amount";

// parseChargeAmount — rejeições
assert.equal(parseChargeAmount("0"), null);
assert.equal(parseChargeAmount("0.009"), null);
assert.equal(parseChargeAmount(String(Number.NaN)), null);
assert.equal(parseChargeAmount(String(Number.POSITIVE_INFINITY)), null);
assert.equal(parseChargeAmount("-1"), null);
assert.equal(parseChargeAmount(""), null);

// parseChargeAmount — aceitações
assert.equal(parseChargeAmount("0.01"), 0.01);
assert.equal(parseChargeAmount("0,01"), 0.01);
assert.equal(parseChargeAmount("10"), 10);
assert.equal(parseChargeAmount("10,5"), 10.5);

// Schema servidor (upsertMemberCharge.amount) — mesmo contrato
assert.equal(memberChargeAmountSchema.safeParse(0).success, false);
assert.equal(memberChargeAmountSchema.safeParse(0.009).success, false);
assert.equal(memberChargeAmountSchema.safeParse(Number.NaN).success, false);
assert.equal(
  memberChargeAmountSchema.safeParse(Number.POSITIVE_INFINITY).success,
  false,
);
assert.equal(memberChargeAmountSchema.safeParse(0.01).success, true);
assert.equal(memberChargeAmountSchema.safeParse(10).success, true);

// Paridade UI ↔ servidor para "0,01"
{
  const parsed = parseChargeAmount("0,01");
  assert.ok(parsed != null);
  assert.equal(memberChargeAmountSchema.safeParse(parsed).success, true);
}

console.log("charge-amount.test.ts: ok");
