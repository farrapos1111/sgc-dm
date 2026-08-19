/**
 * Executar: npx tsx src/lib/event-finance-export.test.ts
 */
import assert from "node:assert/strict";
import {
  summarizeComandaReport,
  eventReportExpenseSlices,
  eventReportVisualSpent,
  formatPdfBRL,
  buildEventReportAnalysis,
  formatEventCashRowTexts,
  stripMoneyFromLabel,
  buildSimpleEventExpenseLines,
  buildSimpleEventIncomeLines,
  resolveCashTableColumns,
  type ComandaReportRow,
} from "./event-finance-export";

const rows: ComandaReportRow[] = [
  {
    buyer_name: "Ana",
    seller_name: "Carlos",
    ticket_type_name: "Sócio",
    ticket_amount: 50,
    ticket_paid_amount: 20,
    settlement: "partial",
    items: [
      { name: "Refrigerante", qty: 2, unit_price: 5, amount: 10, paid: false },
      { name: "Cerveja", qty: 1, unit_price: 8, amount: 8, paid: true },
    ],
  },
  {
    buyer_name: "Bruno",
    seller_name: "Carlos",
    ticket_type_name: "Convidado",
    ticket_amount: 40,
    ticket_paid_amount: 40,
    settlement: "paid",
    items: [],
  },
];

const summary = summarizeComandaReport(rows);
assert.equal(summary.paid, 68);
assert.equal(summary.open, 40);
assert.equal(summary.openLines.length, 2);
assert.equal(summary.openLines[0]?.label, "Ingresso · Sócio");
assert.equal(summary.openLines[0]?.amount, 30);
assert.equal(summary.openLines[1]?.label, "Refrigerante × 2");
assert.equal(summary.openLines[1]?.amount, 10);

const expenseSlices = eventReportExpenseSlices({
  totalIncome: 100,
  totalExpense: 50,
  total: 50,
  ticketsIncome: 80,
  otherIncome: 20,
  paid: 100,
  spent: 50,
  open: 10,
  openLines: [],
  byCategory: [
    {
      categoryId: "bar",
      name: "Bar",
      income: 20,
      expense: 20,
    },
  ],
  byItem: [],
  entries: [],
  scheduledEntries: [],
  scheduledExpense: 30,
});
assert.equal(expenseSlices.length, 2);
assert.equal(expenseSlices[0]?.label, "Bar");
assert.equal(expenseSlices[0]?.value, 20);
assert.equal(expenseSlices[1]?.label, "Orçamento");
assert.equal(expenseSlices[1]?.value, 60);

const totalsForVisual = {
  totalIncome: 100,
  totalExpense: 50,
  total: 50,
  ticketsIncome: 80,
  otherIncome: 20,
  paid: 100,
  spent: 50,
  open: 10,
  openLines: [],
  byCategory: [
    {
      categoryId: "bar",
      name: "Bar",
      income: 80,
      expense: 20,
    },
  ],
  byItem: [
    {
      itemId: "1",
      name: "Cerveja",
      categoryId: "bar",
      categoryName: "Bar",
      income: 80,
      expense: 0,
      qty: 10,
    },
  ],
  entries: [],
  scheduledEntries: [],
  scheduledExpense: 30,
};

assert.equal(eventReportVisualSpent(totalsForVisual), 80);
assert.equal(formatPdfBRL(1935.62), "R$ 1.935,62");

const analysis = buildEventReportAnalysis(totalsForVisual);
assert.ok(analysis.some((l) => l.includes("Cerveja")));
assert.ok(analysis.some((l) => l.includes("receita bruta")));
assert.ok(analysis.some((l) => l.includes("receita líquida")));
assert.ok(analysis.some((l) => l.includes("lucro")));
assert.ok(analysis.some((l) => l.includes("fluxo de caixa")));

assert.equal(stripMoneyFromLabel("Decoração - R$ 1.200,00"), "Decoração");
assert.deepEqual(
  formatEventCashRowTexts(
    {
      subcategory: "Evento Drive Thru - Despesa Frango - R$ 764,63",
      description: "Evento Drive Thru - Despesa Frango - R$ 764,63",
    },
    "Drive Thru",
  ),
  { item: "Drive Thru", description: "Drive Thru - Frango" },
);
assert.deepEqual(
  formatEventCashRowTexts(
    { subcategory: "Drive Thru", description: "Drive Thru - Limpeza" },
    "Drive Thru",
  ),
  { item: "Drive Thru", description: "Drive Thru - Limpeza" },
);

const simpleTotals = {
  ...totalsForVisual,
  paid: 100,
  open: 25,
  entries: [
    {
      id: "e1",
      kind: "saida",
      amount: 50,
      subcategory: "Drive Thru",
      description: "Drive Thru - Insumos",
      entry_date: "2026-04-15",
      event_finance_item_id: "x",
    },
  ],
  scheduledEntries: [
    {
      id: "e2",
      kind: "saida",
      amount: 20,
      subcategory: "Drive Thru",
      description: "Drive Thru - Insumos",
      entry_date: "2026-05-01",
      event_finance_item_id: "x",
    },
  ],
};
const expenseLines = buildSimpleEventExpenseLines(simpleTotals, "Drive Thru");
assert.equal(expenseLines.length, 1);
assert.equal(expenseLines[0]?.label, "Insumos");
assert.equal(expenseLines[0]?.amount, 70);
const incomeLines = buildSimpleEventIncomeLines(simpleTotals);
assert.ok(incomeLines.some((l) => l.label === "Cerveja" && l.amount === 80));
assert.ok(incomeLines.some((l) => l.label === "Valores em aberto" && l.amount === 25));

const allOff = resolveCashTableColumns(
  resolveCashTableColumns().map((c) => ({ ...c, enabled: false })),
);
assert.ok(allOff.some((c) => c.id === "amount" && c.enabled));

console.log("event-finance-export.test.ts: ok");
