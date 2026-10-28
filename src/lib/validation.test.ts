/**
 * Testes dos validadores compartilhados e da tradução de erros do servidor.
 * Executar: npx tsx src/lib/validation.test.ts
 */
import assert from "node:assert/strict";
import { z } from "zod";
import {
  isValidCpf,
  isValidPhone,
  isValidYmd,
  moneyPositive,
  optionalBirthDate,
  optionalCpf,
  optionalEmail,
} from "./validation";
import { userFacingMessage } from "./error-sanitize";

// CPF
assert.equal(isValidCpf("529.982.247-25"), true);
assert.equal(isValidCpf("52998224725"), true);
assert.equal(isValidCpf("529.982.247-24"), false);
assert.equal(isValidCpf("111.111.111-11"), false);
assert.equal(isValidCpf("123"), false);
assert.equal(optionalCpf.safeParse("").success, true);
assert.equal(optionalCpf.safeParse(undefined).success, true);
assert.equal(optionalCpf.safeParse("123.456.789-00").success, false);

// E-mail / telefone
assert.equal(optionalEmail.safeParse("").success, true);
assert.equal(optionalEmail.safeParse("fulano@exemplo.com").success, true);
assert.equal(optionalEmail.safeParse("fulano@").success, false);
assert.equal(isValidPhone("(51) 99999-8888"), true);
assert.equal(isValidPhone("+55 51 99999-8888"), true);
assert.equal(isValidPhone("9999-8888"), false);

// Datas
assert.equal(isValidYmd("2024-02-29"), true);
assert.equal(isValidYmd("2023-02-29"), false);
assert.equal(isValidYmd("29/02/2024"), false);
assert.equal(optionalBirthDate.safeParse(null).success, true);
assert.equal(optionalBirthDate.safeParse("").success, true);
assert.equal(optionalBirthDate.safeParse("2010-05-17").success, true);
assert.equal(optionalBirthDate.safeParse("1850-01-01").success, false);
assert.equal(optionalBirthDate.safeParse("2999-01-01").success, false);

// Dinheiro
assert.equal(moneyPositive().safeParse(19.99).success, true);
assert.equal(moneyPositive().safeParse(0.1 + 0.2).success, true); // ruído de float, 0,30
assert.equal(moneyPositive().safeParse(1.234).success, false);
assert.equal(moneyPositive().safeParse(0).success, false);
assert.equal(moneyPositive().safeParse(5_000_000).success, false);

// Tradução de erros
assert.equal(
  userFacingMessage(new Error('new row violates row-level security policy for table "members"')),
  "Você não tem permissão para esta ação.",
);
assert.equal(
  userFacingMessage(
    new Error('new row for relation "members" violates check constraint "members_email_format_ck"'),
  ),
  "E-mail inválido. Confira o endereço informado.",
);
assert.equal(userFacingMessage(new Error("Membro não encontrado")), null);
const zodErr = z.object({ cpf: optionalCpf }).safeParse({ cpf: "000" });
assert.ok(!zodErr.success);
assert.equal(userFacingMessage(zodErr.error), "CPF inválido. Confira os dígitos.");

console.log("validation.test.ts: ok");
