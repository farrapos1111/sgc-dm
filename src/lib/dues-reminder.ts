/** Mensagens de cobrança de mensalidade (Atrasados / WhatsApp). */

import { formatBRL, formatDateBR } from "@/lib/format";
import {
  autoDueStatus,
  isDueOverdue,
  isFutureMonth,
  MONTH_LONG,
  type DueMemberAutoInput,
} from "@/lib/dues-rules";

export type ReminderMonthKind = "atrasado" | "vencimento_hoje";

export type ReminderMonthLine = {
  year: number;
  month: number;
  label: string;
  amount: number;
  kind: ReminderMonthKind;
};

export type ReminderChargeKind = "atrasado" | "em_aberto";

export type ReminderChargeLine = {
  id: string;
  description: string;
  /** Valor ainda em aberto (amount − pagos). */
  amount: number;
  dueDate: string;
  kind: ReminderChargeKind;
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
  amount?: number | string | null;
};

type ChargeLike = {
  id: string;
  member_id: string;
  description: string;
  amount: number | string;
  amount_paid?: number | string;
  status: string;
  due_date: string;
};

/** Compara só a data civil (sem horário), como na tela de Cobranças. */
export function isChargePastDue(
  dueDate: string,
  today: Date = new Date(),
): boolean {
  const y = Number(String(dueDate).slice(0, 4));
  const m = Number(String(dueDate).slice(5, 7));
  const d = Number(String(dueDate).slice(8, 10));
  if (!y || !m || !d) return false;
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const due = new Date(y, m - 1, d);
  return todayStart > due;
}

/** Cobranças avulsas em aberto (com saldo), com kind atrasado/em_aberto. */
export function classifyOpenChargesByMember(
  charges: ChargeLike[],
  today: Date = new Date(),
): Map<string, ReminderChargeLine[]> {
  const byMember = new Map<string, ReminderChargeLine[]>();
  for (const c of charges) {
    if (c.status === "isento" || c.status === "pago") continue;
    const amount = Number(c.amount) || 0;
    const paid = Number(c.amount_paid) || 0;
    const remaining = Math.max(0, amount - paid);
    if (remaining <= 0) continue;
    if (c.status !== "em_aberto") continue;
    const overdue = isChargePastDue(c.due_date, today);
    const line: ReminderChargeLine = {
      id: c.id,
      description: (c.description || "Cobrança").trim() || "Cobrança",
      amount: remaining,
      dueDate: String(c.due_date).slice(0, 10),
      kind: overdue ? "atrasado" : "em_aberto",
    };
    const list = byMember.get(c.member_id) ?? [];
    list.push(line);
    byMember.set(c.member_id, list);
  }
  for (const list of byMember.values()) {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "atrasado" ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }
  return byMember;
}

/** Cobranças avulsas atrasadas (com saldo) agrupadas por membro. */
export function classifyOverdueChargesByMember(
  charges: ChargeLike[],
  today: Date = new Date(),
): Map<string, ReminderChargeLine[]> {
  const all = classifyOpenChargesByMember(charges, today);
  const byMember = new Map<string, ReminderChargeLine[]>();
  for (const [memberId, list] of all) {
    const overdue = list.filter((c) => c.kind === "atrasado");
    if (overdue.length) byMember.set(memberId, overdue);
  }
  return byMember;
}

/** Classifica meses em aberto (não futuros) de um membro no ano. */
export function classifyOpenMonthsForMember(
  memberId: string,
  year: number,
  dues: DueLike[],
  defaultAmount: number,
  today: Date = new Date(),
  member?: DueMemberAutoInput | null,
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
    // Sem competência no banco = não cobra (não inventar mensalidade).
    if (!due) continue;
    if (due.status !== "em_aberto") continue;
    // Senior / iniciação / janeiro etc.: não cobrar mesmo se a linha estiver desatualizada.
    if (member && autoDueStatus(member, year, month) !== "em_aberto") {
      continue;
    }

    const amount = Number(due.amount) || defaultAmount;
    const overdue = isDueOverdue(year, month, due.status, today);
    months.push({
      year,
      month,
      label: MONTH_LONG[month - 1] ?? String(month),
      amount,
      kind: overdue ? "atrasado" : "vencimento_hoje",
    });
  }

  const overdueCount = months.filter((m) => m.kind === "atrasado").length;
  const currentCount = months.filter(
    (m) => m.kind === "vencimento_hoje",
  ).length;
  const total = months.reduce((s, m) => s + m.amount, 0);
  return { months, overdueCount, currentCount, total };
}

export function firstNameFromFullName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName.trim() || "irmão";
}

