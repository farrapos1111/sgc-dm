/** Fuso horário padrão do Rio Grande do Sul (mesmo de Brasília; sem horário de verão). */
export const APP_TIMEZONE = "America/Sao_Paulo";

type DateLike = Date | string | number;

function asDate(value: DateLike = new Date()): Date {
  const d = value instanceof Date ? value : new Date(value);
  return d;
}

/** Partes de calendário/hora no fuso do app. */
export function datePartsInAppTz(value: DateLike = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const d = asDate(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Data de hoje (YYYY-MM-DD) no horário do RS — evite `toISOString().slice(0, 10)` (UTC). */
export function todayYmd(value: DateLike = new Date()): string {
  const { year, month, day } = datePartsInAppTz(asDate(value));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Alias explícito. */
export const todayYmdRS = todayYmd;

export function formatTimeInAppTz(
  value: DateLike,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  return asDate(value).toLocaleTimeString("pt-BR", {
    timeZone: APP_TIMEZONE,
    ...opts,
  });
}

export function formatDateTimeInAppTz(value: DateLike): string {
  return asDate(value).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Ano/mês correntes no fuso do RS (1–12). */
export function currentYearMonthInAppTz(value: DateLike = new Date()): {
  year: number;
  month: number;
} {
  const { year, month } = datePartsInAppTz(value);
  return { year, month };
}

/** Relógio: HH:MM:SS - DD/MM/AAAA no fuso do RS. */
export function formatClockInAppTz(value: DateLike = new Date()): string {
  const { year, month, day, hour, minute, second } = datePartsInAppTz(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)}:${pad(second)} - ${pad(day)}/${pad(month)}/${year}`;
}

/**
 * Converte valor de `<input type="datetime-local">` (YYYY-MM-DDTHH:mm)
 * interpretado como horário de parede em APP_TIMEZONE → instante UTC.
 */
export function fromAppTzDateTimeLocal(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return new Date(NaN);
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const desiredAsUtc = Date.UTC(y, month - 1, day, hour, minute, 0);

  let utcMs = desiredAsUtc;
  for (let i = 0; i < 3; i++) {
    const parts = datePartsInAppTz(new Date(utcMs));
    const wallAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = desiredAsUtc - wallAsUtc;
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs);
}

/** Formata um instante como valor datetime-local no fuso do app. */
export function toAppTzDateTimeLocal(value: DateLike): string {
  const { year, month, day, hour, minute } = datePartsInAppTz(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
