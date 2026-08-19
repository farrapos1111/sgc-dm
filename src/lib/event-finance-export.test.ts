/**
 * Executar: npx tsx src/lib/event-finance-export.test.ts
 */
import assert from "node:assert/strict";
import {
  summarizeComandaReport,
  eventReportExpenseSlices,
  eventReportVisualSpent,
  cleanEventCashLabel,
  eventCashRowLabel,
  formatPdfBRL,
  buildEventReportAnalysis,
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
assert.equal(
  cleanEventCashLabel(
    "Evento Dia dos Pais - Despesa Alimentos e Suprimentos - R$ 2.500,00",
  ),
  "Alimentos e Suprimentos",
);
assert.equal(
  eventCashRowLabel({
    subcategory: "Evento Dia dos Pais -",
    description:
      "Evento Dia dos Pais - Despesa Impressao de Cartinhas - R$ 92,50",
  }),
  "Impressao de Cartinhas",
);
assert.equal(formatPdfBRL(1935.62), "R$ 1.935,62");

const analysis = buildEventReportAnalysis(totalsForVisual);
assert.ok(analysis.some((l) => l.includes("Cerveja")));
assert.ok(analysis.some((l) => l.includes("lucro")));
assert.ok(analysis.some((l) => l.includes("fluxo de caixa")));

console.log("event-finance-export.test.ts: ok");
