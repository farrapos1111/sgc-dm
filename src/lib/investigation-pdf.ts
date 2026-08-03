import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatDateBR } from "@/lib/format";

type Guardian = {
  full_name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
};

type Address = {
  zip?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type InvestigationPdfInput = {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  candidate_name: string;
  candidate_birth_date?: string | null;
  cpf?: string | null;
  rg?: string | null;
  candidate_email?: string | null;
  candidate_phone?: string | null;
  celular?: string | null;
  address?: Address | null;
  guardians?: Guardian[] | null;
  sponsor?: string | null;
  has_demolay_relative?: boolean;
  demolay_relative_name?: string | null;
  demolay_relative_chapter?: string | null;
  has_mason_relative?: boolean;
  mason_relative_name?: string | null;
  mason_relative_lodge?: string | null;
  notes?: string | null;
  opinion?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const MARGIN = 16;

function fileSafe(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function line(doc: jsPDF, label: string, value: string | null | undefined, y: number, pageW: number) {
  const contentW = pageW - MARGIN * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label, MARGIN, y);
  doc.setFont("helvetica", "normal");
  const text = value?.trim() || "—";
  const lines = doc.splitTextToSize(text, contentW - 45) as string[];
  doc.text(lines, MARGIN + 42, y);
  return y + Math.max(6, lines.length * 4.5);
}

/** PDF da ficha de sindicância com logo e identificação do capítulo. */
export async function exportInvestigationFilePdf(input: InvestigationPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const logo = await loadLogoDataUrl(input.logoPath);
  let y = MARGIN;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      const logoH = 18;
      const logoW = logoH * ratio;
      doc.addImage(logo, (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 6;
    } catch {
      /* ignore */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Ficha de Sindicância", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${input.chapterName}${input.chapterCity ? ` — ${input.chapterCity}` : ""}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 10;
  doc.setTextColor(26);

  const addr = input.address;
  const addressLine = addr
    ? [
        [addr.street, addr.number].filter(Boolean).join(", "),
        addr.complement,
        addr.neighborhood,
        [addr.city, addr.state].filter(Boolean).join("/"),
        addr.zip,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  y = line(doc, "Candidato", input.candidate_name, y, pageW);
  y = line(
    doc,
    "Nascimento",
    input.candidate_birth_date ? formatDateBR(input.candidate_birth_date) : null,
    y,
    pageW,
  );
  y = line(doc, "CPF", input.cpf, y, pageW);
  y = line(doc, "RG", input.rg, y, pageW);
  y = line(doc, "E-mail", input.candidate_email, y, pageW);
  y = line(doc, "Telefone", input.candidate_phone, y, pageW);
  y = line(doc, "Celular", input.celular, y, pageW);
  y = line(doc, "Endereço", addressLine, y, pageW);
  y = line(doc, "Padrinho", input.sponsor, y, pageW);

  const guardians = (input.guardians ?? []).filter((g) => g.full_name?.trim());
  guardians.forEach((g, i) => {
    y = line(
      doc,
      `Responsável ${i + 1}`,
      [g.full_name, g.relationship, g.phone, g.email].filter(Boolean).join(" · "),
      y,
      pageW,
    );
  });

  if (input.has_demolay_relative) {
    y = line(
      doc,
      "Parente DeMolay",
      [input.demolay_relative_name, input.demolay_relative_chapter]
        .filter(Boolean)
        .join(" — "),
      y,
      pageW,
    );
  }
  if (input.has_mason_relative) {
    y = line(
      doc,
      "Parente Maçom",
      [input.mason_relative_name, input.mason_relative_lodge]
        .filter(Boolean)
        .join(" — "),
      y,
      pageW,
    );
  }

  if (input.notes) {
    y += 2;
    y = line(doc, "Obs.", input.notes, y, pageW);
  }
  if (input.opinion) {
    y += 4;
    if (y > pageH - 40) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Parecer da Sindicância", MARGIN, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(input.opinion, pageW - MARGIN * 2) as string[];
    for (const l of lines) {
      if (y > pageH - 20) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(l, MARGIN, y);
      y += 5;
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${input.chapterName}${input.chapterCity ? ` — ${input.chapterCity}` : ""}`,
    pageW / 2,
    pageH - 10,
    { align: "center" },
  );

  doc.save(`ficha-${fileSafe(input.candidate_name)}.pdf`);
}
