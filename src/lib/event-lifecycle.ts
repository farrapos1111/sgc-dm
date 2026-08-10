import { datePartsInAppTz, todayYmd } from "@/lib/timezone";

/** Dias após a data do evento em que o fluxo de caixa ainda aceita lançamentos. */
export const EVENT_FINANCE_GRACE_DAYS = 30;

export type EventDbStatus = "rascunho" | "publicado" | "encerrado";

/** Status exibido na UI (fechado = encerrado no DB ou prazo de caixa expirado). */
export type EventDisplayStatus = "rascunho" | "publicado" | "fechado";

export const EVENT_DISPLAY_STATUS_LABELS: Record<EventDisplayStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  fechado: "Fechado",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data civil (YYYY-MM-DD) do início do evento no fuso do app. */
export function eventStartYmd(startsAt: string): string {
  const { year, month, day } = datePartsInAppTz(startsAt);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Soma dias a uma data civil YYYY-MM-DD (calendário local). */
export function addDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Último dia inclusive em que o caixa do evento ainda aceita lançamentos. */
export function eventFinanceCloseYmd(startsAt: string): string {
  return addDaysYmd(eventStartYmd(startsAt), EVENT_FINANCE_GRACE_DAYS);
}

/**
 * Evento aceita lançamentos de caixa enquanto:
 * - status ≠ encerrado
 * - hoje (fuso app) ≤ data do evento + 30 dias
 */
export function isEventFinanceOpen(
  startsAt: string,
  status?: string | null,
  now: Date = new Date(),
): boolean {
  if (status === "encerrado") return false;
  const today = todayYmd(now);
  return today <= eventFinanceCloseYmd(startsAt);
}

export function eventDisplayStatus(
  startsAt: string,
  status: string,
  now: Date = new Date(),
): EventDisplayStatus {
  if (status === "rascunho") return "rascunho";
  if (status === "encerrado") return "fechado";
  if (!isEventFinanceOpen(startsAt, status, now)) return "fechado";
  return "publicado";
}

export function eventDisplayStatusLabel(
  startsAt: string,
  status: string,
  now?: Date,
): string {
  return EVENT_DISPLAY_STATUS_LABELS[eventDisplayStatus(startsAt, status, now)];
}

export function assertEventFinanceOpen(
  startsAt: string,
  status?: string | null,
): void {
  if (isEventFinanceOpen(startsAt, status)) return;
  throw new Error(
    "Este evento está fechado para lançamentos no fluxo de caixa (prazo de 30 dias após a data do evento).",
  );
}
