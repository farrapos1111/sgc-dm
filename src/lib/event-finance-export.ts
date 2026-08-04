import { jsPDF } from "jspdf";
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
        4.5 +
        Math.max(0, lines.length - 1) * 4 +
        (it.expense > 0 ? 4 : 0) +
        2;
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
      y += desc.length > 1 ? 5 + (desc.length - 1) * 4 : 5;
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

  doc.save(
    `relatorio-evento-${fileSafe(input.eventName) || "evento"}.pdf`,
  );
}
