import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { centsToMoney, moneyCents } from "@/lib/cash-totals";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  INGRESSOS_CATEGORY_ID,
  type EventFinanceTotals,
  type EventOpenLine,
} from "@/lib/event-finance.functions";

const MARGIN = 15;
const LOGO_MAX = 24;
const COLOR_GREEN = [4, 120, 87] as const;
const COLOR_RED = [185, 28, 28] as const;
const COLOR_BLACK = [26, 26, 26] as const;
const COLOR_GRAY = [107, 107, 107] as const;
const COLOR_AMBER = [180, 83, 9] as const;

type Rgb = readonly [number, number, number];

function setRgb(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function formatEventFinanceHint(totals: EventFinanceTotals) {
  const paid = totals.paid ?? totals.totalIncome;
  const spent = totals.spent ?? totals.totalExpense;
  const open = totals.open ?? 0;
  return `Pago ${formatBRL(paid)}  ·  Gasto ${formatBRL(spent)}  ·  Em aberto ${formatBRL(open)}`;
}

/** Valor em reais só com caracteres do Helvetica (evita aspas no PDF). */
export function formatPdfBRL(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const [intRaw, dec = "00"] = Math.abs(n).toFixed(2).split(".");
  const int = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${int},${dec}`;
}

export function eventReportVisualSpent(totals: EventFinanceTotals): number {
  return (totals.spent ?? totals.totalExpense ?? 0) + (totals.scheduledExpense ?? 0);
}

export const EVENT_FINANCE_REPORT_BLOCKS = [
  { id: "summary", label: "Resumo (entradas, saídas, em aberto)" },
  { id: "open", label: "Ainda em aberto" },
  { id: "categories", label: "Arrecadação por categoria" },
  { id: "income", label: "Entradas" },
  { id: "expense", label: "Saídas" },
  { id: "charts", label: "Gráficos" },
  { id: "analysis", label: "Análise do evento" },
] as const;

export type EventReportBlockId =
  (typeof EVENT_FINANCE_REPORT_BLOCKS)[number]["id"];

export type EventFinanceReportBlockState = {
  id: EventReportBlockId;
  enabled: boolean;
};

export function defaultEventReportBlocks(): EventFinanceReportBlockState[] {
  return EVENT_FINANCE_REPORT_BLOCKS.map((b) => ({
    id: b.id,
    enabled: true,
  }));
}

export const EVENT_CASH_TABLE_COLUMNS = [
  { id: "date", label: "Data" },
  { id: "type", label: "Tipo" },
  { id: "item", label: "Item" },
  { id: "description", label: "Descrição" },
  { id: "amount", label: "Valor" },
] as const;

export type EventCashTableColumnId =
  (typeof EVENT_CASH_TABLE_COLUMNS)[number]["id"];

export type EventCashTableColumnState = {
  id: EventCashTableColumnId;
  enabled: boolean;
};

export function defaultEventCashTableColumns(): EventCashTableColumnState[] {
  return EVENT_CASH_TABLE_COLUMNS.map((c) => ({ id: c.id, enabled: true }));
}

const CASH_COL_WEIGHT: Record<EventCashTableColumnId, number> = {
  date: 22,
  type: 18,
  item: 44,
  description: 52,
  amount: 30,
};

export function resolveCashTableColumns(
  cols?: EventCashTableColumnState[],
): EventCashTableColumnState[] {
  if (!cols?.length) return defaultEventCashTableColumns();
  const known = new Set(EVENT_CASH_TABLE_COLUMNS.map((c) => c.id));
  const seen = new Set<EventCashTableColumnId>();
  const ordered: EventCashTableColumnState[] = [];
  for (const c of cols) {
    if (!known.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    ordered.push({ id: c.id, enabled: c.enabled });
  }
  for (const c of EVENT_CASH_TABLE_COLUMNS) {
    if (!seen.has(c.id)) ordered.push({ id: c.id, enabled: true });
  }
  if (!ordered.some((c) => c.enabled)) {
    return ordered.map((c) =>
      c.id === "amount" ? { ...c, enabled: true } : c,
    );
  }
  return ordered;
}

export function stripMoneyFromLabel(text: string): string {
  return text.replace(/\s*[-–—]\s*R\$\s*[\d.\s]+,\d{2}\s*$/i, "").trim();
}

/** Item = nome do evento; descrição = evento + despesa, sem valor no texto. */
export function formatEventCashRowTexts(
  row: { subcategory?: string | null; description?: string | null },
  eventName: string,
): { item: string; description: string } {
  const event = eventName.trim();
  const sub = stripMoneyFromLabel((row.subcategory ?? "").trim());
  const desc = stripMoneyFromLabel(
    (row.description ?? row.subcategory ?? "").trim(),
  );

  const old = desc.match(/^(?:Evento\s+)?(.+?)\s+-\s+Despesa\s+(.+)$/i);
  if (old) {
    const name = event || old[1].trim();
    return { item: name, description: `${name} - ${old[2].trim()}` };
  }

  const item = event || sub || "—";
  let description = desc || item;
  if (
    event &&
    description &&
    !description.toLowerCase().startsWith(event.toLowerCase())
  ) {
    description = `${event} - ${description}`;
  }
  return { item: item || "—", description: description || "—" };
}

export function isBudgetLikeCashRow(
  row: { subcategory?: string | null; description?: string | null },
  eventName: string,
): boolean {
  const event = eventName.trim();
  const sub = stripMoneyFromLabel((row.subcategory ?? "").trim());
  const desc = stripMoneyFromLabel(
    (row.description ?? row.subcategory ?? "").trim(),
  );
  if (/\bDespesa\b/i.test(sub) || /\bDespesa\b/i.test(desc)) return true;
  if (event && sub === event) return true;
  return false;
}

export function budgetExpenseShortName(
  row: { subcategory?: string | null; description?: string | null },
  eventName: string,
): string {
  const { description } = formatEventCashRowTexts(row, eventName);
  const event = eventName.trim();
  if (event && description.toLowerCase().startsWith(event.toLowerCase())) {
    return (
      description.slice(event.length).replace(/^\s*[-–—]\s*/, "").trim() ||
      description
    );
  }
  return description;
}

export function buildSimpleEventExpenseLines(
  totals: EventFinanceTotals,
  eventName: string,
): Array<{ label: string; amount: number }> {
  const map = new Map<string, number>();
  const rows = [
    ...totals.entries.filter((e) => e.kind === "saida"),
    ...(totals.scheduledEntries ?? []),
  ];
  for (const e of rows) {
    const label = budgetExpenseShortName(e, eventName);
    map.set(label, (map.get(label) ?? 0) + (Number(e.amount) || 0));
  }
  return [...map.entries()].map(([label, amount]) => ({ label, amount }));
}

export function buildSimpleEventIncomeLines(
  totals: EventFinanceTotals,
): Array<{ label: string; amount: number; qty?: number }> {
  const lines = (totals.byItem ?? [])
    .filter((i) => i.income > 0.001)
    .map((i) => ({
      label: i.name,
      amount: i.income,
      qty: i.qty,
    }));
  const open = totals.open ?? 0;
  if (open > 0.001) {
    lines.push({ label: "Valores em aberto", amount: open });
  }
  return lines;
}

export function formatIssuedAtLong(date = new Date()): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function eventFinanceReportTitle(
  eventName: string,
  gestaoLabel: string,
  kind: "Simplificado" | "Completo",
) {
  return `${eventName} - Gestão ${gestaoLabel} - Relatório ${kind}`;
}

export function buildEventReportAnalysis(totals: EventFinanceTotals): string[] {
  const paid = totals.paid ?? totals.totalIncome;
  const spent = eventReportVisualSpent(totals);
  const open = totals.open ?? 0;
  const gross = paid + open;
  const net = gross - spent;
  const lines: string[] = [];

  const topItem = [...(totals.byItem ?? [])]
    .filter((i) => i.income > 0.001)
    .sort((a, b) => b.income - a.income || (b.qty ?? 0) - (a.qty ?? 0))[0];
  const topCat = [...(totals.byCategory ?? [])]
    .filter((c) => c.income > 0.001)
    .sort((a, b) => b.income - a.income)[0];

  if (topItem) {
    const qty = topItem.qty && topItem.qty > 0 ? `, com ${topItem.qty} un.` : "";
    const cat =
      topCat && topCat.name !== topItem.categoryName
        ? ` (categoria ${topItem.categoryName})`
        : "";
    lines.push(
      `A maior arrecadação veio de ${topItem.name}${qty}: ${formatPdfBRL(topItem.income)}${cat}.`,
    );
  } else if (topCat) {
    lines.push(
      `A categoria com mais vendas foi ${topCat.name}, com ${formatPdfBRL(topCat.income)}.`,
    );
  } else {
    lines.push("Não houve arrecadação registrada neste período.");
  }

  if (open > 0.001) {
    lines.push(
      `A receita bruta do evento foi de ${formatPdfBRL(gross)}, somando as entradas já recebidas (${formatPdfBRL(paid)}) e ${formatPdfBRL(open)} ainda em aberto.`,
    );
  } else {
    lines.push(
      `A receita bruta do evento foi de ${formatPdfBRL(gross)}.`,
    );
  }

  if (net > 0.001) {
    lines.push(
      `A receita líquida (lucro) ficou em ${formatPdfBRL(net)}, após as saídas (incluindo despesas já agendadas).`,
    );
  } else if (net < -0.001) {
    lines.push(
      `A receita líquida ficou em prejuízo de ${formatPdfBRL(Math.abs(net))}, após as saídas (incluindo despesas já agendadas).`,
    );
  } else {
    lines.push(
      "A receita líquida ficou zerada: receita bruta e saídas se equivalem.",
    );
  }

  if (spent > 0.001 && paid > 0.001) {
    const pct = Math.round((spent / paid) * 100);
    lines.push(
      `As saídas correspondem a ${pct}% das entradas já recebidas.`,
    );
  }

  if ((totals.scheduledExpense ?? 0) > 0.001) {
    lines.push(
      `Despesas agendadas (${formatPdfBRL(totals.scheduledExpense)}) entram nesta visão do evento, mas no fluxo de caixa só passam a contar a partir da data informada.`,
    );
  }

  return lines;
}

export function summarizeComandaReport(rows: ComandaReportRow[]): {
  paid: number;
  open: number;
  openLines: EventOpenLine[];
} {
  let paidCents = 0;
  let openCents = 0;
  const openLines: EventOpenLine[] = [];
  for (const r of rows) {
    const ticketPaidC = moneyCents(r.ticket_paid_amount);
    const ticketOpenC = Math.max(
      0,
      moneyCents(r.ticket_amount) - ticketPaidC,
    );
    paidCents += ticketPaidC;
    openCents += ticketOpenC;
    if (ticketOpenC > 0) {
      openLines.push({
        buyerName: r.buyer_name,
        sellerName: r.seller_name,
        label: `Ingresso · ${r.ticket_type_name}`,
        amount: centsToMoney(ticketOpenC),
      });
    }
    for (const i of r.items) {
      const amountC = moneyCents(i.amount);
      if (i.paid) {
        paidCents += amountC;
        continue;
      }
      if (amountC <= 0) continue;
      openCents += amountC;
      openLines.push({
        buyerName: r.buyer_name,
        sellerName: r.seller_name,
        label: i.qty > 1 ? `${i.name} × ${i.qty}` : i.name,
        amount: centsToMoney(amountC),
      });
    }
  }
  openLines.sort((a, b) => {
    const seller = (a.sellerName || "—").localeCompare(b.sellerName || "—", "pt-BR", {
      sensitivity: "base",
    });
    if (seller !== 0) return seller;
    const buyer = a.buyerName.localeCompare(b.buyerName, "pt-BR", {
      sensitivity: "base",
    });
    if (buyer !== 0) return buyer;
    return a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
  });
  return {
    paid: centsToMoney(paidCents),
    open: centsToMoney(openCents),
    openLines,
  };
}

function drawPaidSpentOpen(
  doc: jsPDF,
  y: number,
  pageW: number,
  contentW: number,
  paid: number,
  spent: number,
  open: number,
  paidHint?: string,
) {
  const col = contentW / 3;
  doc.setFillColor(245, 245, 242);
  doc.rect(MARGIN, y - 4, contentW, paidHint ? 22 : 18, "F");

  const cols = [
    { label: "Entradas", value: paid, color: COLOR_GREEN, x: MARGIN + 3 },
    { label: "Saídas", value: spent, color: COLOR_RED, x: MARGIN + col + 3 },
    {
      label: "Em aberto",
      value: open,
      color: COLOR_AMBER,
      x: MARGIN + col * 2 + 3,
    },
  ] as const;

  for (const c of cols) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setRgb(doc, COLOR_BLACK);
    doc.text(c.label, c.x, y + 1);
    doc.setFontSize(12);
    setRgb(doc, c.color);
    doc.text(formatPdfBRL(c.value), c.x, y + 8);
  }

  if (paidHint) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    doc.text(paidHint, MARGIN + 3, y + 14);
    setRgb(doc, COLOR_BLACK);
    return y + 26;
  }
  setRgb(doc, COLOR_BLACK);
  return y + 22;
}

function drawOpenLinesSection(
  doc: jsPDF,
  y: number,
  pageW: number,
  pageH: number,
  contentW: number,
  openLines: EventOpenLine[],
  openTotal: number,
) {
  const ensureSpace = (need: number) => {
    if (y > pageH - need) {
      doc.addPage();
      y = MARGIN + 4;
      return true;
    }
    return false;
  };

  ensureSpace(28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Ainda em aberto", MARGIN, y);
  setRgb(doc, COLOR_AMBER);
  doc.text(formatBRL(openTotal), pageW - MARGIN - 2, y, { align: "right" });
  setRgb(doc, COLOR_BLACK);
  y += 6;

  if (openLines.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nada em aberto.", MARGIN + 2, y);
    setRgb(doc, COLOR_BLACK);
    return y + 8;
  }

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN, y - 4.5, contentW, 7, "F");
    doc.text("Pessoa", MARGIN + 1, y);
    doc.text("Item", MARGIN + 62, y);
    doc.text("Valor", pageW - MARGIN - 1, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
  };
  drawHeader();

  for (const line of openLines) {
    const person = line.sellerName
      ? `${line.buyerName} · ${line.sellerName}`
      : line.buyerName;
    const personLines = doc.splitTextToSize(person, 58) as string[];
    const itemLines = doc.splitTextToSize(line.label, contentW - 90) as string[];
    const rowH = 4.5 + Math.max(0, Math.max(personLines.length, itemLines.length) - 1) * 4;
    if (ensureSpace(rowH + 8)) drawHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_BLACK);
    doc.text(personLines[0] ?? "", MARGIN + 1, y);
    doc.text(itemLines[0] ?? "", MARGIN + 62, y);
    setRgb(doc, COLOR_AMBER);
    doc.text(formatBRL(line.amount), pageW - MARGIN - 1, y, { align: "right" });
    setRgb(doc, COLOR_BLACK);
    y += 4.5;
    const extra = Math.max(personLines.length, itemLines.length);
    for (let i = 1; i < extra; i++) {
      if (personLines[i]) doc.text(personLines[i], MARGIN + 1, y);
      if (itemLines[i]) doc.text(itemLines[i], MARGIN + 62, y);
      y += 4;
    }
    doc.setDrawColor(230, 230, 228);
    doc.line(MARGIN, y - 1.5, pageW - MARGIN, y - 1.5);
    y += 2;
  }
  return y + 4;
}

const PIE_COLORS: Rgb[] = [
  [4, 120, 87],
  [29, 78, 216],
  [180, 83, 9],
  [126, 34, 206],
  [185, 28, 28],
  [13, 148, 136],
  [67, 56, 202],
  [161, 98, 7],
];

export type EventReportSlice = { label: string; value: number };

export function eventReportIncomeSlices(
  totals: EventFinanceTotals,
): EventReportSlice[] {
  return totals.byCategory
    .filter((c) => c.income > 0.001)
    .map((c) => ({ label: c.name, value: c.income }));
}

export function eventReportExpenseSlices(
  totals: EventFinanceTotals,
): EventReportSlice[] {
  const slices: EventReportSlice[] = totals.byCategory
    .filter((c) => c.expense > 0.001)
    .map((c) => ({ label: c.name, value: c.expense }));
  const catExpense = slices.reduce((s, x) => s + x.value, 0);
  const budgetRealized = Math.max(0, (totals.spent ?? 0) - catExpense);
  const orcamento = budgetRealized + (totals.scheduledExpense ?? 0);
  if (orcamento > 0.001) {
    slices.push({ label: "Orçamento", value: orcamento });
  }
  return slices;
}

function fillPieSlice(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  color: Rgb,
) {
  const span = a1 - a0;
  if (span <= 0) return;
  const steps = Math.max(8, Math.round(Math.abs(span) / 0.1));
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + (span * i) / steps;
    const t1 = a0 + (span * (i + 1)) / steps;
    doc.triangle(
      cx,
      cy,
      cx + r * Math.cos(t0),
      cy + r * Math.sin(t0),
      cx + r * Math.cos(t1),
      cy + r * Math.sin(t1),
      "F",
    );
  }
}

function drawPieChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  slices: EventReportSlice[],
) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    doc.setDrawColor(210, 210, 208);
    doc.setFillColor(245, 245, 242);
    doc.circle(cx, cy, r, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    doc.text("Sem dados", cx, cy + 1, { align: "center" });
    setRgb(doc, COLOR_BLACK);
    return;
  }
  let angle = -Math.PI / 2;
  slices.forEach((slice, i) => {
    const next = angle + (slice.value / total) * Math.PI * 2;
    fillPieSlice(doc, cx, cy, r, angle, next, PIE_COLORS[i % PIE_COLORS.length]);
    angle = next;
  });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r, "S");
  doc.setLineWidth(0.2);
}

function drawPieLegend(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  slices: EventReportSlice[],
) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let cy = y;
  slices.forEach((slice, i) => {
    const color = PIE_COLORS[i % PIE_COLORS.length];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, cy - 2.6, 3.2, 3.2, "F");
    setRgb(doc, COLOR_BLACK);
    const pct = Math.round((slice.value / total) * 100);
    const raw = `${slice.label}  ${formatPdfBRL(slice.value)} (${pct}%)`;
    const lines = doc.splitTextToSize(raw, width - 6) as string[];
    doc.text(lines[0] ?? raw, x + 5, cy);
    cy += 5;
  });
  return cy;
}

function drawChartsPage(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  contentW: number,
  totals: EventFinanceTotals,
) {
  doc.addPage();
  let y = MARGIN + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setRgb(doc, COLOR_BLACK);
  doc.text("Gráficos", pageW / 2, y, { align: "center" });
  y += 8;

  const paid = totals.paid ?? totals.totalIncome;
  const spent = eventReportVisualSpent(totals);
  const open = totals.open ?? 0;
  const bars = [
    { label: "Entradas", value: paid, color: COLOR_GREEN },
    { label: "Saídas", value: spent, color: COLOR_RED },
    { label: "Em aberto", value: open, color: COLOR_AMBER },
  ];
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const barW = contentW - 70;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Comparativo", MARGIN, y);
  y += 8;

  for (const bar of bars) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_BLACK);
    doc.text(bar.label, MARGIN, y);
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN + 28, y - 3.4, barW, 5.5, "F");
    const w = barW * (bar.value / maxBar);
    if (w > 0.3) {
      doc.setFillColor(bar.color[0], bar.color[1], bar.color[2]);
      doc.rect(MARGIN + 28, y - 3.4, w, 5.5, "F");
    }
    setRgb(doc, bar.color);
    doc.setFont("helvetica", "bold");
    doc.text(formatPdfBRL(bar.value), MARGIN + 28 + barW + 2, y);
    setRgb(doc, COLOR_BLACK);
    y += 8;
  }

  y += 6;
  const incomeSlices = eventReportIncomeSlices(totals);
  const expenseSlices = eventReportExpenseSlices(totals);
  const pieR = 28;
  const colW = contentW / 2;
  const pieY = y + pieR + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Entradas", MARGIN, y);
  doc.text("Saídas", MARGIN + colW, y);

  drawPieChart(doc, MARGIN + 32, pieY, pieR, incomeSlices);
  drawPieChart(doc, MARGIN + colW + 32, pieY, pieR, expenseSlices);

  const legendY = pieY + pieR + 8;
  const leftEnd = drawPieLegend(doc, MARGIN, legendY, colW - 6, incomeSlices);
  const rightEnd = drawPieLegend(
    doc,
    MARGIN + colW,
    legendY,
    colW - 6,
    expenseSlices,
  );
  return Math.max(leftEnd, rightEnd) + 8;
}

function drawAnalysisSection(
  doc: jsPDF,
  startY: number,
  pageW: number,
  pageH: number,
  contentW: number,
  totals: EventFinanceTotals,
) {
  let y = startY;
  if (y > pageH - 36) {
    doc.addPage();
    y = MARGIN + 4;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Análise do evento", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const paragraph of buildEventReportAnalysis(totals)) {
    const wrapped = doc.splitTextToSize(paragraph, contentW) as string[];
    for (const line of wrapped) {
      if (y > pageH - 16) {
        doc.addPage();
        y = MARGIN + 4;
      }
      setRgb(doc, COLOR_BLACK);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 2.5;
  }
  return y;
}

type PdfCashRow = EventFinanceTotals["entries"][number] & {
  scheduled?: boolean;
};

function layoutCashColumns(
  contentW: number,
  columns: EventCashTableColumnState[],
): Array<{
  id: EventCashTableColumnId;
  x: number;
  w: number;
  align: "left" | "right";
}> {
  const enabled = resolveCashTableColumns(columns).filter((c) => c.enabled);
  const amountOn = enabled.some((c) => c.id === "amount");
  const amountW = amountOn ? CASH_COL_WEIGHT.amount : 0;
  const flex = enabled.filter((c) => c.id !== "amount");
  const weightSum = flex.reduce((s, c) => s + CASH_COL_WEIGHT[c.id], 0) || 1;
  const avail = Math.max(10, contentW - amountW);
  let x = MARGIN;
  const out: Array<{
    id: EventCashTableColumnId;
    x: number;
    w: number;
    align: "left" | "right";
  }> = [];
  for (const c of flex) {
    const w = avail * (CASH_COL_WEIGHT[c.id] / weightSum);
    out.push({ id: c.id, x, w, align: "left" });
    x += w;
  }
  if (amountOn) {
    out.push({
      id: "amount",
      x: MARGIN + contentW - amountW,
      w: amountW,
      align: "right",
    });
  }
  return out;
}

function cashCellText(
  colId: EventCashTableColumnId,
  row: PdfCashRow,
  kind: "entrada" | "saida",
  texts: { item: string; description: string },
): string {
  if (colId === "date") return formatDateBR(row.entry_date);
  if (colId === "type") return kind === "entrada" ? "Entrada" : "Saída";
  if (colId === "item") return texts.item;
  if (colId === "description") return texts.description;
  const sign = kind === "entrada" ? "+" : "-";
  return `${sign} ${formatPdfBRL(Number(row.amount))}`;
}

function drawCashKindTable(
  doc: jsPDF,
  startY: number,
  pageW: number,
  pageH: number,
  contentW: number,
  title: string,
  rows: PdfCashRow[],
  kind: "entrada" | "saida",
  eventName: string,
  columns?: EventCashTableColumnState[],
) {
  let y = startY;
  const color = kind === "entrada" ? COLOR_GREEN : COLOR_RED;
  const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const layout = layoutCashColumns(contentW, columns ?? defaultEventCashTableColumns());

  const ensureSpace = (need: number) => {
    if (y > pageH - need) {
      doc.addPage();
      y = MARGIN + 4;
      return true;
    }
    return false;
  };

  ensureSpace(30);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text(title, MARGIN, y);
  setRgb(doc, color);
  doc.text(formatPdfBRL(total), pageW - MARGIN - 2, y, { align: "right" });
  setRgb(doc, COLOR_BLACK);
  y += 6;

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN, y - 4.5, contentW, 7, "F");
    for (const col of layout) {
      const label =
        EVENT_CASH_TABLE_COLUMNS.find((c) => c.id === col.id)?.label ?? col.id;
      if (col.align === "right") {
        doc.text(label, col.x + col.w - 1, y, { align: "right" });
      } else {
        doc.text(label, col.x + 1, y);
      }
    }
    y += 6;
    doc.setFont("helvetica", "normal");
  };

  if (rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhum lançamento.", MARGIN + 2, y);
    setRgb(doc, COLOR_BLACK);
    return y + 8;
  }

  drawHeader();

  for (const e of rows) {
    const texts =
      kind === "saida" && isBudgetLikeCashRow(e, eventName)
        ? formatEventCashRowTexts(e, eventName)
        : {
            item: (e.subcategory || "—").trim() || "—",
            description: (e.description || e.subcategory || "—").trim() || "—",
          };
    const wrapped = new Map<EventCashTableColumnId, string[]>();
    let extra = 1;
    for (const col of layout) {
      const raw = cashCellText(col.id, e, kind, texts);
      const lines =
        col.id === "amount" || col.id === "date" || col.id === "type"
          ? [raw]
          : (doc.splitTextToSize(raw, Math.max(8, col.w - 2)) as string[]);
      wrapped.set(col.id, lines);
      extra = Math.max(extra, lines.length);
    }
    const rowH = 5 + Math.max(0, extra - 1) * 4;
    if (ensureSpace(rowH + 8)) drawHeader();

    doc.setFontSize(9);
    for (const col of layout) {
      const lines = wrapped.get(col.id) ?? [""];
      const colored = col.id === "type" || col.id === "amount";
      setRgb(doc, colored ? color : COLOR_BLACK);
      if (col.align === "right") {
        doc.text(lines[0] ?? "", col.x + col.w - 1, y, { align: "right" });
      } else {
        doc.text(lines[0] ?? "", col.x + 1, y);
      }
    }
    setRgb(doc, COLOR_BLACK);
    y += 5;
    for (let i = 1; i < extra; i++) {
      for (const col of layout) {
        const line = wrapped.get(col.id)?.[i];
        if (!line) continue;
        setRgb(doc, COLOR_BLACK);
        if (col.align === "right") {
          doc.text(line, col.x + col.w - 1, y, { align: "right" });
        } else {
          doc.text(line, col.x + 1, y);
        }
      }
      y += 4;
    }
    doc.setDrawColor(230, 230, 228);
    doc.line(MARGIN, y - 2.2, pageW - MARGIN, y - 2.2);
    y += 2;
  }
  return y + 4;
}

function drawCategorySection(
  doc: jsPDF,
  startY: number,
  pageW: number,
  pageH: number,
  contentW: number,
  totals: EventFinanceTotals,
) {
  let y = startY;
  const ensureSpace = (need: number) => {
    if (y > pageH - need) {
      doc.addPage();
      y = MARGIN + 4;
      return true;
    }
    return false;
  };

  ensureSpace(28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Arrecadação por categoria", MARGIN, y);
  y += 6;

  const drawCategoryHeader = (cat: (typeof totals.byCategory)[number]) => {
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN, y - 4, contentW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setRgb(doc, COLOR_BLACK);
    const catLabel =
      cat.categoryId === INGRESSOS_CATEGORY_ID
        ? `${cat.name} (ingressos)`
        : cat.name;
    doc.text(catLabel, MARGIN + 2, y);
    setRgb(doc, COLOR_GREEN);
    doc.text(formatBRL(cat.income), pageW - MARGIN - 2, y, { align: "right" });
    setRgb(doc, COLOR_BLACK);
    y += 7;
  };

  for (const cat of totals.byCategory) {
    ensureSpace(28);
    const items = totals.byItem.filter((i) => i.categoryId === cat.categoryId);

    drawCategoryHeader(cat);

    if (items.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setRgb(doc, COLOR_GRAY);
      doc.text("Sem itens", MARGIN + 4, y);
      setRgb(doc, COLOR_BLACK);
      y += 5;
      continue;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const it of items) {
      const left = it.qty != null ? `${it.name}  (${it.qty} un.)` : it.name;
      const lines = doc.splitTextToSize(left, contentW - 45) as string[];
      const rowH =
        4.5 + Math.max(0, lines.length - 1) * 4 + (it.expense > 0 ? 4 : 0) + 2;
      if (ensureSpace(rowH + 4)) {
        drawCategoryHeader(cat);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
      }
      doc.text(lines[0] ?? "", MARGIN + 4, y);
      setRgb(doc, COLOR_GREEN);
      doc.text(formatBRL(it.income), pageW - MARGIN - 2, y, {
        align: "right",
      });
      setRgb(doc, COLOR_BLACK);
      y += 4.5;
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], MARGIN + 4, y);
        y += 4;
      }
      if (it.expense > 0) {
        setRgb(doc, COLOR_RED);
        doc.text(`saídas ${formatBRL(it.expense)}`, pageW - MARGIN - 2, y, {
          align: "right",
        });
        setRgb(doc, COLOR_BLACK);
        y += 4;
      }
      doc.setDrawColor(230, 230, 228);
      doc.line(MARGIN + 2, y - 1.5, pageW - MARGIN, y - 1.5);
      y += 2;
    }
    y += 3;
  }
  return y;
}

function resolveReportBlocks(
  blocks?: EventFinanceReportBlockState[],
): EventFinanceReportBlockState[] {
  if (!blocks?.length) return defaultEventReportBlocks();
  const known = new Set(EVENT_FINANCE_REPORT_BLOCKS.map((b) => b.id));
  const seen = new Set<EventReportBlockId>();
  const ordered: EventFinanceReportBlockState[] = [];
  for (const b of blocks) {
    if (!known.has(b.id) || seen.has(b.id)) continue;
    seen.add(b.id);
    ordered.push({ id: b.id, enabled: b.enabled });
  }
  for (const b of EVENT_FINANCE_REPORT_BLOCKS) {
    if (!seen.has(b.id)) ordered.push({ id: b.id, enabled: true });
  }
  return ordered;
}

export type EventFinancePdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  eventName: string;
  gestaoLabel: string;
  periodLabel: string;
  totals: EventFinanceTotals;
  blocks?: EventFinanceReportBlockState[];
  incomeColumns?: EventCashTableColumnState[];
  expenseColumns?: EventCashTableColumnState[];
};

export type EventFinanceSimpleSigner = {
  name: string;
  demolayId?: string | null;
  signatureDataUrl?: string | null;
};

export type EventFinanceSimplePdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  eventName: string;
  gestaoLabel: string;
  lodgeAddress?: string | null;
  issuedAt?: Date;
  totals: EventFinanceTotals;
  signers: {
    mc: EventFinanceSimpleSigner;
    pcc: EventFinanceSimpleSigner;
  };
};

/** Relatório PDF do financeiro do evento (estilo fluxo de caixa). */
export async function exportEventFinancePdf(input: EventFinancePdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const { totals } = input;

  const logo = await loadLogoDataUrl(input.logoPath);
  let y = MARGIN;

  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      const h = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
      doc.addImage(logo, (pageW - h * ratio) / 2, y, h * ratio, h);
      y += h + 4;
    } catch {
      /* ignora logo inválida */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setRgb(doc, COLOR_BLACK);
  doc.text(input.chapterName, pageW / 2, y, {
    align: "center",
    maxWidth: contentW,
  });
  y += 6;

  if (input.chapterCity) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setRgb(doc, COLOR_GRAY);
    doc.text(input.chapterCity, pageW / 2, y, { align: "center" });
    y += 5;
  }

  const reportTitle = eventFinanceReportTitle(
    input.eventName,
    input.gestaoLabel,
    "Completo",
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRgb(doc, COLOR_BLACK);
  const titleLines = doc.splitTextToSize(reportTitle, contentW) as string[];
  for (const line of titleLines) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 5.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setRgb(doc, COLOR_GRAY);
  doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
  y += 8;
  setRgb(doc, COLOR_BLACK);

  const paid = totals.paid ?? totals.totalIncome;
  const spent = eventReportVisualSpent(totals);
  const open = totals.open ?? 0;
  const openLines = totals.openLines ?? [];
  const paidHint = [
    `Ingressos ${formatPdfBRL(totals.ticketsIncome)}`,
    `Outros ${formatPdfBRL(totals.otherIncome)}`,
    `Líquido ${formatPdfBRL(centsToMoney(moneyCents(paid) - moneyCents(spent)))}`,
  ].join("  ·  ");

  const incomeRows = totals.entries.filter((e) => e.kind === "entrada");
  const expenseRows: PdfCashRow[] = [
    ...totals.entries.filter((e) => e.kind === "saida"),
    ...(totals.scheduledEntries ?? []).map((e) => ({ ...e, scheduled: true })),
  ];

  for (const block of resolveReportBlocks(input.blocks)) {
    if (!block.enabled) continue;
    if (block.id === "summary") {
      y = drawPaidSpentOpen(doc, y, pageW, contentW, paid, spent, open, paidHint);
    } else if (block.id === "open") {
      y = drawOpenLinesSection(doc, y, pageW, pageH, contentW, openLines, open);
    } else if (block.id === "categories") {
      y = drawCategorySection(doc, y, pageW, pageH, contentW, totals);
    } else if (block.id === "income") {
      y = drawCashKindTable(
        doc,
        y,
        pageW,
        pageH,
        contentW,
        "Entradas",
        incomeRows,
        "entrada",
        input.eventName,
        input.incomeColumns,
      );
    } else if (block.id === "expense") {
      y = drawCashKindTable(
        doc,
        y,
        pageW,
        pageH,
        contentW,
        "Saídas",
        expenseRows,
        "saida",
        input.eventName,
        input.expenseColumns,
      );
    } else if (block.id === "charts") {
      y = drawChartsPage(doc, pageW, pageH, contentW, totals);
    } else if (block.id === "analysis") {
      y = drawAnalysisSection(doc, y, pageW, pageH, contentW, totals);
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  pág. ${p}/${pages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
  }

  doc.save(`${fileSafe(reportTitle) || "relatorio-completo"}.pdf`);
}

function drawSimpleAmountRow(
  doc: jsPDF,
  y: number,
  pageW: number,
  left: string,
  right: string,
  opts?: { bold?: boolean; color?: Rgb },
) {
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(opts?.bold ? 11 : 10);
  setRgb(doc, opts?.color ?? COLOR_BLACK);
  doc.text(left, MARGIN, y);
  doc.text(right, pageW - MARGIN, y, { align: "right" });
  setRgb(doc, COLOR_BLACK);
  return y + (opts?.bold ? 7 : 6);
}

function drawSimpleSigner(
  doc: jsPDF,
  x: number,
  y: number,
  colW: number,
  signer: EventFinanceSimpleSigner,
  role: string,
) {
  if (signer.signatureDataUrl?.startsWith("data:image/")) {
    try {
      const props = doc.getImageProperties(signer.signatureDataUrl);
      const maxW = Math.min(50, colW - 4);
      const maxH = 16;
      const ratio = props.width / props.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      doc.addImage(
        signer.signatureDataUrl,
        x + (colW - w) / 2,
        y - h + 1,
        w,
        h,
      );
    } catch {
      /* imagem inválida */
    }
  }
  doc.setDrawColor(120, 120, 120);
  doc.line(x + 4, y + 2, x + colW - 4, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setRgb(doc, COLOR_BLACK);
  doc.text(signer.name || "____________________", x + colW / 2, y + 7, {
    align: "center",
    maxWidth: colW - 4,
  });
  let ty = y + 12;
  if (signer.demolayId) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    doc.text(`ID: ${signer.demolayId}`, x + colW / 2, ty, { align: "center" });
    ty += 4.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setRgb(doc, COLOR_GRAY);
  doc.text(role, x + colW / 2, ty, { align: "center" });
  setRgb(doc, COLOR_BLACK);
}

/** Declaração de rendimentos (uma página, modelo simplificado). */
export async function exportEventFinanceSimplePdf(
  input: EventFinanceSimplePdfInput,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const { totals } = input;
  const issued = input.issuedAt ?? new Date();

  const logo = await loadLogoDataUrl(input.logoPath);
  let y = MARGIN;

  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      const h = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
      doc.addImage(logo, (pageW - h * ratio) / 2, y, h * ratio, h);
      y += h + 4;
    } catch {
      /* ignora logo inválida */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setRgb(doc, COLOR_BLACK);
  doc.text(input.chapterName, pageW / 2, y, {
    align: "center",
    maxWidth: contentW,
  });
  y += 6;

  const cityDate = [input.chapterCity?.trim(), formatIssuedAtLong(issued)]
    .filter(Boolean)
    .join(" | ");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, COLOR_GRAY);
  doc.text(cityDate, pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRgb(doc, COLOR_BLACK);
  const title = eventFinanceReportTitle(
    input.eventName,
    input.gestaoLabel,
    "Simplificado",
  );
  const titleLines = doc.splitTextToSize(title, contentW) as string[];
  for (const line of titleLines) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 5.5;
  }
  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, COLOR_GRAY);
  const audience = `Destinado aos DeMolays e membros do Conselho do ${input.chapterName}`;
  const audienceLines = doc.splitTextToSize(audience, contentW) as string[];
  for (const line of audienceLines) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 4.5;
  }
  y += 8;
  setRgb(doc, COLOR_BLACK);

  const expenseLines = buildSimpleEventExpenseLines(totals, input.eventName);
  const expenseTotal = expenseLines.reduce((s, l) => s + l.amount, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Despesas para realização:", MARGIN, y);
  y += 7;
  if (expenseLines.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhuma despesa lançada.", MARGIN, y);
    setRgb(doc, COLOR_BLACK);
    y += 6;
  } else {
    for (const line of expenseLines) {
      y = drawSimpleAmountRow(doc, y, pageW, line.label, formatPdfBRL(line.amount));
    }
  }
  y = drawSimpleAmountRow(
    doc,
    y + 1,
    pageW,
    "Total Despesas:",
    formatPdfBRL(expenseTotal),
    { bold: true },
  );
  y += 6;

  const incomeLines = buildSimpleEventIncomeLines(totals);
  const paid = totals.paid ?? totals.totalIncome;
  const open = totals.open ?? 0;
  const gross = paid + open;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Receita bruta do evento:", MARGIN, y);
  y += 7;
  if (incomeLines.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhuma entrada registrada.", MARGIN, y);
    setRgb(doc, COLOR_BLACK);
    y += 6;
  } else {
    for (const line of incomeLines) {
      const left =
        line.qty != null && line.qty > 0
          ? `${line.label} (${line.qty} vendidos)`
          : line.label;
      y = drawSimpleAmountRow(doc, y, pageW, left, formatPdfBRL(line.amount));
    }
  }
  y = drawSimpleAmountRow(
    doc,
    y + 1,
    pageW,
    "Total Entradas:",
    formatPdfBRL(gross),
    { bold: true },
  );
  y += 8;

  const net = gross - expenseTotal;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Receita Líquida (Lucro)", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(18);
  setRgb(doc, net >= 0 ? COLOR_GREEN : COLOR_RED);
  doc.text(formatPdfBRL(net), pageW / 2, y, { align: "center" });
  setRgb(doc, COLOR_BLACK);
  y += 22;

  const colW = contentW / 2;
  drawSimpleSigner(doc, MARGIN, y, colW, input.signers.mc, "Mestre Conselheiro");
  drawSimpleSigner(
    doc,
    MARGIN + colW,
    y,
    colW,
    input.signers.pcc,
    "Presidente do Conselho",
  );

  if (input.lodgeAddress?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    const addr = doc.splitTextToSize(input.lodgeAddress.trim(), contentW) as string[];
    let fy = pageH - 12 - Math.max(0, addr.length - 1) * 4;
    for (const line of addr) {
      doc.text(line, pageW / 2, fy, { align: "center" });
      fy += 4;
    }
  }

  doc.save(`${fileSafe(title) || "relatorio-simplificado"}.pdf`);
}

export type EventTicketExportRow = {
  buyer_name: string;
  seller_name: string | null;
  ticket_type_name: string;
  price_paid: number;
  status?: string | null;
  sold_at?: string | null;
};

/** Planilha de ingressos: Comprador, Vendedor, Tipo, Valor. */
export function exportEventTicketsXlsx(
  rows: EventTicketExportRow[],
  fileName: string,
  options?: { eventName?: string },
) {
  const active = rows.filter((r) => r.status !== "cancelado");
  const sheetRows = active.map((r) => ({
    "Nome Comprador": r.buyer_name || "—",
    "Nome Vendedor": r.seller_name?.trim() || "—",
    "Tipo de Ingresso": r.ticket_type_name || "Avulso",
    Valor: Number(r.price_paid) || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows, {
    header: ["Nome Comprador", "Nome Vendedor", "Tipo de Ingresso", "Valor"],
  });
  ws["!cols"] = [{ wch: 32 }, { wch: 28 }, { wch: 24 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ingressos");
  const safe =
    fileName ||
    `ingressos-${fileSafe(options?.eventName || "evento") || "evento"}.xlsx`;
  XLSX.writeFile(wb, safe.endsWith(".xlsx") ? safe : `${safe}.xlsx`);
}

export type ComandaReportItem = {
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
  paid: boolean;
};

export type ComandaReportRow = {
  buyer_name: string;
  seller_name: string | null;
  ticket_type_name: string;
  ticket_amount: number;
  ticket_paid_amount: number;
  settlement: "open" | "partial" | "paid";
  items: ComandaReportItem[];
};

export function buildComandaReportRows(input: {
  tickets: Array<{
    id: string;
    buyer_name: string;
    seller_name?: string | null;
    ticket_type_id: string | null;
    price_paid: number | string;
    status: string;
    settlement?: "open" | "partial" | "paid";
    seller_charge_paid?: boolean;
    seller_charge_amount_paid?: number;
  }>;
  ticketTypes: Array<{ id: string; name: string }>;
  items: Array<{
    ticket_id: string;
    item_name?: string | null;
    qty: number;
    unit_price: number;
    amount: number;
    paid?: boolean;
    created_at?: string;
  }>;
}): ComandaReportRow[] {
  const typeNameById = new Map(input.ticketTypes.map((t) => [t.id, t.name]));
  const itemsByTicket = new Map<string, ComandaReportItem[]>();
  const sortedItems = [...input.items].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );
  for (const line of sortedItems) {
    const list = itemsByTicket.get(line.ticket_id) ?? [];
    list.push({
      name: line.item_name?.trim() || "Item",
      qty: Number(line.qty) || 0,
      unit_price: Number(line.unit_price) || 0,
      amount: Number(line.amount) || 0,
      paid: !!line.paid,
    });
    itemsByTicket.set(line.ticket_id, list);
  }

  return input.tickets
    .filter((t) => t.status !== "cancelado")
    .map((t) => {
      const ticketAmount = Number(t.price_paid) || 0;
      let ticketPaidAmount = 0;
      if (ticketAmount <= 0 || t.seller_charge_paid) {
        ticketPaidAmount = ticketAmount;
      } else if ((t.seller_charge_amount_paid ?? 0) > 0) {
        ticketPaidAmount = Math.min(
          Number(t.seller_charge_amount_paid) || 0,
          ticketAmount,
        );
      }
      return {
        buyer_name: t.buyer_name || "—",
        seller_name: t.seller_name?.trim() || null,
        ticket_type_name: t.ticket_type_id
          ? (typeNameById.get(t.ticket_type_id) ?? "Tipo removido")
          : "Avulso",
        ticket_amount: ticketAmount,
        ticket_paid_amount: ticketPaidAmount,
        settlement: t.settlement ?? "open",
        items: itemsByTicket.get(t.id) ?? [],
      };
    })
    .sort((a, b) => {
      const sellerCmp = (a.seller_name || "—").localeCompare(
        b.seller_name || "—",
        "pt-BR",
        { sensitivity: "base" },
      );
      if (sellerCmp !== 0) return sellerCmp;
      return a.buyer_name.localeCompare(b.buyer_name, "pt-BR", {
        sensitivity: "base",
      });
    });
}

function settlementLabel(s: ComandaReportRow["settlement"]) {
  if (s === "paid") return { text: "Pago", color: COLOR_GREEN };
  if (s === "partial") return { text: "Parcial", color: COLOR_AMBER };
  return { text: "Em aberto", color: COLOR_GRAY };
}

function lineStatus(paid: boolean, partial = false) {
  if (paid) return { text: "Pago", color: COLOR_GREEN };
  if (partial) return { text: "Parcial", color: COLOR_AMBER };
  return { text: "Em aberto", color: COLOR_GRAY };
}

function fitText(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 4 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

export async function exportEventComandasPdf(input: {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  eventName: string;
  rows: ComandaReportRow[];
  spent?: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const rightX = pageW - MARGIN;

  const logo = await loadLogoDataUrl(input.logoPath);
  let y = MARGIN;

  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      const h = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
      doc.addImage(logo, (pageW - h * ratio) / 2, y, h * ratio, h);
      y += h + 4;
    } catch {
      /* ignora logo inválida */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setRgb(doc, COLOR_BLACK);
  doc.text(input.chapterName, pageW / 2, y, {
    align: "center",
    maxWidth: contentW,
  });
  y += 6;

  if (input.chapterCity) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setRgb(doc, COLOR_GRAY);
    doc.text(input.chapterCity, pageW / 2, y, { align: "center" });
    y += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Relatório de Comandas", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(input.eventName, pageW / 2, y, {
    align: "center",
    maxWidth: contentW,
  });
  y += 8;

  const summary = summarizeComandaReport(input.rows);
  const spent = input.spent ?? 0;
  y = drawPaidSpentOpen(
    doc,
    y,
    pageW,
    contentW,
    summary.paid,
    spent,
    summary.open,
  );
  y = drawOpenLinesSection(
    doc,
    y,
    pageW,
    pageH,
    contentW,
    summary.openLines,
    summary.open,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text(
    input.rows.length === 1
      ? "1 comanda"
      : `${input.rows.length} comandas`,
    MARGIN,
    y,
  );
  y += 6;

  const ensureSpace = (need: number) => {
    if (y > pageH - need) {
      doc.addPage();
      y = MARGIN + 4;
    }
  };

  if (input.rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhuma comanda neste evento.", MARGIN, y);
  }

  for (const row of input.rows) {
    const openAmount =
      Math.max(0, row.ticket_amount - row.ticket_paid_amount) +
      row.items.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
    const paidAmount =
      row.ticket_paid_amount +
      row.items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0);
    const ticketFullyPaid =
      row.ticket_amount <= 0 ||
      row.ticket_paid_amount >= row.ticket_amount - 0.001;
    const ticketPartial = !ticketFullyPaid && row.ticket_paid_amount > 0.001;

    ensureSpace(28 + row.items.length * 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setRgb(doc, COLOR_BLACK);
    const buyer = fitText(doc, row.buyer_name, contentW * 0.55);
    doc.text(buyer, MARGIN, y);
    if (row.seller_name) {
      const buyerW = doc.getTextWidth(buyer);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setRgb(doc, COLOR_GRAY);
      doc.text(
        fitText(doc, row.seller_name, contentW - buyerW - 6),
        MARGIN + buyerW + 3,
        y,
      );
    }
    y += 5.5;

    const ticketStatus = lineStatus(ticketFullyPaid, ticketPartial);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setRgb(doc, COLOR_BLACK);
    const ticketLeft = fitText(
      doc,
      `${row.ticket_type_name} · ${formatBRL(row.ticket_amount)} · `,
      contentW - 22,
    );
    doc.text(ticketLeft, MARGIN, y);
    doc.setFont("helvetica", "bold");
    setRgb(doc, ticketStatus.color);
    doc.text(ticketStatus.text, MARGIN + doc.getTextWidth(ticketLeft), y);
    y += 5;

    if (row.items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      setRgb(doc, COLOR_GRAY);
      doc.text("Sem itens lançados", MARGIN + 2, y);
      y += 5;
    } else {
      for (const item of row.items) {
        ensureSpace(12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setRgb(doc, COLOR_BLACK);
        const name = fitText(doc, item.name, contentW * 0.42);
        doc.text(name, MARGIN + 2, y);
        let x = MARGIN + 2 + doc.getTextWidth(name) + 2;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        setRgb(doc, COLOR_GRAY);
        const unit = formatBRL(item.unit_price);
        doc.text(unit, x, y);
        x += doc.getTextWidth(unit) + 3;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setRgb(doc, COLOR_BLACK);
        const qty = `× ${item.qty}`;
        doc.text(qty, x, y);
        x += doc.getTextWidth(qty) + 3;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const totalLabel = formatBRL(item.amount);
        doc.text(totalLabel, x, y);
        x += doc.getTextWidth(totalLabel) + 3;

        const itemStatus = lineStatus(item.paid);
        setRgb(doc, itemStatus.color);
        doc.text(itemStatus.text, x, y);
        y += 5;
      }
    }

    y += 1;
    doc.setDrawColor(210, 210, 208);
    doc.line(MARGIN, y, rightX, y);
    y += 5;

    const status = settlementLabel(row.settlement);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setRgb(doc, status.color);
    doc.text(status.text, MARGIN, y);
    const statusW = doc.getTextWidth(status.text);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const openLabel = `Em aberto: ${formatBRL(openAmount)}`;
    const paidLabel = `Pago: ${formatBRL(paidAmount)}`;
    setRgb(doc, COLOR_GREEN);
    doc.text(paidLabel, rightX, y, { align: "right" });
    const paidW = doc.getTextWidth(paidLabel);
    setRgb(doc, COLOR_GRAY);
    doc.text(openLabel, pageW / 2, y, { align: "center" });
    const openW = doc.getTextWidth(openLabel);

    const openLeft = pageW / 2 - openW / 2;
    const openRight = pageW / 2 + openW / 2;
    doc.setDrawColor(190, 190, 188);
    doc.setLineDashPattern([1.2, 1.2], 0);
    if (openLeft - (MARGIN + statusW) > 6) {
      doc.line(MARGIN + statusW + 2, y - 1, openLeft - 2, y - 1);
    }
    if (rightX - paidW - openRight > 6) {
      doc.line(openRight + 2, y - 1, rightX - paidW - 2, y - 1);
    }
    doc.setLineDashPattern([], 0);

    y += 4;
    doc.setDrawColor(230, 230, 228);
    doc.line(MARGIN, y, rightX, y);
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setRgb(doc, COLOR_GRAY);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")}  ·  pág. ${p}/${pages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
  }

  doc.save(`comandas-${fileSafe(input.eventName) || "evento"}.pdf`);
}
