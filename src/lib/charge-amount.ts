import { z } from "zod";

/** Valor monetário da cobrança: finito e ≥ R$ 0,01. */
export function parseChargeAmount(raw: string): number | null {
  const amount = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0.01) return null;
  return amount;
}

/** Schema Zod compartilhado com upsertMemberCharge (contrato UI ↔ servidor). */
export const memberChargeAmountSchema = z
  .number()
  .finite()
  .min(0.01, "O valor da cobrança deve ser pelo menos R$ 0,01");
