/** Mensagens de cobrança de mensalidade (Atrasados / WhatsApp). */

import { formatBRL } from "@/lib/format";
import {
  isDueOverdue,
  isFutureMonth,
  MONTH_LONG,
} from "@/lib/dues-rules";

export type ReminderMonthKind = "atrasado" | "vencimento_hoje";

export type ReminderMonthLine = {
  year: number;
  month: number;
  label: string;
  amount: number;
  kind: ReminderMonthKind;
};

export type ReminderMemberSummary = {
  months: ReminderMonthLine[];
  overdueCount: number;
  currentCount: number;
  total: number;
};

type DueLike = {
  member_id: string;
  competence_year: number;
  competence_month: number;
  status: string;
};

/** Classifica meses em aberto (não futuros) de um membro no ano. */
export function classifyOpenMonthsForMember(
  memberId: string,
  year: number,
  dues: DueLike[],
  defaultAmount: number,
  today: Date = new Date(),
): ReminderMemberSummary {
  const months: ReminderMonthLine[] = [];
  for (let month = 1; month <= 12; month++) {
    if (isFutureMonth(year, month, today)) continue;
    const due = dues.find(
      (d) =>
        d.member_id === memberId &&
        d.competence_year === year &&
        d.competence_month === month,
    );
    const status = due?.status ?? "em_aberto";
    if (status !== "em_aberto") continue;

    const amount = defaultAmount;
    const overdue = isDueOverdue(year, month, status, today);
    months.push({
      year,
      month,
      label: MONTH_LONG[month - 1] ?? String(month),
      amount,
      kind: overdue ? "atrasado" : "vencimento_hoje",
    });
  }

  const overdueCount = months.filter((m) => m.kind === "atrasado").length;
  const currentCount = months.filter((m) => m.kind === "vencimento_hoje").length;
  const total = months.reduce((s, m) => s + m.amount, 0);
  return { months, overdueCount, currentCount, total };
}

export function firstNameFromFullName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName.trim() || "irmão";
}

/** Digits for wa.me; BR 10/11 → prefix 55. */
export function normalizeWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (digits.length < 12) return null;
  return digits;
}

export function buildReminderMessage(opts: {
  fullName: string;
  months: ReminderMonthLine[];
  total: number;
  pixKey?: string | null;
  treasurerName?: string | null;
}): string {
  const first = firstNameFromFullName(opts.fullName);
  const lines = opts.months.map((m) => {
    const emoji = m.kind === "atrasado" ? "🔴" : "🟡";
    const tag = m.kind === "atrasado" ? "atrasado" : "vencimento hoje";
    return `${emoji} ${m.label} — ${formatBRL(m.amount)} (${tag})`;
  });

  const parts: string[] = [
    `Ola, ${first}! 👋😊`,
    "",
    "Tudo bem por aí? Passando rapidinho para te lembrar que hoje vence a sua mensalidade do capitulo. 📋",
    "",
    "Confira o resumo:",
    "",
    ...lines,
    "",
    `💲Total= ${formatBRL(opts.total)}`,
  ];

  const pix = opts.pixKey?.trim();
  if (pix) {
    parts.push(
      "",
      "Para facilitar sua vida, você pode pagar no pix:",
      "",
      pix,
    );
  }

  parts.push("", "Estou à disposição para qualquer dúvida. Um abraço!");
  const treasurer = opts.treasurerName?.trim();
  if (treasurer) {
    parts.push(treasurer);
  }

  return parts.join("\n");
}

/** URL do WhatsApp Web/App com mensagem pronta. */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string {
  const digits = normalizeWhatsAppDigits(phone);
  const text = encodeURIComponent(message);
  if (digits) return `https://wa.me/${digits}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}
