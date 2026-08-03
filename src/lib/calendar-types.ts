export type CalendarType =
  | "sessao_ritualistica"
  | "sessao_administrativa"
  | "evento"
  | "filantropia"
  | "entretenimento"
  | "sindicancia";

export const TYPE_META: Record<
  CalendarType,
  { label: string; color: string; bg: string }
> = {
  sessao_ritualistica: {
    label: "Sessão Ritualística",
    color: "#1D4ED8",
    bg: "#DBEAFE",
  },
  sessao_administrativa: {
    label: "Sessão Administrativa",
    color: "#0E7490",
    bg: "#CFFAFE",
  },
  evento: { label: "Evento", color: "#9E1B32", bg: "#FCE7EC" },
  filantropia: { label: "Filantropia", color: "#047857", bg: "#D1FAE5" },
  entretenimento: { label: "Entretenimento", color: "#B45309", bg: "#FEF3C7" },
  sindicancia: { label: "Sindicância", color: "#6D28D9", bg: "#EDE9FE" },
};

export const CALENDAR_TYPES = Object.keys(TYPE_META) as CalendarType[];

/** Tipos que representam sessões do capítulo. */
export const SESSION_TYPES: CalendarType[] = [
  "sessao_ritualistica",
  "sessao_administrativa",
];

/** Tipos sem registro de ata de sessão. */
export const NO_MINUTES_TYPES: CalendarType[] = [
  "filantropia",
  "entretenimento",
  "sindicancia",
];

/** Tipos sem chamada de presença (não são reuniões). */
export const NO_ATTENDANCE_TYPES: CalendarType[] = ["sindicancia"];

export function isSessionType(t: string): boolean {
  return SESSION_TYPES.includes(t as CalendarType);
}

/** Filantropia, entretenimento e sindicância não têm ata de sessão. */
export function supportsMinutes(t: string): boolean {
  return !NO_MINUTES_TYPES.includes(t as CalendarType);
}

export function supportsAttendance(t: string): boolean {
  return !NO_ATTENDANCE_TYPES.includes(t as CalendarType);
}

export function typeLabel(t: string): string {
  return TYPE_META[t as CalendarType]?.label ?? t;
}
