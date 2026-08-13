import { jsPDF } from "jspdf";
import { loadLogoDataUrl } from "@/lib/chapter-logo";
import { formatBRL, formatDateTimeBR } from "@/lib/format";

export type AuditArea = "tesouraria" | "secretaria" | "eventos" | "outros";
export type AuditSeverity = "leve" | "moderada" | "grave";

export type AuditPdfLine = {
  createdAt: string;
  userName: string;
  title: string;
  detail?: string | null;
};

const TESOURARIA_ACTIONS = new Set([
  "cash_entry_insert",
  "cash_entry_update",
  "cash_entry_delete",
  "charge_insert",
  "charge_update",
  "charge_delete",
  "comanda_item_pay",
]);

const TESOURARIA_TABLES = new Set([
  "cash_entries",
  "cash_categories",
  "cash_subcategories",
  "member_charges",
  "member_charge_payments",
  "member_dues",
  "member_dues_manual_inclusions",
]);

const SECRETARIA_ACTIONS = new Set([
  "member_update",
  "member_cadastro_self_update",
  "pii_reveal",
  "document_view",
  "docs_migrate",
]);

const EVENTOS_ACTIONS = new Set([
  "comanda_item_add",
  "comanda_item_update",
  "comanda_item_delete",
  "comanda_item_pay",
]);

const TESOURARIA_SETTINGS = new Set([
  "pix_key",
  "pix_qr_path",
  "dues_enabled",
  "default_dues_amount",
  "dues_share_token",
  "cash_share_token",
]);
const SECRETARIA_SETTINGS = new Set([
  "minute_passwords",
  "chave_template",
]);

const MARGIN = 15;
const LOGO_MAX = 24;
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

