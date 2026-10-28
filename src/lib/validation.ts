import { z } from "zod";
import { todayYmd } from "@/lib/timezone";

/**
 * Schemas Zod compartilhados entre formulários e server functions.
 * Campos opcionais aceitam "" (formulário vazio); quando preenchidos, precisam
 * ter formato válido. Mensagens em português, prontas para a UI.
 */

const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** CPF com dígitos verificadores (rejeita sequências repetidas). */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test(raw.trim());
}

/** Telefone BR: 10–11 dígitos, ou 12–13 com DDI. */
export function isValidPhone(raw: string): boolean {
  const n = onlyDigits(raw).length;
  return n >= 10 && n <= 13;
}

/** Data YYYY-MM-DD existente no calendário. */
export function isValidYmd(raw: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  );
}

function isPlausibleBirthDate(raw: string): boolean {
  return isValidYmd(raw) && raw >= "1900-01-01" && raw <= todayYmd();
}

const blankOr =
  (check: (v: string) => boolean) =>
  (v: string | null | undefined): boolean =>
    !v || !v.trim() || check(v);

export const optionalCpf = z
  .string()
  .max(20)
  .optional()
  .default("")
  .refine(blankOr(isValidCpf), "CPF inválido. Confira os dígitos.");

export const requiredCpf = z
  .string()
  .min(1, "Informe o CPF")
  .max(20)
  .refine(isValidCpf, "CPF inválido. Confira os dígitos.");

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .default("")
  .refine(blankOr(isValidEmail), "E-mail inválido.");

export const requiredEmail = z
  .string()
  .trim()
  .min(1, "Informe o e-mail")
  .max(254)
  .refine(isValidEmail, "E-mail inválido.");

export const optionalPhone = z
  .string()
  .max(30)
  .optional()
  .default("")
  .refine(blankOr(isValidPhone), "Telefone inválido. Use DDD + número.");

export const requiredPhone = (message: string) =>
  z
    .string()
    .min(1, message)
    .max(30)
    .refine(isValidPhone, "Telefone inválido. Use DDD + número.");

export const optionalCep = z
  .string()
  .max(12)
  .optional()
  .default("")
  .refine(blankOr((v) => onlyDigits(v).length === 8), "CEP inválido (8 dígitos).");

export const requiredCep = z
  .string()
  .min(1, "Informe o CEP")
  .max(12)
  .refine((v) => onlyDigits(v).length === 8, "CEP inválido (8 dígitos).");

export const optionalBirthDate = z
  .string()
  .max(10)
  .optional()
  .nullable()
  .refine(blankOr(isPlausibleBirthDate), "Data de nascimento inválida.");

export const requiredBirthDate = z
  .string()
  .min(1, "Informe a data de nascimento")
  .refine(isPlausibleBirthDate, "Data de nascimento inválida.");

/** Teto de sanidade para valores em R$ (evita erro de digitação com zeros a mais). */
export const MAX_MONEY = 1_000_000;

const hasCents = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

export const moneyPositive = () =>
  z
    .number()
    .positive("O valor precisa ser maior que zero.")
    .max(MAX_MONEY, "Valor acima do limite permitido.")
    .refine(hasCents, "Use no máximo 2 casas decimais.");

export const moneyNonNegative = () =>
  z
    .number()
    .nonnegative("O valor não pode ser negativo.")
    .max(MAX_MONEY, "Valor acima do limite permitido.")
    .refine(hasCents, "Use no máximo 2 casas decimais.");
