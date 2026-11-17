import type { jsPDF } from "jspdf";
import { ensurePdfLogoDataUrl, loadLogoDataUrl } from "@/lib/chapter-logo";

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
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export type AttendancePdfRow = {
  name: string;
  situation: string;
  present: number;
  total: number;
  pct: number | null;
  obs: string;
};

export type AttendancePdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  periodLabel: string;
  /** Limite (%) para destacar em verde; abaixo disso fica vermelho. */
  threshold: number;
  subtitle?: string;
  rows: AttendancePdfRow[];
  issuedAt?: Date;
};

/** Relatório de frequência do capítulo (por ano, semestre ou janela de meses). */
export async function exportAttendancePdf(input: AttendancePdfInput) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const issued = input.issuedAt ?? new Date();

  const logo = await ensurePdfLogoDataUrl(await loadLogoDataUrl(input.logoPath));
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
  doc.text(input.chapterName, pageW / 2, y, { align: "center", maxWidth: contentW });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setRgb(doc, COLOR_GRAY);
  const issuedLong = issued.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.text(
    [input.chapterCity?.trim(), issuedLong].filter(Boolean).join(" | "),
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setRgb(doc, COLOR_BLACK);
  doc.text("Relatório de Frequência", pageW / 2, y, { align: "center" });
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(input.periodLabel, pageW / 2, y, { align: "center" });
  y += 5;
  if (input.subtitle) {
    doc.setFontSize(8.5);
    setRgb(doc, COLOR_GRAY);
    const lines = doc.splitTextToSize(input.subtitle, contentW) as string[];
    for (const line of lines) {
      doc.text(line, pageW / 2, y, { align: "center" });
      y += 4;
    }
    setRgb(doc, COLOR_BLACK);
  }
  y += 5;

  const colSit = MARGIN + contentW * 0.3;
  const colPresent = MARGIN + contentW * 0.46;
  const colAbsent = MARGIN + contentW * 0.54;
  const colPct = MARGIN + contentW * 0.64;
  const colObs = MARGIN + contentW * 0.66;
  const obsW = pageW - MARGIN - colObs - 2;

  const drawHeader = () => {
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGIN, y - 5, contentW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setRgb(doc, COLOR_BLACK);
    doc.text("Nome", MARGIN + 2, y);
    doc.text("Situação", colSit - 12, y);
    doc.text("Presenças", colPresent, y, { align: "right" });
    doc.text("Faltas", colAbsent, y, { align: "right" });
    doc.text("Frequência", colPct, y, { align: "right" });
    doc.text("Obs.", colObs + 2, y);
    y += 8;
  };
  drawHeader();

  if (input.rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhum membro elegível no período.", MARGIN + 2, y);
    setRgb(doc, COLOR_BLACK);
    y += 8;
  }

  for (const r of input.rows) {
    doc.setFontSize(8.5);
    const obsLines = r.obs ? (doc.splitTextToSize(r.obs, obsW) as string[]) : [];
    const rowH = Math.max(6.5, obsLines.length * 4 + 2.5);
    if (y + rowH > pageH - 15) {
      doc.addPage();
      y = MARGIN + 4;
      drawHeader();
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setRgb(doc, COLOR_BLACK);
    const name = (doc.splitTextToSize(r.name, colSit - 12 - MARGIN - 4) as string[])[0] ?? "";
    doc.text(name, MARGIN + 2, y);
    doc.text(r.situation, colSit - 12, y);
    doc.text(String(r.present), colPresent, y, { align: "right" });
    doc.text(String(r.total - r.present), colAbsent, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    setRgb(
      doc,
      r.pct === null ? COLOR_GRAY : r.pct >= input.threshold ? COLOR_GREEN : COLOR_RED,
    );
    doc.text(r.pct === null ? "-" : `${r.pct}%`, colPct, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setRgb(doc, COLOR_GRAY);
    obsLines.forEach((line, i) => doc.text(line, colObs + 2, y + i * 4));
    setRgb(doc, COLOR_BLACK);
    doc.setDrawColor(230, 230, 228);
    doc.line(MARGIN, y + rowH - 4, pageW - MARGIN, y + rowH - 4);
    y += rowH;
  }

  // Resumo
  const withPct = input.rows.filter((r) => r.pct !== null);
  const sumPresent = input.rows.reduce((s, r) => s + r.present, 0);
  const sumTotal = input.rows.reduce((s, r) => s + r.total, 0);
  const avg = sumTotal > 0 ? Math.round((sumPresent / sumTotal) * 100) : null;
  const above = withPct.filter((r) => (r.pct ?? 0) >= input.threshold).length;

  if (y > pageH - 40) {
    doc.addPage();
    y = MARGIN + 4;
  }
  y += 4;
  doc.setDrawColor(120, 120, 120);
  doc.line(MARGIN, y - 3, pageW - MARGIN, y - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setRgb(doc, COLOR_BLACK);
  doc.text(`Membros no relatório: ${input.rows.length}`, MARGIN + 2, y + 2);
  doc.text(
    `Frequência média do capítulo: ${avg === null ? "-" : `${avg}%`}`,
    pageW - MARGIN - 2,
    y + 2,
    { align: "right" },
  );
  y += 7;
  doc.setFont("helvetica", "normal");
  setRgb(doc, COLOR_GRAY);
  doc.text(
    `${above} de ${withPct.length} com frequência igual ou superior a ${input.threshold}%.`,
    MARGIN + 2,
    y + 2,
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const footer = [input.chapterName, input.chapterCity].filter(Boolean).join(" — ");
    doc.text(footer, MARGIN, pageH - 8);
    doc.text(`${p}/${pages}`, pageW - MARGIN, pageH - 8, { align: "right" });
  }

  doc.save(`frequencia-${fileSafe(input.periodLabel)}.pdf`);
}
