import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  INGRESSOS_CATEGORY_ID,
  type EventFinanceTotals,
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
  const parts: string[] = [];
  if (totals.ticketsIncome > 0) {
    parts.push(`Ingressos ${formatBRL(totals.ticketsIncome)}`);
  }
  if (totals.otherIncome > 0) {
    parts.push(`Outros ${formatBRL(totals.otherIncome)}`);
  }
  return parts.join(" · ") || null;
}

export type EventFinancePdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  eventName: string;
  periodLabel: string;
  totals: EventFinanceTotals;
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setRgb(doc, COLOR_BLACK);
  doc.text("Relatório Financeiro do Evento", pageW / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(input.eventName, pageW / 2, y, {
    align: "center",
    maxWidth: contentW,
  });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setRgb(doc, COLOR_GRAY);
  doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
  y += 8;
  setRgb(doc, COLOR_BLACK);

  // Cards de totais
  doc.setFillColor(245, 245, 242);
  doc.rect(MARGIN, y - 4, contentW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total arrecadado", MARGIN + 3, y + 1);
  doc.setFontSize(12);
  setRgb(doc, COLOR_GREEN);
  doc.text(formatBRL(totals.totalIncome), MARGIN + 3, y + 8);

  doc.setFontSize(8);
  setRgb(doc, COLOR_GRAY);
  doc.text(
    `Ingressos ${formatBRL(totals.ticketsIncome)}  ·  Outros ${formatBRL(totals.otherIncome)}`,
    MARGIN + 3,
    y + 14,
  );

  const midX = pageW / 2 + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setRgb(doc, COLOR_BLACK);
  doc.text("Saídas", midX, y + 1);
  doc.setFontSize(12);
  setRgb(doc, COLOR_RED);
  doc.text(formatBRL(totals.totalExpense), midX, y + 8);

  doc.setFontSize(8);
  setRgb(doc, COLOR_GRAY);
  doc.text(`Líquido ${formatBRL(totals.total)}`, midX, y + 14);
  setRgb(doc, COLOR_BLACK);
  y += 26;

  // Por categoria / item
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Arrecadação por categoria", MARGIN, y);
  y += 6;

  const ensureSpace = (need: number) => {
    if (y > pageH - need) {
      doc.addPage();
      y = MARGIN + 4;
      return true;
    }
    return false;
  };

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

  // Lançamentos de caixa (outros itens)
  if (totals.entries.length > 0) {
    ensureSpace(30);
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setRgb(doc, COLOR_BLACK);
    doc.text("Lançamentos no caixa (Eventos)", MARGIN, y);
    y += 6;

    const cols = [
      { x: MARGIN, w: 22 },
      { x: MARGIN + 22, w: 18 },
      { x: MARGIN + 40, w: 40 },
      { x: MARGIN + 80, w: 70 },
    ];

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 238);
      doc.rect(MARGIN, y - 4.5, contentW, 7, "F");
      doc.text("Data", cols[0].x + 1, y);
      doc.text("Tipo", cols[1].x + 1, y);
      doc.text("Item", cols[2].x + 1, y);
      doc.text("Descrição", cols[3].x + 1, y);
      doc.text("Valor", pageW - MARGIN - 1, y, { align: "right" });
      y += 6;
      doc.setFont("helvetica", "normal");
    };

    drawHeader();

    for (const e of totals.entries) {
      const isEntrada = e.kind === "entrada";
      const color = isEntrada ? COLOR_GREEN : COLOR_RED;
      const desc = doc.splitTextToSize(
        e.description || e.subcategory || "—",
        cols[3].w - 2,
      ) as string[];
      const rowH = desc.length > 1 ? 5 + (desc.length - 1) * 4 : 5;
      if (ensureSpace(rowH + 8)) {
        drawHeader();
      }

      doc.setFontSize(9);
      setRgb(doc, COLOR_BLACK);
      doc.text(formatDateBR(e.entry_date), cols[0].x + 1, y);
      setRgb(doc, color);
      doc.text(isEntrada ? "Entrada" : "Saída", cols[1].x + 1, y);
      setRgb(doc, COLOR_BLACK);
      doc.text(
        doc.splitTextToSize(e.subcategory || "—", cols[2].w - 2)[0],
        cols[2].x + 1,
        y,
      );
      doc.text(desc[0] ?? "", cols[3].x + 1, y);
      setRgb(doc, color);
      doc.text(
        `${isEntrada ? "+" : "-"} ${formatBRL(Number(e.amount))}`,
        pageW - MARGIN - 1,
        y,
        { align: "right" },
      );
      setRgb(doc, COLOR_BLACK);
      y += rowH;
      for (let i = 1; i < desc.length; i++) {
        doc.text(desc[i], cols[3].x + 1, y - (desc.length - i) * 4);
      }
      doc.setDrawColor(230, 230, 228);
      doc.line(MARGIN, y - 3.2, pageW - MARGIN, y - 3.2);
    }
  }

  // Rodapé
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

  doc.save(`relatorio-evento-${fileSafe(input.eventName) || "evento"}.pdf`);
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

  let grandOpen = 0;
  let grandPaid = 0;
  for (const r of input.rows) {
    grandPaid += r.ticket_paid_amount;
    grandOpen += Math.max(0, r.ticket_amount - r.ticket_paid_amount);
    for (const i of r.items) {
      if (i.paid) grandPaid += i.amount;
      else grandOpen += i.amount;
    }
  }

  doc.setFillColor(245, 245, 242);
  doc.rect(MARGIN, y - 4, contentW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setRgb(doc, COLOR_BLACK);
  doc.text(`${input.rows.length} comanda(s)`, MARGIN + 3, y + 3);
  setRgb(doc, COLOR_GRAY);
  doc.text(`Em aberto ${formatBRL(grandOpen)}`, pageW / 2, y + 3, {
    align: "center",
  });
  setRgb(doc, COLOR_GREEN);
  doc.text(`Pago ${formatBRL(grandPaid)}`, rightX - 2, y + 3, {
    align: "right",
  });
  setRgb(doc, COLOR_BLACK);
  y += 14;

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
