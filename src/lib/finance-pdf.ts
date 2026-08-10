import { jsPDF } from "jspdf";
import { ensurePdfLogoDataUrl, loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatBRL, formatDateBR } from "@/lib/format";

type Entry = {
  entry_date: string;
  kind: string;
  category: string;
  description: string;
  amount: number | string;
};

type FinancePdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  /** Data URL pré-carregada (ex.: link público sem sessão autenticada). */
  logoDataUrl?: string | null;
  periodLabel: string;
  entries: Entry[];
  totals: { income: number; expense: number; balance: number };
  opening?: {
    balance: number;
    previousYear: number;
    title?: string;
    hint?: string;
  } | null;
  /** Valor do card de saldo (atual ou final do período). */
  cashBalance?: number | null;
  cashBalanceLabel?: string;
  signers: Array<{
    role: string;
    name: string;
    signatureDataUrl?: string | null;
  }>;
};

const MARGIN = 15;
const LOGO_MAX = 24;

const COLOR_GREEN = [4, 120, 87] as const;   // #047857
const COLOR_RED = [185, 28, 28] as const;     // #B91C1C
const COLOR_BLACK = [26, 26, 26] as const;
const COLOR_GRAY = [107, 107, 107] as const;

type Rgb = readonly [number, number, number];

function setRgb(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

const monthName = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function groupByMonth(entries: Entry[]) {
  const groups = new Map<number, Entry[]>();
  for (const e of entries) {
    const m = Number(String(e.entry_date).slice(5, 7));
    if (!m) continue;
    const list = groups.get(m) ?? [];
    list.push(e);
    groups.set(m, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, list]) => {
      let income = 0;
      let expense = 0;
      for (const e of list) {
        if (e.kind === "entrada") income += Number(e.amount);
        else expense += Number(e.amount);
      }
      return { month: m, entries: list, income, expense, balance: income - expense };
    });
}

