/**
 * Executar: npx tsx src/lib/cash-totals.test.ts
 */
import assert from "node:assert/strict";
import { sumCashByKind, moneyCents, roundCashTotals } from "./cash-totals";
import { cashEntryMatchesCharge, chargeCashDescription } from "./cash-categories";

assert.equal(moneyCents("9.70"), 970);
assert.equal(moneyCents(9.7), 970);

const summed = sumCashByKind([
  { kind: "entrada", amount: "9.70" },
  { kind: "entrada", amount: 9.7 },
  { kind: "saida", amount: "1.10" },
  { kind: "outro", amount: 50 },
]);
assert.equal(summed.income, 19.4);
assert.equal(summed.expense, 1.1);
assert.equal(summed.balance, 18.3);

const rounded = roundCashTotals({ income: 21343.6900000003, expense: 22242.79, balance: 0 });
assert.equal(rounded.income, 21343.69);
assert.equal(rounded.expense, 22242.79);
assert.equal(rounded.balance, -899.1);

assert.equal(
  chargeCashDescription("Taxa de Iniciação", "Vinícius Menegol Cardoso"),
  "Taxa de Iniciação - Vinícius Menegol Cardoso",
);
assert.equal(
  chargeCashDescription(
    "Taxa de Elevação - Arthur Tonet Pagliarin",
    "Arthur Tonet Pagliarin",
  ),
  "Taxa de Elevação - Arthur Tonet Pagliarin",
);
assert.equal(
  chargeCashDescription("Presente do Emmanuel - Braian Roldo", "Braian Roldo Visona"),
  "Presente do Emmanuel - Braian Roldo",
);
assert.equal(
  chargeCashDescription(
    "Ingresso Evento Dia dos Pais - Mateus Faggion",
    "João Alfredo da Silva Faggion",
  ),
  "Ingresso Evento Dia dos Pais - Mateus Faggion - João Alfredo da Silva Faggion",
);

assert.equal(
  cashEntryMatchesCharge({
    cashDescription: "Presente do Emmanuel - Arthur Toigo",
    cashAmount: 9.7,
    chargeDescription: "Presente do Emmanuel",
    memberName: "Arthur Toigo de Campos",
    payAmount: "9.70",
  }),
  true,
);
assert.equal(
  cashEntryMatchesCharge({
    cashDescription: "Presente do Emmanuel - Henrique Rodriguês Klipp da Anunciação",
    cashAmount: 9.7,
    chargeDescription: "Presente do Emmanuel",
    memberName: "Arthur Toigo de Campos",
    payAmount: 9.7,
  }),
  false,
);
assert.equal(
  cashEntryMatchesCharge({
    cashDescription: "Transporte para o CROD - Arthur Adami Gaio",
    cashAmount: 20,
    chargeDescription: "Transporte para o Crod",
    memberName: "Arthur Tonet Pagliarin",
    payAmount: 20,
  }),
  false,
);

console.log("cash-totals.test.ts: ok");
