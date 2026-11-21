import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { todayYmd } from "@/lib/timezone";

export type CalendarPdfItem = {
  start_at: string;
  end_at: string | null;
  /** Rótulo já resolvido do tipo (ex.: "Sessão Ritualística"). */
  typeLabel: string;
  title: string;
  description?: string | null;
  location?: string | null;
};

export type CalendarPdfInput = {
  /** Ex.: "Capítulo" */
  orgLabel: string;
  orgName: string;
  /** Texto do período, ex.: "2º Semestre de 2026". */
  periodLabel: string;
  logoPath?: string | null;
  items: CalendarPdfItem[];
};

export const MAX_COLS = 5;
export const ROWS_PER_PAGE = 3;

export type CalendarCell = CalendarPdfItem & { dayKey: string; past: boolean };

/**
 * Agrupa por mês (cada mês começa uma nova linha), quebra meses com mais de
 * MAX_COLS datas em várias linhas e distribui ROWS_PER_PAGE linhas por página.
 */
export function layoutCalendarRows(
  items: CalendarPdfItem[],
  today: string = todayYmd(),
): CalendarCell[][][] {
  const cells: CalendarCell[] = items
    .map((it) => {
      const dayKey = todayYmd(it.start_at);
      const lastKey = todayYmd(it.end_at ?? it.start_at);
      return { ...it, dayKey, past: lastKey < today };
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const rows: CalendarCell[][] = [];
  let currentMonth = "";
  for (const cell of cells) {
    const month = cell.dayKey.slice(0, 7);
    const last = rows[rows.length - 1];
    if (!last || month !== currentMonth || last.length >= MAX_COLS) {
      rows.push([cell]);
      currentMonth = month;
    } else {
      last.push(cell);
    }
  }

  const pages: CalendarCell[][][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    pages.push(rows.slice(i, i + ROWS_PER_PAGE));
  }
  return pages;
}

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function formatCellDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${d}/${months[Number(m) - 1]}/${y}`;
}

const MARGIN = 12;
const GREEN: [number, number, number] = [22, 163, 74];

/** Gera e baixa o PDF (A4 paisagem, fundo branco, 3 linhas × até 5 datas). */
export async function exportCalendarPdf(input: CalendarPdfInput) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  const logo = await loadLogoDataUrl(input.logoPath);
  const title = `Calendário de atividades do ${input.orgLabel} ${input.orgName}`;
  const pages = layoutCalendarRows(input.items);
  if (pages.length === 0) pages.push([]);

  const HEADER_H = 30;
  const gridTop = MARGIN + HEADER_H;
  const rowGap = 6;
  const rowH = (pageH - gridTop - MARGIN - rowGap * (ROWS_PER_PAGE - 1)) / ROWS_PER_PAGE;

  pages.forEach((rows, pageIdx) => {
    if (pageIdx > 0) doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, "F");

    // Brasão
    let logoW = 0;
    if (logo) {
      try {
        const props = doc.getImageProperties(logo);
        const ratio = props.width / props.height;
        const maxH = 22;
        const h = ratio >= 1 ? Math.min(maxH, maxH / ratio) : maxH;
        logoW = h * ratio;
        doc.addImage(logo, MARGIN, MARGIN, logoW, h);
      } catch {
        logoW = 0;
      }
    }

    // Título
    doc.setTextColor(26, 26, 26);
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(16);
    doc.text(title, pageW / 2, MARGIN + 9, {
      align: "center",
      maxWidth: contentW - (logoW + 8) * 2,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(input.periodLabel, pageW / 2, MARGIN + 17, { align: "center" });

    rows.forEach((row, r) => {
      const y = gridTop + r * (rowH + rowGap);
      const cellW = contentW / MAX_COLS;
      // Mesma largura de célula em todas as linhas; linha incompleta fica alinhada à esquerda.
      row.forEach((cell, c) => {
        drawCell(doc, cell, MARGIN + c * cellW, y, cellW, rowH);
      });
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Página ${pageIdx + 1} de ${pages.length}`, pageW - MARGIN, pageH - 5, {
      align: "right",
    });
  });

  if (input.items.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(110, 110, 110);
    doc.text("Nenhuma atividade no período.", pageW / 2, pageH / 2, {
      align: "center",
    });
  }

  doc.save(`calendario-${fileSafe(input.orgName)}-${fileSafe(input.periodLabel)}.pdf`);
}

type Doc = InstanceType<Awaited<typeof import("jspdf")>["jsPDF"]>;

function drawCell(
  doc: Doc,
  cell: CalendarCell,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const pad = 2;
  const headH = 6.5;
  const typeH = 6.5;
  const footH = 12;

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
  doc.line(x, y + headH, x + w, y + headH);
  doc.line(x, y + headH + typeH, x + w, y + headH + typeH);
  doc.line(x, y + h - footH, x + w, y + h - footH);

  // Data
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(formatCellDate(cell.dayKey), x + w / 2, y + 4.6, { align: "center" });

  // Tipo
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const typeLines = doc.splitTextToSize(cell.typeLabel, w - pad * 2) as string[];
  doc.text(typeLines[0] ?? "", x + w / 2, y + headH + 4.5, { align: "center" });

  // Pauta
  const bodyTop = y + headH + typeH;
  const bodyH = h - headH - typeH - footH;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Pauta:", x + w / 2, bodyTop + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const pauta = [cell.title, cell.description?.trim()].filter(Boolean).join(" — ");
  const lines = doc.splitTextToSize(pauta, w - pad * 2) as string[];
  const maxLines = Math.max(1, Math.floor((bodyH - 9) / 3.3));
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    shown[maxLines - 1] = `${shown[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  }
  doc.text(shown, x + w / 2, bodyTop + 9, { align: "center", lineHeightFactor: 1.15 });

  // Local
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Local:", x + w / 2, y + h - footH + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  const locLines = doc.splitTextToSize(
    cell.location?.trim() || "A definir",
    w - pad * 2,
  ) as string[];
  doc.text(locLines.slice(0, 2), x + w / 2, y + h - footH + 7.5, {
    align: "center",
    lineHeightFactor: 1.15,
  });

  if (cell.past) drawCheck(doc, x + w - 6.5, y + 1, 5);
}

/** Check verde vetorial (a fonte padrão do PDF não tem ✓). */
function drawCheck(doc: Doc, x: number, y: number, size: number) {
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.lines(
    [
      [size * 0.3, size * 0.3],
      [size * 0.7, -size * 0.75],
    ],
    x,
    y + size * 0.55,
    [1, 1],
    "S",
    false,
  );
  doc.setLineWidth(0.25);
}
