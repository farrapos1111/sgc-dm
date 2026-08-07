import { matchesLooseSearch } from "@/lib/utils";
import {
  formatPrazoLabel,
  mandatoryDateAppliesToMonth,
  type OrgMandatoryDate,
  type PrazoKind,
} from "@/lib/org-mandatory-dates.functions";

export type MandatoryMentionOption = {
  id: string;
  title: string;
  prazo_label: string;
};

export type MandatoryMentionMatch = {
  /** Índice de `@data_obrigatoria` no texto. */
  startIndex: number;
  query: string;
};

const TRIGGER = "@data_obrigatoria";
/** Token persistido: @data_obrigatoria[id|título] */
const TOKEN_RE = /@data_obrigatoria\[([^\]]*)\]/gi;

/** Remove menções de data obrigatória (não entram na chave do dia). */
export function stripMandatoryDateMentions(text: string): string {
  return text
    .replace(TOKEN_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function formatMandatoryMentionToken(opt: MandatoryMentionOption): string {
  const safeTitle = opt.title.replace(/[\[\]]/g, "").trim();
  return `@data_obrigatoria[${opt.id}|${safeTitle}]`;
}

/** Detecta `@data_obrigatoria` + query opcional imediatamente antes do cursor. */
export function detectMandatoryMention(
  textBeforeCursor: string,
): MandatoryMentionMatch | null {
  const lower = textBeforeCursor.toLowerCase();
  const idx = lower.lastIndexOf(TRIGGER);
  if (idx < 0) return null;

  if (idx > 0) {
    const prev = textBeforeCursor[idx - 1]!;
    if (!/[\s\n([{«"'“]/u.test(prev)) return null;
  }

  const after = textBeforeCursor.slice(idx + TRIGGER.length);
  if (after.includes("\n")) return null;
  // Token já completo `[...]`
  if (/^\[[^\]]*\]/.test(after)) return null;
  if (after.includes("[")) return null;

  const query = after.replace(/^\s*/, "");
  return { startIndex: idx, query };
}

export function filterMandatoryMentions(
  options: MandatoryMentionOption[],
  query: string,
  limit = 8,
): MandatoryMentionOption[] {
  const q = query.trim();
  const rows = q
    ? options.filter(
        (o) =>
          matchesLooseSearch(o.title, q) ||
          matchesLooseSearch(o.prazo_label, q),
      )
    : options;
  return [...rows]
    .sort((a, b) =>
      a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
    )
    .slice(0, limit);
}

export function applyMandatoryMention(
  fullText: string,
  caret: number,
  match: MandatoryMentionMatch,
  opt: MandatoryMentionOption,
): { text: string; caret: number } {
  const token = formatMandatoryMentionToken(opt);
  const before = fullText.slice(0, match.startIndex);
  const after = fullText.slice(caret);
  const text = `${before}${token} ${after}`;
  const nextCaret = before.length + token.length + 1;
  return { text, caret: nextCaret };
}

export function mandatoryOptionsForMonth(
  rows: Array<
    OrgMandatoryDate & { prazo_label?: string } | {
      id: string;
      title: string;
      prazo_kind: PrazoKind;
      due_date?: string | null;
      due_year?: number | null;
      due_month?: number | null;
      due_day?: number | null;
      start_month?: number | null;
      start_day?: number | null;
      prazo_label?: string;
    }
  >,
  year: number,
  month: number,
): MandatoryMentionOption[] {
  return rows
    .filter((r) => mandatoryDateAppliesToMonth(r, year, month))
    .map((r) => ({
      id: r.id,
      title: r.title,
      prazo_label: r.prazo_label ?? formatPrazoLabel(r),
    }));
}
