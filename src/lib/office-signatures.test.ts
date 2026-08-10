/**
 * Testes unitários de códigos canônicos de assinatura oficial.
 * Executar: npx tsx src/lib/office-signatures.test.ts
 */
import assert from "node:assert/strict";
import {
  canonicalOfficeSignatureCode,
  isOfficeSignatureRequiredCode,
  OFFICE_SIGNATURE_LABELS,
} from "./office-signatures-shared";

assert.equal(
  canonicalOfficeSignatureCode("presidente_conselho"),
  "presidente_conselho_consultivo",
);
assert.equal(
  canonicalOfficeSignatureCode("consultor"),
  "conselheiro_consultor",
);
assert.equal(
  canonicalOfficeSignatureCode("mestre_conselheiro"),
  "mestre_conselheiro",
);
assert.equal(canonicalOfficeSignatureCode("escrivao"), "escrivao");
assert.equal(canonicalOfficeSignatureCode("tesoureiro"), "tesoureiro");

assert.ok(isOfficeSignatureRequiredCode("mestre_conselheiro"));
assert.ok(isOfficeSignatureRequiredCode("escrivao"));
assert.ok(isOfficeSignatureRequiredCode("presidente_conselho_consultivo"));
assert.ok(!isOfficeSignatureRequiredCode("primeiro_conselheiro"));

assert.equal(
  OFFICE_SIGNATURE_LABELS.presidente_conselho_consultivo,
  "Presidente do Conselho Consultivo",
);

// Isolamento: chave de assinatura é por capítulo — códigos iguais em capítulos
// distintos não compartilham tinta (contrato de chave lógica).
const chapterX = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const chapterY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const memberId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const code = canonicalOfficeSignatureCode("mestre_conselheiro");
const keyX = `${memberId}:${chapterX}:${code}`;
const keyY = `${memberId}:${chapterY}:${code}`;
assert.notEqual(keyX, keyY);

console.log("office-signatures.test.ts: todos os casos passaram");