/** Digits for wa.me; BR 10/11 → prefix 55. */
export function normalizeWhatsAppDigits(
  phone: string | null | undefined,
): string | null {
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
  charges?: ReminderChargeLine[];
  chargesTotal?: number;
  pixKey?: string | null;
  treasurerName?: string | null;
}): string {
  const first = firstNameFromFullName(opts.fullName);
  // Sem emoji: WhatsApp/clipboard em alguns ambientes corrompe (aparece como �).
  const monthLines = opts.months.map((m) => {
    const tag = m.kind === "atrasado" ? "atrasado" : "vencimento hoje";
    return `- ${m.label} - ${formatBRL(m.amount)} (${tag})`;
  });

  const chargeLines = (opts.charges ?? []).map((c) => {
    const tag = c.kind === "atrasado" ? "atrasado" : "em aberto";
    return `- ${c.description} - ${formatBRL(c.amount)} (${tag}, venc. ${formatDateBR(c.dueDate)})`;
  });

  const grandTotal =
    opts.total +
    (opts.chargesTotal ??
      (opts.charges ?? []).reduce((s, c) => s + c.amount, 0));

  const parts: string[] = [
    `Ola, ${first}!`,
    "",
    "Tudo bem por aí? Passando rapidinho para te lembrar dos valores em aberto com o capítulo.",
    "",
    "Confira o resumo:",
    "",
  ];

  if (monthLines.length) {
    parts.push(...monthLines, "");
  }
  if (chargeLines.length) {
    if (monthLines.length) parts.push("Cobranças:", "");
    parts.push(...chargeLines, "");
  }

  parts.push(`Total = ${formatBRL(grandTotal)}`);

  const pix = opts.pixKey?.trim();
  if (pix) {
    parts.push("", "Para facilitar sua vida, você pode pagar no pix:", "", pix);
  }

  parts.push("", "Estou à disposição para qualquer dúvida. Um abraço!");
  const treasurer = opts.treasurerName?.trim();
  if (treasurer) {
    parts.push(treasurer);
  }

  return parts.join("\n");
}

export type OverdueReportMember = {
  fullName: string;
  months: ReminderMonthLine[];
  charges: ReminderChargeLine[];
  monthsTotal: number;
  chargesTotal: number;
  grandTotal: number;
  /** Texto livre da linha Observação. */
  observation?: string | null;
};

/** Relatório consolidado: todos os membros com pendências + Observação por membro. */
export function buildOverdueReportMessage(opts: {
  chapterName?: string | null;
  year: number;
  members: OverdueReportMember[];
  generatedAt?: Date;
}): string {
  const withDebt = opts.members.filter(
    (m) => m.grandTotal > 0 || m.months.length > 0 || m.charges.length > 0,
  );
  const when = opts.generatedAt ?? new Date();
  const dateLabel = formatDateBR(
    `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`,
  );
  const chapter = opts.chapterName?.trim();
  const parts: string[] = [
    `Relatório de valores em aberto${chapter ? ` - ${chapter}` : ""}`,
    `Ano ${opts.year} - gerado em ${dateLabel}`,
    "",
  ];

  if (withDebt.length === 0) {
    parts.push("Nenhum membro com mensalidade ou cobrança em aberto.");
    return parts.join("\n");
  }

  let grand = 0;
  for (const m of withDebt) {
    grand += m.grandTotal;
    parts.push("------------");
    parts.push(m.fullName.trim() || "Membro");
    parts.push("");

    if (m.months.length) {
      parts.push("Mensalidades:");
      for (const month of m.months) {
        const tag = month.kind === "atrasado" ? "atrasado" : "vencimento hoje";
        parts.push(`- ${month.label} - ${formatBRL(month.amount)} (${tag})`);
      }
      parts.push("");
    }

    const overdueCharges = m.charges.filter((c) => c.kind === "atrasado");
    const openCharges = m.charges.filter((c) => c.kind === "em_aberto");

    if (overdueCharges.length) {
      parts.push("Cobranças em atraso:");
      for (const c of overdueCharges) {
        parts.push(
          `- ${c.description} - ${formatBRL(c.amount)} (venc. ${formatDateBR(c.dueDate)})`,
        );
      }
      parts.push("");
    }

    if (openCharges.length) {
      parts.push("Cobranças em aberto:");
      for (const c of openCharges) {
        parts.push(
          `- ${c.description} - ${formatBRL(c.amount)} (venc. ${formatDateBR(c.dueDate)})`,
        );
      }
      parts.push("");
    }

    if (m.monthsTotal > 0 && m.chargesTotal > 0) {
      parts.push(`Mensalidades: ${formatBRL(m.monthsTotal)}`);
      parts.push(`Cobranças: ${formatBRL(m.chargesTotal)}`);
    }
    parts.push(`Total = ${formatBRL(m.grandTotal)}`);
    parts.push("");
    const obs = m.observation?.trim();
    parts.push(obs ? `Observação: ${obs}` : "Observação:");
    parts.push("");
  }

  parts.push("------------");
  parts.push(
    `Resumo: ${withDebt.length} membro${withDebt.length === 1 ? "" : "s"} - Total geral ${formatBRL(grand)}`,
  );

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
