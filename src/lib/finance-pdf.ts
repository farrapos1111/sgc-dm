import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
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
  periodLabel: string;
  entries: Entry[];
  totals: { income: number; expense: number; balance: number };
  signers: Array<{ role: string; name: string }>;
};

const MARGIN = 15;
const LOGO_MAX = 24;

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Relatório de fluxo de caixa: logo, período, tabela, totais e assinaturas. */
export async function exportCashPdf(input: FinancePdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

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
  doc.text(input.chapterName, pageW / 2, y, { align: "center", maxWidth: contentW });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de Fluxo de Caixa", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(107, 107, 107);
  doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
  y += 8;
  doc.setTextColor(26, 26, 26);

  // Cabeçalho da tabela
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

  drawHeader();

  doc.setFontSize(9);
  for (const e of input.entries) {
    if (y > pageH - 30) {
      doc.addPage();
      y = MARGIN + 4;
      drawHeader();
    }
    const desc = doc.splitTextToSize(e.description, cols[3].w - 2) as string[];
    doc.text(formatDateBR(e.entry_date), cols[0].x + 1, y);
    doc.text(e.kind === "entrada" ? "Entrada" : "Saída", cols[1].x + 1, y);
    doc.text(doc.splitTextToSize(e.category, cols[2].w - 2)[0], cols[2].x + 1, y);
    doc.text(desc[0] ?? "", cols[3].x + 1, y);
    doc.text(
      `${e.kind === "entrada" ? "+" : "-"} ${formatBRL(Number(e.amount))}`,
      cols[4].x - 1,
      y,
      { align: "right" },
    );
    y += desc.length > 1 ? 5 + (desc.length - 1) * 4 : 5;
    for (let i = 1; i < desc.length; i++) {
      doc.text(desc[i], cols[3].x + 1, y - (desc.length - i) * 4);
    }
    doc.setDrawColor(230, 230, 228);
    doc.line(MARGIN, y - 3.2, pageW - MARGIN, y - 3.2);
  }

  if (input.entries.length === 0) {
    doc.setTextColor(107, 107, 107);
    doc.text("Nenhuma movimentação no período.", MARGIN + 1, y);
    doc.setTextColor(26, 26, 26);
    y += 6;
  }

  // Totais
  if (y > pageH - 45) {
    doc.addPage();
    y = MARGIN + 4;
  }
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const totalLine = (label: string, value: string) => {
    doc.text(label, pageW - MARGIN - 45, y, { align: "right" });
    doc.text(value, pageW - MARGIN, y, { align: "right" });
    y += 5.5;
  };
  totalLine("Total de entradas:", formatBRL(input.totals.income));
  totalLine("Total de saídas:", formatBRL(input.totals.expense));
  totalLine("Saldo:", formatBRL(input.totals.balance));

  // Assinaturas (última página)
  doc.addPage();
  let sy = MARGIN + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Assinaturas", pageW / 2, sy, { align: "center" });
  sy += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 107, 107);
  doc.text(`${input.chapterName} · ${input.periodLabel}`, pageW / 2, sy, { align: "center" });
  doc.setTextColor(26, 26, 26);
  sy += 22;

  for (const signer of input.signers) {
    doc.setDrawColor(120, 120, 120);
    doc.line(MARGIN + 20, sy, pageW - MARGIN - 20, sy);
    sy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(signer.name || "____________________", pageW / 2, sy, { align: "center" });
    sy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 107, 107);
    doc.text(signer.role, pageW / 2, sy, { align: "center" });
    doc.setTextColor(26, 26, 26);
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