function fitText(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 4 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

const GRAVE_ACTIONS = new Set([
  "cash_entry_delete",
  "charge_delete",
  "comanda_item_delete",
  "pii_reveal",
]);

const LEVE_ACTIONS = new Set([
  "document_view",
  "comanda_item_add",
  "cash_entry_insert",
  "charge_insert",
  "member_cadastro_self_update",
]);

const GRAVE_SETTINGS = new Set([
  "minute_passwords",
  "pix_key",
  "pix_qr_path",
]);

export function auditSeverityLabel(severity: AuditSeverity): string {
  switch (severity) {
    case "leve":
      return "Leve";
    case "moderada":
      return "Moderada";
    case "grave":
      return "Grave";
  }
}

export function classifyAuditSeverity(
  action: string,
  newValue?: unknown,
): AuditSeverity {
  if (GRAVE_ACTIONS.has(action) || action.endsWith("_delete")) return "grave";
  if (action === "settings_patch") {
    const key =
      newValue && typeof newValue === "object" && !Array.isArray(newValue)
        ? String((newValue as { key?: unknown }).key ?? "")
        : "";
    if (GRAVE_SETTINGS.has(key)) return "grave";
    if (key === "dues_enabled" || key === "default_dues_amount") {
      return "moderada";
    }
    return "leve";
  }
  if (LEVE_ACTIONS.has(action) || action.endsWith("_insert")) return "leve";
  return "moderada";
}

export function auditAreaLabel(area: AuditArea): string {
  switch (area) {
    case "tesouraria":
      return "Tesouraria";
    case "secretaria":
      return "Secretaria";
    case "eventos":
      return "Eventos";
    default:
      return "Outros";
  }
}

export function auditActionLabel(action: string): string {
  switch (action) {
    case "comanda_item_add":
      return "Item adicionado na comanda";
    case "comanda_item_update":
      return "Item alterado na comanda";
    case "comanda_item_delete":
      return "Item removido da comanda";
    case "comanda_item_pay":
      return "Item baixado na comanda";
    case "cash_entry_insert":
      return "Lançamento no caixa";
    case "cash_entry_update":
      return "Lançamento alterado";
    case "cash_entry_delete":
      return "Lançamento excluído";
    case "charge_insert":
      return "Cobrança criada";
    case "charge_update":
      return "Cobrança alterada";
    case "charge_delete":
      return "Cobrança excluída";
    case "pii_reveal":
      return "Revelação de PII";
    case "member_update":
      return "Atualização cadastral (secretaria)";
    case "member_cadastro_self_update":
      return "Atualização cadastral (pelo membro)";
    case "settings_patch":
      return "Configuração alterada";
    case "document_view":
      return "Documento visualizado";
    case "docs_migrate":
      return "Migração de documentos";
    case "member_charge_payments_insert":
      return "Pagamento de cobrança";
    case "member_charge_payments_update":
      return "Pagamento de cobrança alterado";
    case "member_charge_payments_delete":
      return "Pagamento de cobrança removido";
    case "cash_categories_insert":
      return "Categoria de caixa criada";
    case "cash_categories_update":
      return "Categoria de caixa alterada";
    case "cash_categories_delete":
      return "Categoria de caixa excluída";
    case "cash_subcategories_insert":
      return "Subcategoria de caixa criada";
    case "cash_subcategories_update":
      return "Subcategoria de caixa alterada";
    case "cash_subcategories_delete":
      return "Subcategoria de caixa excluída";
    case "member_dues_insert":
      return "Mensalidade lançada";
    case "member_dues_update":
      return "Mensalidade alterada";
    case "member_dues_delete":
      return "Mensalidade excluída";
    case "member_dues_manual_inclusions_insert":
      return "Inclusão manual de mensalidade";
    case "member_dues_manual_inclusions_update":
      return "Inclusão manual de mensalidade alterada";
    case "member_dues_manual_inclusions_delete":
      return "Inclusão manual de mensalidade removida";
    default:
      if (action.endsWith("_insert")) return "Registro criado";
      if (action.endsWith("_update")) return "Registro alterado";
      if (action.endsWith("_delete")) return "Registro excluído";
      return action;
  }
}

export function classifyAuditArea(
  action: string,
  newValue?: unknown,
  tableName?: string | null,
): AuditArea {
  if (tableName && TESOURARIA_TABLES.has(tableName)) return "tesouraria";
  for (const table of TESOURARIA_TABLES) {
    if (action.startsWith(`${table}_`)) return "tesouraria";
  }
  if (action === "settings_patch") {
    const key =
      newValue && typeof newValue === "object" && !Array.isArray(newValue)
        ? String((newValue as { key?: unknown }).key ?? "")
        : "";
    if (TESOURARIA_SETTINGS.has(key)) return "tesouraria";
    if (SECRETARIA_SETTINGS.has(key)) return "secretaria";
    return "outros";
  }
  if (TESOURARIA_ACTIONS.has(action) && !EVENTOS_ACTIONS.has(action)) {
    return "tesouraria";
  }
  if (action === "comanda_item_pay") return "tesouraria";
  if (EVENTOS_ACTIONS.has(action)) return "eventos";
  if (SECRETARIA_ACTIONS.has(action)) return "secretaria";
  return "outros";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tenderLabel(tender: string | null): string | null {
  if (!tender) return null;
  const t = tender.toLowerCase();
  if (t === "pix") return "Pix";
  if (t === "dinheiro" || t === "especie") return "Dinheiro";
  return tender;
}

export function formatComandaAuditTitle(row: {
  action: string;
  itemName?: string | null;
  buyerName?: string | null;
}): string {
  const name = [row.itemName, row.buyerName].filter(Boolean).join(" · ");
  return name
    ? `${auditActionLabel(row.action)} · ${name}`
    : auditActionLabel(row.action);
}

export function formatComandaAuditDetail(row: {
  action: string;
  qty?: number | null;
  amount?: number | null;
  tender?: string | null;
  remaining?: number | null;
  oldQty?: number | null;
  oldAmount?: number | null;
  newQty?: number | null;
  newAmount?: number | null;
}): string | null {
  const parts: string[] = [];
  if (row.action === "comanda_item_update") {
    if (row.oldQty != null || row.newQty != null) {
      parts.push(`Qtd ${row.oldQty ?? "—"} → ${row.newQty ?? "—"}`);
    }
    if (row.oldAmount != null || row.newAmount != null) {
      parts.push(`${formatBRL(row.oldAmount)} → ${formatBRL(row.newAmount)}`);
    }
    return parts.length ? parts.join(" · ") : null;
  }
  if (row.qty != null) parts.push(`${row.qty} un.`);
  if (row.amount != null) parts.push(formatBRL(row.amount));
  const tender = tenderLabel(row.tender ?? null);
  if (tender) parts.push(tender);
  if (row.remaining != null && row.remaining > 0.001) {
    parts.push(`saldo ${formatBRL(row.remaining)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function formatChapterAuditDetail(
  action: string,
  newValue: unknown,
  oldValue?: unknown,
): string | null {
  const nv = asRecord(newValue);
  const ov = asRecord(oldValue);
  if (!nv && !ov) return null;

  if (action.startsWith("comanda_item_")) {
    return formatComandaAuditDetail({
      action,
      qty: asNumber(nv?.qty),
      amount: asNumber(nv?.amount),
      tender: asString(nv?.tender),
      remaining: asNumber(nv?.remaining),
      oldQty: asNumber(asRecord(nv?.old)?.qty),
      oldAmount: asNumber(asRecord(nv?.old)?.amount),
      newQty: asNumber(asRecord(nv?.new)?.qty),
      newAmount: asNumber(asRecord(nv?.new)?.amount),
    });
  }

  if (action.startsWith("cash_entry_")) {
    const src = nv ?? ov;
    const parts: string[] = [];
    const kind = asString(src?.kind);
    if (kind === "entrada") parts.push("Entrada");
    else if (kind === "saida") parts.push("Saída");
    const cat = [asString(src?.category), asString(src?.subcategory)]
      .filter(Boolean)
      .join(" · ");
    if (cat) parts.push(cat);
    const desc = asString(src?.description);
    if (desc) parts.push(desc);
    const amount = asNumber(src?.amount);
    if (amount != null) parts.push(formatBRL(amount));
    return parts.length ? parts.join(" · ") : null;
  }

  if (action.startsWith("charge_")) {
    const src = nv ?? ov;
    const parts: string[] = [];
    const desc = asString(src?.description);
    if (desc) parts.push(desc);
    const status = asString(src?.status);
    if (status) parts.push(status.replaceAll("_", " "));
    const amount = asNumber(src?.amount);
    if (amount != null) parts.push(formatBRL(amount));
    if (action === "charge_update" && ov) {
      const oldStatus = asString(ov.status);
      const newStatus = asString(nv?.status);
      if (oldStatus && newStatus && oldStatus !== newStatus) {
        parts.push(`${oldStatus} → ${newStatus}`);
      }
    }
    return parts.length ? parts.join(" · ") : null;
  }

  if (action === "pii_reveal") {
    const field = asString(nv?.field);
    return field ? `Campo: ${field.toUpperCase()}` : null;
  }

  if (action === "settings_patch") {
    const key = asString(nv?.key);
    return key ? `Chave: ${key}` : null;
  }

  if (action === "member_update" || action === "member_cadastro_self_update") {
    const keys = Object.keys(nv ?? {}).filter(
      (k) => !["demolay_id", "full_name", "source"].includes(k),
    );
    if (asString(nv?.full_name)) return asString(nv?.full_name);
    if (keys.length) return `Campos: ${keys.join(", ")}`;
    return null;
  }

  const src = nv ?? ov;
  if (!src) return null;
  const parts: string[] = [];
  const name = asString(src.name) ?? asString(src.description) ?? asString(src.notes);
  if (name) parts.push(name);
  const amount = asNumber(src.amount);
  if (amount != null) parts.push(formatBRL(amount));
  const status = asString(src.status);
  if (status) parts.push(status.replaceAll("_", " "));
  const year = asNumber(src.year) ?? asNumber(src.competence_year);
  const month = asNumber(src.competence_month);
  if (year != null && month != null) {
    parts.push(`${String(month).padStart(2, "0")}/${year}`);
  } else if (year != null) {
    parts.push(String(year));
  }
  return parts.length ? parts.join(" · ") : null;
}

export function formatChapterAuditTitle(
  action: string,
  newValue: unknown,
  subjectName?: string | null,
): string {
  const nv = asRecord(newValue);
  const item = asString(nv?.item_name);
  const buyer = asString(nv?.buyer_name);
  const extra = [item, buyer, subjectName].filter(Boolean).join(" · ");
  const label = auditActionLabel(action);
  return extra ? `${label} · ${extra}` : label;
}

/** Relatório PDF genérico de audit log. */
export async function exportAuditLogPdf(input: {
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  title: string;
  subtitle?: string | null;
  lines: AuditPdfLine[];
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const rightX = pageW - MARGIN;

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
  doc.text(input.title, pageW / 2, y, { align: "center" });
  y += 5;
  if (input.subtitle) {
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text(input.subtitle, pageW / 2, y, { align: "center" });
    y += 5;
  }
  y += 3;
  setRgb(doc, COLOR_BLACK);

  if (input.lines.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setRgb(doc, COLOR_GRAY);
    doc.text("Nenhum registro encontrado.", MARGIN, y);
  } else {
    for (const line of input.lines) {
      const dateLabel = formatDateTimeBR(line.createdAt);
      const userLabel = line.userName || "Usuário";
      const meta = `${dateLabel} · ${userLabel}`;
      const titleLines = doc.splitTextToSize(line.title, contentW);
      const detailLines = line.detail
        ? doc.splitTextToSize(line.detail, contentW)
        : [];
      const blockH =
        titleLines.length * 4.2 +
        4 +
        detailLines.length * 3.8 +
        4;

      if (y + blockH > pageH - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setRgb(doc, COLOR_BLACK);
      let ty = y;
      for (const t of titleLines) {
        doc.text(fitText(doc, t, contentW), MARGIN, ty);
        ty += 4.2;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setRgb(doc, COLOR_GRAY);
      doc.text(fitText(doc, meta, contentW), MARGIN, ty);
      ty += 4;
      if (detailLines.length) {
        doc.setFontSize(8);
        for (const d of detailLines) {
          doc.text(fitText(doc, d, contentW), MARGIN, ty);
          ty += 3.8;
        }
      }
      y = ty + 3;
      doc.setDrawColor(230, 230, 226);
      doc.line(MARGIN, y - 1.5, rightX, y - 1.5);
    }
  }

  const slug = fileSafe(input.title) || "audit-log";
  doc.save(`${slug}.pdf`);
}
