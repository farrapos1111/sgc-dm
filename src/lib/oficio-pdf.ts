import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatOficioNumber } from "@/lib/oficios.functions";
import { datePartsInAppTz } from "@/lib/timezone";

export type OficioPdfInput = {
  chapterName: string;
  chapterNumber?: string | null;
  chapterCity?: string | null;
  logoPath?: string | null;
  title: string;
  number: number;
  year: number;
  issuedAt?: string | null;
  content: string;
  mcName?: string | null;
  pccName?: string | null;
  escrivaoName?: string | null;
};

const MARGIN = 18;
/** Recuo extra da linha divisória em relação às margens do corpo. */
const RULE_INSET = 4;
const LOGO_MAX = 26;
const SIGNATURE_BLOCK_H = 36;
const SCD_LABEL = "SUPREMO CONSELHO DEMOLAY BRASIL";

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const MONTH_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Data por extenso: "06 de agosto de 2026". */
export function formatOficioDate(iso: string): string {
  const { day, month, year } = datePartsInAppTz(new Date(iso));
  const mes = MONTH_LONG[month - 1] ?? String(month);
  const dd = String(day).padStart(2, "0");
  return `${dd} de ${mes} de ${year}`;
}

/** Remove bloco de assinaturas embutido (ofícios antigos). */
export function stripEmbeddedOficioSignatures(body: string): string {
  const lines = body.split("\n");
  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!/^_{8,}$/.test(lines[i]!.trim())) continue;
    const rest = lines.slice(i).join("\n");
    if (
      /Mestre Conselheiro|Presidente do Conselho Consultivo|Escriv[aã]o/i.test(
        rest,
      )
    ) {
      cut = i;
      break;
    }
  }
  if (cut < 0) return body.replace(/\s+$/, "");
  return lines.slice(0, cut).join("\n").replace(/\s+$/, "");
}

export function chapterOrdemLabel(
  chapterName: string,
  chapterNumber?: string | null,
) {
  const num = chapterNumber?.trim();
  if (num) return `${chapterName} Nº ${num} da Ordem DeMolay`;
  return `${chapterName} da Ordem DeMolay`;
}

function drawSignatures(
  doc: jsPDF,
  y: number,
  pageW: number,
  contentW: number,
  signers: { name: string; role: string }[],
) {
  const colW = contentW / 3;
  const lineY = y + 10;
  doc.setDrawColor(26, 26, 26);
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "normal");

  signers.forEach((s, i) => {
    const x = MARGIN + colW * i + colW / 2;
    const lineHalf = Math.min(28, colW / 2 - 4);
    doc.setLineWidth(0.3);
    doc.line(x - lineHalf, lineY, x + lineHalf, lineY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const nameLines = doc.splitTextToSize(s.name || "—", colW - 4) as string[];
    let ny = lineY + 5;
    for (const nl of nameLines.slice(0, 2)) {
      doc.text(nl, x, ny, { align: "center" });
      ny += 4;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const roleLines = doc.splitTextToSize(s.role, colW - 4) as string[];
    for (const rl of roleLines.slice(0, 2)) {
      doc.text(rl, x, ny, { align: "center" });
      ny += 3.5;
    }
  });
}

/**
 * Cabeçalho oficial:
 * logo → SCD Brasil → nome do capítulo → linha → numeração →
 * “Capítulo Nº N da Ordem DeMolay” → Assunto | Data.
 */
function drawOficioHeader(
  doc: jsPDF,
  pageW: number,
  contentW: number,
  input: OficioPdfInput,
  logoH: number,
): number {
  let y = MARGIN + (logoH ? logoH : 0) + 5;

  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(SCD_LABEL, pageW / 2, y, { align: "center", maxWidth: contentW });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const chapterLines = doc.splitTextToSize(
    input.chapterName || "Capítulo",
    contentW,
  ) as string[];
  for (const line of chapterLines.slice(0, 2)) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 5;
  }
  y += 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.55);
  doc.line(MARGIN + RULE_INSET, y, pageW - MARGIN - RULE_INSET, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const numbering = `Ofício ${formatOficioNumber(input.number, input.year)}`;
  doc.text(numbering, pageW / 2, y, { align: "center", maxWidth: contentW });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const ordem = chapterOrdemLabel(input.chapterName, input.chapterNumber);
  const ordemLines = doc.splitTextToSize(ordem, contentW) as string[];
  for (const line of ordemLines.slice(0, 2)) {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 4.5;
  }
  y += 6;

  // Assunto (esquerda) e data (direita), mesma linha-base.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dateStr = input.issuedAt ? formatOficioDate(input.issuedAt) : "";
  const dateW = dateStr
    ? (doc.getTextWidth(dateStr) as number) + 2
    : 0;
  const assuntoMax = Math.max(40, contentW - dateW - 8);
  const assuntoLabel = `Assunto: ${input.title || "—"}`;
  const assuntoLines = doc.splitTextToSize(assuntoLabel, assuntoMax) as string[];
  const first = assuntoLines[0] ?? "Assunto: —";
  doc.text(first, MARGIN, y, { align: "left" });
  if (dateStr) {
    doc.text(dateStr, pageW - MARGIN, y, { align: "right" });
  }
  for (let i = 1; i < Math.min(assuntoLines.length, 3); i++) {
    y += 5;
    doc.text(assuntoLines[i]!, MARGIN, y, { align: "left" });
  }
  y += 8;

  return y;
}

/** Gera e baixa o PDF do ofício: cabeçalho oficial, corpo e assinaturas PCC · MC · ESC. */
export async function exportOficioPdf(input: OficioPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  const logo = await loadLogoDataUrl(input.logoPath);
  let logoH = 0;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      logoH = ratio >= 1 ? LOGO_MAX / ratio : LOGO_MAX;
      const logoW = logoH * ratio;
      doc.addImage(logo, (pageW - logoW) / 2, MARGIN - 6, logoW, logoH);
    } catch {
      logoH = 0;
    }
  }

  let y = drawOficioHeader(doc, pageW, contentW, input, logoH);

  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const footerText = `${input.chapterName}${input.chapterCity ? ` — ${input.chapterCity}` : ""}`;
  const bottomLimit = pageH - MARGIN - 8 - SIGNATURE_BLOCK_H;

  const body = stripEmbeddedOficioSignatures(input.content || "");
  const paragraphs = body.split(/\n/);
  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph || " ", contentW) as string[];
    for (const line of lines) {
      if (y > bottomLimit) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y, { align: "justify", maxWidth: contentW });
      y += 6;
    }
  }

  if (y + SIGNATURE_BLOCK_H > pageH - MARGIN - 8) {
    doc.addPage();
    y = MARGIN + 4;
  } else {
    y += 10;
  }

  drawSignatures(doc, y, pageW, contentW, [
    {
      name: input.pccName?.trim() || "—",
      role: "Presidente do Conselho Consultivo",
    },
    { name: input.mcName?.trim() || "—", role: "Mestre Conselheiro" },
    { name: input.escrivaoName?.trim() || "—", role: "Escrivão" },
  ]);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 107, 107);
    doc.text(footerText, pageW / 2, pageH - 10, { align: "center" });
    doc.text(`${i}/${pages}`, pageW - MARGIN, pageH - 10, { align: "right" });
  }

  doc.save(
    `oficio-${input.number}-${input.year}-${fileSafe(input.title) || "documento"}.pdf`,
  );
}