/** Relatório de fluxo de caixa: logo, período, meses agrupados, totais e assinaturas. */
export async function exportCashPdf(input: FinancePdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  const logo = await ensurePdfLogoDataUrl(
    input.logoDataUrl ?? (await loadLogoDataUrl(input.logoPath)),
  );
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
  doc.text(input.chapterName, pageW / 2, y, { align: "center", maxWidth: contentW });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de Fluxo de Caixa", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(10);
  setRgb(doc, COLOR_GRAY);
  doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
  y += 8;
  setRgb(doc, COLOR_BLACK);

  const opening = input.opening;
  const openingBalance = opening?.balance ?? 0;
  const cashBalance =
    input.cashBalance != null
      ? input.cashBalance
      : opening
        ? openingBalance + input.totals.balance
        : input.totals.balance;
  const cashBalanceLabel = input.cashBalanceLabel ?? "Saldo Atual do Caixa";

  if (opening) {
    const openingTitle =
      opening.title ?? `Saldo remanescente do ano ${opening.previousYear}`;
    const openingHint =
      opening.hint ??
      "Caixa transferido do exercício anterior (chão deste relatório).";

    doc.setFillColor(245, 245, 242);
    doc.rect(MARGIN, y - 4, contentW, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(openingTitle, MARGIN + 3, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(openingHint, MARGIN + 3, y + 6.5, { maxWidth: contentW - 50 });
    setRgb(doc, COLOR_BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(formatBRL(openingBalance), pageW - MARGIN - 3, y + 3.5, { align: "right" });
    y += 18;
    doc.setFont("helvetica", "normal");
  }

  const cols = [
    { label: "Data", x: MARGIN, w: 22 },
    { label: "Tipo", x: MARGIN + 22, w: 18 },
    { label: "Categoria", x: MARGIN + 40, w: 38 },
    { label: "Descrição", x: MARGIN + 78, w: 72 },
    { label: "Valor", x: pageW - MARGIN, w: 0 },
  ];

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setRgb(doc, COLOR_BLACK);
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN, y - 4.5, contentW, 7, "F");
    doc.text("Data", cols[0].x + 1, y);
    doc.text("Tipo", cols[1].x + 1, y);
    doc.text("Categoria", cols[2].x + 1, y);
    doc.text("Descrição", cols[3].x + 1, y);
    doc.text("Valor", cols[4].x - 1, y, { align: "right" });
    y += 6;
    doc.setFont("helvetica", "normal");
  };

  const drawRow = (e: Entry) => {
    if (y > pageH - 30) {
      doc.addPage();
      y = MARGIN + 4;
      drawHeader();
    }
    const isEntrada = e.kind === "entrada";
    const color = isEntrada ? COLOR_GREEN : COLOR_RED;
    const desc = doc.splitTextToSize(e.description, cols[3].w - 2) as string[];

    doc.setFontSize(9);
    setRgb(doc, COLOR_BLACK);
    doc.text(formatDateBR(e.entry_date), cols[0].x + 1, y);

    setRgb(doc, color);
    doc.text(isEntrada ? "Entrada" : "Saída", cols[1].x + 1, y);

    setRgb(doc, COLOR_BLACK);
    doc.text(doc.splitTextToSize(e.category, cols[2].w - 2)[0], cols[2].x + 1, y);
    doc.text(desc[0] ?? "", cols[3].x + 1, y);

    setRgb(doc, color);
    doc.text(
      `${isEntrada ? "+" : "-"} ${formatBRL(Number(e.amount))}`,
      cols[4].x - 1,
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
  };

  const drawMonthSummary = (label: string, income: number, expense: number, balance: number) => {
    if (y > pageH - 20) {
      doc.addPage();
      y = MARGIN + 4;
    }
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const summaryY = y;

    setRgb(doc, COLOR_GREEN);
    doc.text(`Entradas: ${formatBRL(income)}`, MARGIN + 2, summaryY);

    setRgb(doc, COLOR_RED);
    doc.text(`Saídas: ${formatBRL(expense)}`, MARGIN + 55, summaryY);

    setRgb(doc, COLOR_BLACK);
    doc.text(`Resultado: ${formatBRL(balance)}`, MARGIN + 105, summaryY);

    y += 6;
    doc.setFont("helvetica", "normal");
  };

  const months = groupByMonth(input.entries);

  if (months.length <= 1) {
    drawHeader();
    for (const e of input.entries) drawRow(e);
  } else {
    for (const group of months) {
      if (y > pageH - 30) {
        doc.addPage();
        y = MARGIN + 4;
      }

      doc.setFillColor(232, 232, 228);
      doc.rect(MARGIN, y - 4.5, contentW, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setRgb(doc, COLOR_BLACK);
      const yearStr = String(input.entries[0]?.entry_date ?? "").slice(0, 4) || "";
      doc.text(
        `${monthName(group.month).charAt(0).toUpperCase() + monthName(group.month).slice(1)}${yearStr ? ` de ${yearStr}` : ""}`,
        MARGIN + 2,
        y,
      );
      y += 6;

      drawHeader();
      for (const e of group.entries) drawRow(e);
      drawMonthSummary(
        monthName(group.month),
        group.income,
        group.expense,
        group.balance,
      );
    }
  }

  if (input.entries.length === 0) {
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhuma movimentação no período.", MARGIN + 1, y);
    setRgb(doc, COLOR_BLACK);
    y += 6;
  }

  // Totais gerais
  if (y > pageH - 45) {
    doc.addPage();
    y = MARGIN + 4;
  }
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const totalLine = (label: string, value: string, color?: readonly [number, number, number]) => {
    setRgb(doc, COLOR_BLACK);
    doc.text(label, pageW - MARGIN - 45, y, { align: "right" });
    setRgb(doc, (color ?? COLOR_BLACK));
    doc.text(value, pageW - MARGIN, y, { align: "right" });
    setRgb(doc, COLOR_BLACK);
    y += 5.5;
  };

  doc.setDrawColor(180, 180, 180);
  doc.line(MARGIN + 60, y - 3, pageW - MARGIN, y - 3);
  y += 1;

  totalLine("Total de entradas:", formatBRL(input.totals.income), COLOR_GREEN);
  totalLine("Total de saídas:", formatBRL(input.totals.expense), COLOR_RED);
  totalLine("Resultado do período:", formatBRL(input.totals.balance));
  if (opening) {
    totalLine(
      `Restante de ${opening.previousYear}:`,
      formatBRL(openingBalance),
    );
  }
  totalLine(`${cashBalanceLabel}:`, formatBRL(cashBalance));

  // Assinaturas (última página)
  doc.addPage();
  let sy = MARGIN + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRgb(doc, COLOR_BLACK);
  doc.text("Assinaturas", pageW / 2, sy, { align: "center" });
  sy += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, COLOR_GRAY);
  doc.text(`${input.chapterName} · ${input.periodLabel}`, pageW / 2, sy, { align: "center" });
  setRgb(doc, COLOR_BLACK);
  sy += 22;

  for (const signer of input.signers) {
    if (signer.signatureDataUrl?.startsWith("data:image/")) {
      try {
        const props = doc.getImageProperties(signer.signatureDataUrl);
        const maxW = 55;
        const maxH = 18;
        const ratio = props.width / props.height;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        doc.addImage(
          signer.signatureDataUrl,
          (pageW - w) / 2,
          sy - h + 2,
          w,
          h,
        );
        sy += 4;
      } catch {
        /* imagem inválida — cai na linha */
      }
    }
    doc.setDrawColor(120, 120, 120);
    doc.line(MARGIN + 20, sy, pageW - MARGIN - 20, sy);
    sy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(signer.name || "____________________", pageW / 2, sy, { align: "center" });
    sy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setRgb(doc, COLOR_GRAY);
    doc.text(signer.role, pageW / 2, sy, { align: "center" });
    setRgb(doc, COLOR_BLACK);
    sy += 26;
  }

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const footer = [input.chapterName, input.chapterCity].filter(Boolean).join(" — ");
    doc.text(footer, MARGIN, pageH - 8);
    doc.text(`${p}/${pages}`, pageW - MARGIN, pageH - 8, { align: "right" });
  }

  doc.save(`fluxo-de-caixa-${fileSafe(input.periodLabel)}.pdf`);
}
