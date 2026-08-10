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

export type CalendarTypeLabels = Partial<Record<CalendarType, string>>;

/** Lê overrides de rótulo em chapters.settings.calendar_type_labels. */
export function parseCalendarTypeLabels(
  settings: Record<string, unknown> | null | undefined,
): CalendarTypeLabels {
  const raw = settings?.calendar_type_labels;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CalendarTypeLabels = {};
  for (const t of CALENDAR_TYPES) {
    const v = (raw as Record<string, unknown>)[t];
    if (typeof v === "string") {
      const name = v.trim();
      if (name) out[t] = name;
    }
  }
  return out;
}

export function resolveTypeMeta(
  t: CalendarType | string,
  labels?: CalendarTypeLabels | null,
): { label: string; color: string; bg: string } {
  const base = TYPE_META[t as CalendarType];
  if (!base) return { label: String(t), color: "#6B7280", bg: "#F3F4F6" };
  const override = labels?.[t as CalendarType]?.trim();
  return override ? { ...base, label: override } : base;
}

export function typeLabel(
  t: string,
  labels?: CalendarTypeLabels | null,
): string {
  return resolveTypeMeta(t, labels).label;
}
