export const MEMBER_DOCS_BUCKET = "member-documents";

export type IdDocKind = "rg_front" | "rg_back" | "cpf_front" | "cpf_back";

export const ID_DOC_LABELS: Record<IdDocKind, string> = {
  rg_front: "RG — Frente",
  rg_back: "RG — Verso",
  cpf_front: "CPF — Frente",
  cpf_back: "CPF — Verso",
};

export const ID_DOC_KINDS = Object.keys(ID_DOC_LABELS) as IdDocKind[];

export function docColumnForKind(kind: IdDocKind): string {
  switch (kind) {
    case "rg_front":
      return "doc_rg_front_path";
    case "rg_back":
      return "doc_rg_back_path";
    case "cpf_front":
      return "doc_cpf_front_path";
    case "cpf_back":
      return "doc_cpf_back_path";
  }
}

export function investigationDocPath(
  chapterId: string,
  fileOrTempId: string,
  kind: IdDocKind,
  ext: string,
): string {
  return `${chapterId}/investigation/${fileOrTempId}/${kind}.${ext}`;
}

export function memberDocPath(
  chapterId: string,
  memberId: string,
  kind: IdDocKind,
  ext: string,
): string {
  return `${chapterId}/members/${memberId}/${kind}.${ext}`;
}

export function sindicanciaSignaturePath(
  chapterId: string,
  eventId: string,
  role: string,
): string {
  return `${chapterId}/sindicancia/${eventId}/sig_${role}.png`;
}

export function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  return "jpg";
}

export const MAX_DOC_BYTES = 3 * 1024 * 1024;

export type AgeBand = "ate_14" | "15_17" | "18_mais";

export function ageBandFromBirthDate(
  birthDate: string | null | undefined,
  onDate: Date = new Date(),
): AgeBand {
  if (!birthDate) return "18_mais";
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(+birth)) return "18_mais";
  let age = onDate.getFullYear() - birth.getFullYear();
  const m = onDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < birth.getDate())) age -= 1;
  if (age <= 14) return "ate_14";
  if (age <= 17) return "15_17";
  return "18_mais";
}

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  ate_14: "12 a 14 anos",
  "15_17": "15 a 17 anos",
  "18_mais": "18 anos ou mais",
};

export type AtaBlockType =
  | "heading"
  | "text"
  | "yes_no"
  | "short_text"
  | "long_text";

export type AtaBlock = {
  id: string;
  type: AtaBlockType;
  label: string;
  required?: boolean;
  /** Exibe o bloco só quando a resposta de outro campo bate. */
  showWhen?: { id: string; equals: boolean | string };
};

export type AtaTemplate = { blocks: AtaBlock[] };

export type AtaTemplates = Record<AgeBand, AtaTemplate>;

export const EMPTY_ATA_TEMPLATES: AtaTemplates = {
  ate_14: { blocks: [] },
  "15_17": { blocks: [] },
  "18_mais": { blocks: [] },
};

export function isAtaQuestionBlock(block: AtaBlock): boolean {
  return (
    block.type === "yes_no" ||
    block.type === "short_text" ||
    block.type === "long_text"
  );
}

export function formatAtaAnswer(
  value: string | boolean | null | undefined,
): string {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  if (value == null) return "";
  return String(value).trim();
}

export type SindicanciaSignatureRole =
  | "senior"
  | "sindicante"
  | "escrivao"
  | "guardian1"
  | "guardian2"
  | "nominee";

export const SIGNATURE_ROLES: Array<{
  id: SindicanciaSignatureRole;
  label: string;
}> = [
  { id: "senior", label: "Tio / Senior" },
  { id: "sindicante", label: "Sindicante" },
  { id: "escrivao", label: "Escrivão de Parecer" },
  { id: "guardian1", label: "Responsável 1 do indicado" },
  { id: "guardian2", label: "Responsável 2 do indicado" },
  { id: "nominee", label: "Indicado" },
];
