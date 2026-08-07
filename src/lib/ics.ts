export type IcsItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  address?: string | null;
  start_at: string;
  end_at?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC no formato compacto exigido pelo iCalendar/Google. */
export function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function endOrDefault(item: IcsItem): string {
  if (item.end_at) return item.end_at;
  const d = new Date(item.start_at);
  d.setHours(d.getHours() + 3);
  return d.toISOString();
}

export function fullLocation(item: IcsItem): string {
  return [item.location, item.address].filter(Boolean).join(" — ");
}

function escapeIcs(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Gera um arquivo .ics compatível com Google Agenda, Apple, Outlook e Teams. */
export function buildIcs(items: IcsItem[], calendarName = "Templo Virtual"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Templo Virtual//Calendario//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const it of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${it.id}@sg-cdm`,
      `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
      `DTSTART:${toUtcStamp(it.start_at)}`,
      `DTEND:${toUtcStamp(endOrDefault(it))}`,
      `SUMMARY:${escapeIcs(it.title)}`,
    );
    const loc = fullLocation(it);
    if (loc) lines.push(`LOCATION:${escapeIcs(loc)}`);
    if (it.description) lines.push(`DESCRIPTION:${escapeIcs(it.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(items: IcsItem[], filename: string, calendarName?: string) {
  const blob = new Blob([buildIcs(items, calendarName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(item: IcsItem): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${toUtcStamp(item.start_at)}/${toUtcStamp(endOrDefault(item))}`,
  });
  const loc = fullLocation(item);
  if (loc) params.set("location", loc);
  if (item.description) params.set("details", item.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(item: IcsItem): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: item.title,
    startdt: new Date(item.start_at).toISOString(),
    enddt: new Date(endOrDefault(item)).toISOString(),
  });
  const loc = fullLocation(item);
  if (loc) params.set("location", loc);
  if (item.description) params.set("body", item.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
