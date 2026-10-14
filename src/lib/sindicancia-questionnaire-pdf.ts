import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatDateBR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  formatAtaAnswer,
  isAtaQuestionBlock,
  MEMBER_DOCS_BUCKET,
  SIGNATURE_ROLES,
  type AtaBlock,
} from "@/lib/member-documents";
import {
  applySindicanciaAtaVars,
  seniorAcompanhanteRoleLabel,
} from "@/lib/sindicancia-ata-vars";

const MARGIN = 16;

async function blobToDataUrl(blob: Blob): Promise<string | null> {
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const mime = blob.type || "image/png";
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/** Converte data URL, URL assinada ou path do storage em data URL para o jsPDF. */
async function resolveSignatureDataUrl(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (raw.startsWith("data:image/")) return raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const res = await fetch(raw);
      if (!res.ok) return null;
      return blobToDataUrl(await res.blob());
    } catch {
      return null;
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from(MEMBER_DOCS_BUCKET)
      .download(raw);
    if (error || !data) return null;
    return blobToDataUrl(data);
  } catch {
    return null;
  }
}

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
  /** kind do acompanhante: senior | macom (Tio). */
  seniorKind?: string | null;
  /** ID maçônico do acompanhante (indica Tio mesmo se kind=senior). */
  seniorMasonicId?: string | null;
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
      // Declaração vai para página dedicada com as assinaturas.
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

  // Página dedicada: declaração + assinaturas preenchidas.
  const declBlock = input.blocks.find(
    (b) => b.type === "text" && (b.id === "decl_texto" || b.id.startsWith("decl_")),
  );
  const declarationBody = (() => {
    if (input.declaration?.trim()) return input.declaration.trim();
    if (!declBlock || declBlock.type !== "text") return "";
    return applySindicanciaAtaVars(declBlock.label, {
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
    }).trim();
  })();

  const signerNames = (input.guardians ?? [])
    .map((g) => g.full_name?.trim() || "")
    .filter(Boolean);
  const signerNameByRole: Record<string, string> = {
    senior: input.senior?.trim() || "",
    sindicante: input.sindicante?.trim() || "",
    escrivao: input.escrivao?.trim() || "",
    guardian1: signerNames[0] || "",
    guardian2: signerNames[1] || "",
    nominee: input.nomineeName?.trim() || "",
  };

  const sigEntries = (
    await Promise.all(
      SIGNATURE_ROLES.map(async (role) => {
        const dataUrl = await resolveSignatureDataUrl(
          input.signatures?.[role.id],
        );
        if (!dataUrl) return null;
        const roleLabel =
          role.id === "senior"
            ? seniorAcompanhanteRoleLabel({
                kind: input.seniorKind,
                masonicId: input.seniorMasonicId,
              })
            : role.label;
        return {
          role: roleLabel,
          name: signerNameByRole[role.id] || "—",
          dataUrl,
        };
      }),
    )
  ).filter(
    (x): x is { role: string; name: string; dataUrl: string } => Boolean(x),
  );

  if (declarationBody || sigEntries.length > 0) {
    doc.addPage();
    const footerY = pageH - 10;
    const pageBottom = footerY - 4;
    const cols = sigEntries.length > 4 ? 3 : 2;
    const colGap = 6;
    const colW = (contentW - colGap * (cols - 1)) / cols;
    const imgH = 11;
    const imgW = Math.min(48, colW - 1);
    const blockH = imgH + 12;
    const sigRows = Math.ceil(Math.max(sigEntries.length, 1) / cols);
    const sigHeaderH = sigEntries.length > 0 ? 12 : 0;
    const sigBlockH =
      sigEntries.length > 0 ? sigHeaderH + sigRows * blockH + 2 : 0;

    // Declaração + assinaturas sempre na mesma página (sem addPage interno).
    let yDecl = MARGIN;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26);
    if (declarationBody) {
      doc.text("Declaração de Sindicância", pageW / 2, yDecl, {
        align: "center",
      });
      yDecl += 5;
    }

    const declMaxBottom = pageBottom - sigBlockH - (sigEntries.length ? 4 : 0);
    if (declarationBody) {
      const paras = declarationBody
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      let fontSize = 8.5;
      let lineH = 3.6;
      let paraGap = 1.6;
      let fitted: string[] = [];

      for (let attempt = 0; attempt < 8; attempt++) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        fitted = [];
        for (const p of paras) {
          fitted.push(...(doc.splitTextToSize(p, contentW) as string[]));
          fitted.push(""); // gap marker
        }
        while (fitted.length && fitted[fitted.length - 1] === "") fitted.pop();
        const linesH = fitted.reduce(
          (acc, l) => acc + (l === "" ? paraGap : lineH),
          0,
        );
        if (yDecl + linesH <= declMaxBottom) break;
        fontSize = Math.max(6.5, fontSize - 0.4);
        lineH = Math.max(2.8, lineH - 0.15);
        paraGap = Math.max(1, paraGap - 0.1);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(26);
      for (const l of fitted) {
        if (l === "") {
          yDecl += paraGap;
          continue;
        }
        if (yDecl + lineH > declMaxBottom) break;
        doc.text(l, MARGIN, yDecl);
        yDecl += lineH;
      }
    }

    if (sigEntries.length > 0) {
      let ySig = Math.max(yDecl + 3, pageBottom - sigBlockH);
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, ySig, pageW - MARGIN, ySig);
      ySig += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(26);
      doc.text("Assinaturas", MARGIN, ySig);
      ySig += 5;

      let col = 0;
      let rowTop = ySig;
      for (const sig of sigEntries) {
        const x = MARGIN + col * (colW + colGap);
        try {
          const format = sig.dataUrl.startsWith("data:image/jpeg")
            ? "JPEG"
            : "PNG";
          doc.addImage(sig.dataUrl, format, x, rowTop, imgW, imgH);
        } catch {
          /* ignore invalid image */
        }
        const lineY = rowTop + imgH + 0.8;
        doc.setDrawColor(40);
        doc.setLineWidth(0.25);
        doc.line(x, lineY, x + imgW, lineY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(26);
        const nameLines = doc.splitTextToSize(sig.name, imgW) as string[];
        doc.text(nameLines[0] ?? "—", x, lineY + 3.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(80);
        const roleLines = doc.splitTextToSize(sig.role, imgW) as string[];
        doc.text(roleLines[0] ?? "", x, lineY + 6.5);

        col += 1;
        if (col >= cols) {
          col = 0;
          rowTop += blockH;
        }
      }
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(chapterLine, pageW / 2, pageH - 10, { align: "center" });
  }

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
