/** Soma de caixa em centavos — evita deriva IEEE em R$ (9,70 + 9,70…). */

export function moneyCents(amount: number | string | null | undefined): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToMoney(cents: number): number {
  return cents / 100;
}

export type CashTotals = {
  income: number;
  expense: number;
  balance: number;
};

export function cashTotalsFromCents(incomeCents: number, expenseCents: number): CashTotals {
  return {
    income: centsToMoney(incomeCents),
    expense: centsToMoney(expenseCents),
    balance: centsToMoney(incomeCents - expenseCents),
  };
}

/** Totais a partir dos lançamentos visíveis (saída só com kind === "saida"). */
export function sumCashByKind(
  entries: Array<{ kind?: string | null; amount?: number | string | null }>,
): CashTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const e of entries) {
    const cents = moneyCents(e.amount);
    if (e.kind === "entrada") incomeCents += cents;
    else if (e.kind === "saida") expenseCents += cents;
  }
  return cashTotalsFromCents(incomeCents, expenseCents);
}

export function roundCashTotals(totals: CashTotals): CashTotals {
  return cashTotalsFromCents(moneyCents(totals.income), moneyCents(totals.expense));
}
