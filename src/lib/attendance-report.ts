import { eventCountsForAttendance } from "@/lib/calendar-types";
import {
  memberEligibleForAttendance,
  turns21On,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { formatDateBR } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";

export type ReportItem = {
  id: string;
  start_at: string;
  event_type?: string;
  mandatory?: boolean;
  [k: string]: unknown;
};

export type ReportRecord = {
  member_id: string;
  calendar_event_id: string;
  status: string;
};

export type AttendanceReportRow = {
  id: string;
  name: string;
  situation: "Ativo" | "Sênior";
  present: number;
  total: number;
  pct: number | null;
  obs: string;
};

export type ReportBounds = { fromYmd: string; toYmd: string };

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Monta as linhas do relatório de frequência. Diferente da lista da tela, aqui
 * entram também membros que ficaram inativos (período de afastamento) ou
 * viraram Sênior durante o período, com a explicação na observação.
 */
export function buildAttendanceReportRows(input: {
  items: ReportItem[];
  members: DueMemberLite[];
  records: ReportRecord[];
  bounds: ReportBounds;
}): AttendanceReportRow[] {
  const { bounds } = input;
  const today = todayYmd();

  const events = input.items
    .filter((i) => eventCountsForAttendance(i as never))
    .map((i) => ({ item: i, date: todayYmd(new Date(i.start_at)) }))
    .filter((e) => e.date >= bounds.fromYmd && e.date <= bounds.toYmd);

  const recordByKey = new Map<string, string>();
  for (const r of input.records) {
    recordByKey.set(`${r.member_id}:${r.calendar_event_id}`, r.status);
  }

  const rows: AttendanceReportRow[] = [];

  for (const m of input.members) {
    if (m.kind !== "demolay_ativo" && m.kind !== "senior") continue;
    const away = (m.awayPeriods ?? []).filter((p) => !!p.started_on);
    // Elegibilidade por data ignora o status atual (um inativo de hoje ainda
    // tem a frequência de quando estava ativo).
    const asRegular: DueMemberLite = { ...m, status: "regular" };

    let total = 0;
    let present = 0;
    for (const ev of events) {
      if (!memberEligibleForAttendance(asRegular, ev.item.start_at)) continue;
      const inAway = away.some(
        (p) =>
          ev.date >= p.started_on.slice(0, 10) &&
          (!p.ended_on || ev.date < p.ended_on.slice(0, 10)),
      );
      if (inAway) continue;
      const st = recordByKey.get(`${m.id}:${ev.item.id}`);
      if (st !== "presente" && st !== "ausente") continue;
      total += 1;
      if (st === "presente") present += 1;
    }

    const t21 = turns21On(m.birth_date);
    const t21Ymd = t21 ? ymd(t21.y, t21.m, t21.d) : null;
    const isSenior =
      m.kind === "senior" || (t21Ymd != null && t21Ymd <= today);

    const notes: string[] = [];
    const counted = `${present} presença${present === 1 ? "" : "s"} em ${total} contabilizada${total === 1 ? "" : "s"}`;

    // Inatividade dentro do período do relatório
    const awayInRange = away
      .filter(
        (p) =>
          p.started_on.slice(0, 10) <= bounds.toYmd &&
          (!p.ended_on || p.ended_on.slice(0, 10) > bounds.fromYmd),
      )
      .sort((a, b) => a.started_on.localeCompare(b.started_on));
    for (const p of awayInRange) {
      notes.push(
        p.ended_on
          ? `Inativo de ${formatDateBR(p.started_on.slice(0, 10))} a ${formatDateBR(p.ended_on.slice(0, 10))}`
          : `Inativo a partir de ${formatDateBR(p.started_on.slice(0, 10))}`,
      );
    }
    if (awayInRange.length === 0 && m.status === "irregular") {
      notes.push("Inativo (início não registrado)");
    }

    const turnedSeniorInRange =
      t21Ymd != null && t21Ymd >= bounds.fromYmd && t21Ymd <= bounds.toYmd;
    if (turnedSeniorInRange) {
      notes.push(`Sênior a partir de ${formatDateBR(t21Ymd!)}`);
    }
    if (notes.length > 0 && (turnedSeniorInRange || awayInRange.length > 0)) {
      notes.push(`${counted} até então`);
    }

    if (total === 0 && notes.length === 0) continue;

    rows.push({
      id: m.id,
      name: m.full_name,
      situation: isSenior ? "Sênior" : "Ativo",
      present,
      total,
      pct: total > 0 ? Math.round((present / total) * 100) : null,
      obs: notes.join(" · "),
    });
  }

  return rows.sort(
    (a, b) =>
      (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name, "pt-BR"),
  );
}
