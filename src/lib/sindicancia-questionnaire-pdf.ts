import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatDateBR } from "@/lib/format";
import {
  formatAtaAnswer,
  isAtaQuestionBlock,
  SIGNATURE_ROLES,
  type AtaBlock,
} from "@/lib/member-documents";
import { applySindicanciaAtaVars } from "@/lib/sindicancia-ata-vars";

const MARGIN = 16;

export type SindicanciaQuestionnairePdfInput = {
  chapterName: string;
  chapterNumber?: string | number | null;
  chapterCity?: string | null;
  logoPath?: string | null;
  ageBandLabel: string;
  nomineeName: string;
  birthDate?: string | null;
  cpf?: string | null;
  rg?: string | null;
  email?: string | null;
  phone?: string | null;
  sponsor?: string | null;
  guardians?: Array<{ full_name?: string; relationship?: string }> | null;
  sindicante?: string | null;
  senior?: string | null;
  escrivao?: string | null;
  eventDate?: string | null;
  blocks: AtaBlock[];
  answers: Record<string, string | boolean | null>;
  /** Texto da declaração já com variáveis aplicadas (opcional). */
  declaration?: string | null;
  /** Assinaturas em data URL (image/png). */
  signatures?: Record<string, string | null> | null;
};

function ensureSpace(
  doc: jsPDF,
  y: number,
  need: number,
  pageH: number,
): number {
  if (y + need <= pageH - MARGIN) return y;
  doc.addPage();
  return MARGIN;
}

/** PDF do questionário: dados da ficha + perguntas e respostas. */
export async function exportSindicanciaQuestionnairePdf(
  input: SindicanciaQuestionnairePdfInput,
) {
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
      const logoH = 16;
      const logoW = logoH * ratio;
      doc.addImage(logo, (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 5;
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Questionário de Sindicância Admissional", pageW / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const chapterLine = [
    input.chapterName,
    input.chapterNumber != null && String(input.chapterNumber).trim()
      ? `nº ${input.chapterNumber}`
      : null,
    input.chapterCity,
  ]
    .filter(Boolean)
    .join(" — ");
  doc.text(chapterLine, pageW / 2, y, { align: "center" });
  y += 5;
  doc.text(input.ageBandLabel, pageW / 2, y, { align: "center" });
  y += 8;
  doc.setTextColor(26);

  const meta: Array<[string, string]> = [
    ["Indicado", input.nomineeName],
    [
      "Nascimento",
      input.birthDate ? formatDateBR(input.birthDate) : "—",
    ],
    ["CPF", input.cpf?.trim() || "—"],
    ["RG", input.rg?.trim() || "—"],
    ["E-mail", input.email?.trim() || "—"],
    ["Telefone", input.phone?.trim() || "—"],
    ["Padrinho", input.sponsor?.trim() || "—"],
    ["Sindicante", input.sindicante?.trim() || "—"],
    ["Escrivão", input.escrivao?.trim() || "—"],
    ["Tio/Senior", input.senior?.trim() || "—"],
  ];
  if (input.eventDate) {
    meta.push([
      "Data",
      new Date(input.eventDate).toLocaleString("pt-BR"),
    ]);
  }
  const guardians = (input.guardians ?? []).filter((g) => g.full_name?.trim());
  guardians.forEach((g, i) => {
    meta.push([
      `Responsável ${i + 1}`,
      [g.full_name, g.relationship].filter(Boolean).join(" · "),
    ]);
  });

  doc.setFontSize(9);
  for (const [label, value] of meta) {
    y = ensureSpace(doc, y, 8, pageH);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, contentW - 38) as string[];
    doc.text(lines, MARGIN + 36, y);
    y += Math.max(5, lines.length * 4.2);
  }

  y += 4;
  y = ensureSpace(doc, y, 6, pageH);
  doc.setDrawColor(200);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 6;

  for (const block of input.blocks) {
    if (block.showWhen) {
      const raw = input.answers[block.showWhen.id];
      if (raw !== block.showWhen.equals) continue;
    }

    if (block.type === "heading") {
      y = ensureSpace(doc, y, 10, pageH);
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(block.label, MARGIN, y);
      y += 6;
      continue;
    }

    if (block.type === "text") {
      // Declaração e intros: só a declaração final entra no PDF (perguntas/respostas);
      // textos introdutórios de seção ficam de fora para manter o relatório enxuto.
      if (block.id === "decl_texto" || block.id.startsWith("decl_")) {
        const rendered = applySindicanciaAtaVars(block.label, {
          candidato: input.nomineeName,
          rg: input.rg,
          cpf: input.cpf,
          capitulo_nome: input.chapterName,
          numero: input.chapterNumber,
          cidade: input.chapterCity,
          sindicante: input.sindicante,
          escrivao: input.escrivao,
          senior: input.senior,
          date: input.eventDate,
        });
        const body = input.declaration?.trim() || rendered;
        y = ensureSpace(doc, y, 12, pageH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Declaração de Sindicância", MARGIN, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const paras = body.split(/\n+/);
        for (const p of paras) {
          const lines = doc.splitTextToSize(p.trim(), contentW) as string[];
          for (const l of lines) {
            y = ensureSpace(doc, y, 5, pageH);
            doc.text(l, MARGIN, y);
            y += 4.2;
          }
          y += 2;
        }
      }
      continue;
    }

    if (!isAtaQuestionBlock(block)) continue;

    const answer = formatAtaAnswer(input.answers[block.id]);
    if (!answer && block.required === false) {
      // opcional em branco: omitir do PDF
      continue;
    }

    y = ensureSpace(doc, y, 12, pageH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const qLines = doc.splitTextToSize(block.label, contentW) as string[];
    for (const l of qLines) {
      y = ensureSpace(doc, y, 5, pageH);
      doc.text(l, MARGIN, y);
      y += 4.2;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    const aLines = doc.splitTextToSize(
      answer || "—",
      contentW - 4,
    ) as string[];
    for (const l of aLines) {
      y = ensureSpace(doc, y, 5, pageH);
      doc.text(l, MARGIN + 2, y);
      y += 4.2;
    }
    doc.setTextColor(26);
    y += 3;
  }

  const sigEntries = SIGNATURE_ROLES.map((role) => {
    const dataUrl = input.signatures?.[role.id];
    if (!dataUrl?.startsWith("data:image")) return null;
    return { label: role.label, dataUrl };
  }).filter((x): x is { label: string; dataUrl: string } => Boolean(x));

  if (sigEntries.length > 0) {
    y = ensureSpace(doc, y, 14, pageH);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26);
    doc.text("Assinaturas", MARGIN, y);
    y += 6;

    for (const sig of sigEntries) {
      y = ensureSpace(doc, y, 28, pageH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(sig.label, MARGIN, y);
      y += 3;
      try {
        doc.addImage(sig.dataUrl, "PNG", MARGIN, y, 60, 20);
      } catch {
        /* ignore invalid image */
      }
      y += 24;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(chapterLine, pageW / 2, pageH - 10, { align: "center" });

  const dateSrc = input.eventDate ? new Date(input.eventDate) : new Date();
  const dd = String(dateSrc.getDate()).padStart(2, "0");
  const mm = String(dateSrc.getMonth() + 1).padStart(2, "0");
  const yyyy = String(dateSrc.getFullYear());
  // Formato pedido: Sindicancia [indicado] [dd/mm/aaaa] — "/" vira "-" no SO.
  const namePart =
    input.nomineeName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Indicado";
  doc.save(`Sindicancia ${namePart} ${dd}-${mm}-${yyyy}.pdf`);
}
