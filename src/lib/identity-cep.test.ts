/**
 * Testes unitários de CEP seq + normalização DeMolay.
 * Executar: npx tsx src/lib/identity-cep.test.ts
 */
import assert from "node:assert/strict";
import { createCepLookupSeq } from "./cep";
import { normalizeDemolayId } from "./member-identity";

// --- createCepLookupSeq: troca de registro invalida lookup pendente ---
{
  const seq = createCepLookupSeq();
  const reqA = seq.begin();
  assert.equal(seq.isCurrent(reqA), true);

  // Simula troca de registro (cepResetKey) enquanto a busca A ainda está em voo.
  seq.invalidate();
  assert.equal(
    seq.isCurrent(reqA),
    false,
    "resposta pendente do registro anterior não deve passar isCurrent",
  );

  const reqB = seq.begin();
  assert.equal(seq.isCurrent(reqB), true);
  assert.equal(seq.isCurrent(reqA), false);
}

// --- normalizeDemolayId: ordem trim → strip → lower (paridade SQL) ---
assert.equal(normalizeDemolayId("ab-12"), "ab12");
assert.equal(normalizeDemolayId("  AB 12 "), "ab12");
assert.equal(
  normalizeDemolayId("İ"),
  "",
  "İ fora de [A-Za-z0-9] é removido antes do lower",
);
assert.equal(
  normalizeDemolayId("K"),
  "",
  "K (Kelvin) fora de [A-Za-z0-9] é removido",
);
assert.equal(normalizeDemolayId("12-345"), "12345");
assert.equal(normalizeDemolayId("12 345"), "12345");

console.log("identity-cep.test.ts: ok");
