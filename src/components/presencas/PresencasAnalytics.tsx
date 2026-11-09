import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAttendance } from "@/lib/attendance.functions";
import { eventCountsForAttendance, TYPE_META, type CalendarType } from "@/lib/calendar-types";
import {
  memberEligibleForAttendance,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { formatDateBR } from "@/lib/format";
import { attendanceOverviewKey } from "@/lib/query-keys";
import { termLabel } from "@/lib/terms";

export type CalItem = {
  id: string;
  title: string;
  event_type: string;
  mandatory: boolean;
  start_at: string;
};

export type AttendanceRec = {
  member_id: string;
  calendar_event_id: string;
  status: string;
  justification: string | null;
};

export type CellStatus = "presente" | "ausente" | "pendente" | "na";

export function eventYear(startAt: string): number | null {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

/** Semestre civil: jan–jun = 1, jul–dez = 2. */
function eventSemester(startAt: string): 1 | 2 | null {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getMonth() < 6 ? 1 : 2;
}

function shortHeader(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function monthKey(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const MONTH_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const CELL_STYLE: Record<CellStatus, string> = {
  presente:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  ausente: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  pendente:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  na: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-500",
};

const CELL_LETTER: Record<CellStatus, string> = {
  presente: "P",
  ausente: "A",
  pendente: "·",
  na: "—",
};

const CELL_LABEL: Record<Exclude<CellStatus, "na">, string> = {
  presente: "Presente",
  ausente: "Ausente",
  pendente: "Indefinido",
};

export function buildRecordMap(records: AttendanceRec[]) {
  const m = new Map<string, AttendanceRec>();
  for (const r of records) m.set(`${r.member_id}:${r.calendar_event_id}`, r);
  return m;
}

export function cellStatus(
  member: DueMemberLite,
  event: CalItem,
  recordByKey: Map<string, AttendanceRec>,
): CellStatus {
  if (!memberEligibleForAttendance(member, event.start_at)) return "na";
  const rec = recordByKey.get(`${member.id}:${event.id}`);
  if (!rec) return "pendente";
  if (rec.status === "presente") return "presente";
  return "ausente";
}

/* ─── Gráficos ─────────────────────────────────────────────── */

function cycleAttendanceStatus(
  status: CellStatus,
): "presente" | "ausente" | null {
  if (status === "presente") return "ausente";
  if (status === "ausente") return null;
  return "presente";
}

function OverviewAttendanceCell({
  status,
  justification,
  memberName,
  eventTitle,
  eventDate,
  onSet,
}: {
  status: CellStatus;
  justification: string | null;
  memberName: string;
  eventTitle: string;
  eventDate: string;
  onSet: (next: "presente" | "ausente" | null) => void;
}) {
  const statusLabel = status === "na" ? "Não elegível" : CELL_LABEL[status];
  const tip =
    status === "na"
      ? "Não elegível"
      : status === "ausente" && justification
        ? `Ausente · ${justification} · clique para ciclar`
        : `${statusLabel} · clique: P → A → Indefinido`;

  return (
    <button
      type="button"
      disabled={status === "na"}
      title={tip}
      aria-label={`${memberName} · ${eventTitle} · ${eventDate} · ${statusLabel}`}
      onClick={() => {
        if (status === "na") return;
        onSet(cycleAttendanceStatus(status));
      }}
      className={`inline-flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide transition hover:ring-2 hover:ring-ring disabled:cursor-default disabled:hover:ring-0 ${CELL_STYLE[status]}`}
    >
      {CELL_LETTER[status]}
    </button>
  );
}

type AttendanceOverviewCache = {
  items: CalItem[];
  members: DueMemberLite[];
  records: AttendanceRec[];
};

export function PresencasOverviewTab({
  items,
  members,
  records,
  year,
  availableYears,
  onYearChange,
  semester,
  onSemesterChange,
  chapterId,
}: {
  items: CalItem[];
  members: DueMemberLite[];
  records: AttendanceRec[];
  year: number;
  availableYears: number[];
  onYearChange: (y: number) => void;
  semester: 1 | 2;
  onSemesterChange: (s: 1 | 2) => void;
  chapterId: string;
}) {
  const qc = useQueryClient();
  /** Overlay local: UI muda no clique; sync com o servidor em background (latest-wins). */
  type CellOverride = {
    status: "presente" | "ausente" | null;
    justification: string | null;
  };
  const [overrides, setOverrides] = useState(
    () => new Map<string, CellOverride>(),
  );
  const latestRef = useRef(new Map<string, CellOverride>());
  const flushingRef = useRef(new Set<string>());

  const semesterEvents = useMemo(
    () =>
      items
        .filter(
          (i) =>
            eventYear(i.start_at) === year &&
            eventSemester(i.start_at) === semester,
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [items, year, semester],
  );

  const eventById = useMemo(() => {
    const m = new Map<string, CalItem>();
    for (const ev of semesterEvents) m.set(ev.id, ev);
    return m;
  }, [semesterEvents]);

  const recordByKey = useMemo(() => {
    const m = buildRecordMap(records);
    for (const [key, ov] of overrides) {
      if (ov.status === null) {
        m.delete(key);
        continue;
      }
      const sep = key.indexOf(":");
      const member_id = key.slice(0, sep);
      const calendar_event_id = key.slice(sep + 1);
      m.set(key, {
        member_id,
        calendar_event_id,
        status: ov.status,
        justification: ov.justification,
      });
    }
    return m;
  }, [records, overrides]);

  // Limpa overrides já confirmados pelo servidor
  useEffect(() => {
    setOverrides((prev) => {
      if (prev.size === 0) return prev;
      const server = buildRecordMap(records);
      let changed = false;
      const next = new Map(prev);
      for (const [key, ov] of prev) {
        if (flushingRef.current.has(key) || latestRef.current.has(key)) continue;
        const s = server.get(key);
        const matches =
          ov.status === null
            ? !s
            : s?.status === ov.status &&
              (s?.justification ?? null) === (ov.justification ?? null);
        if (matches) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [records]);

  const rows = useMemo(() => {
    return members
      .filter(
        (m) =>
          m.status === "regular" &&
          (m.kind === "demolay_ativo" || m.kind === "senior"),
      )
      .map((m) => {
        const cells = semesterEvents.map((ev) => {
          const st = cellStatus(m, ev, recordByKey);
          const rec = recordByKey.get(`${m.id}:${ev.id}`);
          return {
            eventId: ev.id,
            status: st,
            counts: eventCountsForAttendance(ev),
            justification: rec?.justification ?? null,
          };
        });
        // Indefinido (sem marcação) não é presença nem falta: fica fora da taxa.
        const countable = cells.filter(
          (c) =>
            c.counts && (c.status === "presente" || c.status === "ausente"),
        );
        const present = countable.filter((c) => c.status === "presente").length;
        const visible = cells.some((c) => c.status !== "na");
        return {
          member: m,
          cells,
          present,
          total: countable.length,
          visible,
          pct:
            countable.length > 0
              ? Math.round((present / countable.length) * 100)
              : null,
        };
      })
      .filter((r) => r.visible)
      .sort((a, b) =>
        a.member.full_name.localeCompare(b.member.full_name, "pt-BR"),
      );
  }, [members, semesterEvents, recordByKey]);

  function patchCache(
    memberId: string,
    eventId: string,
    status: "presente" | "ausente" | null,
    justification: string | null,
  ) {
    const key = attendanceOverviewKey(chapterId);
    qc.setQueryData<AttendanceOverviewCache>(key, (old) => {
      if (!old) return old;
      const nextRecords = [...(old.records ?? [])];
      const idx = nextRecords.findIndex(
        (r) => r.member_id === memberId && r.calendar_event_id === eventId,
      );
      if (status === null) {
        if (idx >= 0) nextRecords.splice(idx, 1);
      } else if (idx >= 0) {
        nextRecords[idx] = {
          ...nextRecords[idx],
          status,
          justification,
        };
      } else {
        nextRecords.push({
          member_id: memberId,
          calendar_event_id: eventId,
          status,
          justification,
        });
      }
      return { ...old, records: nextRecords };
    });
  }

  async function flushCell(cellKey: string) {
    if (flushingRef.current.has(cellKey)) return;
    flushingRef.current.add(cellKey);
    const sep = cellKey.indexOf(":");
    const memberId = cellKey.slice(0, sep);
    const calendarEventId = cellKey.slice(sep + 1);

    try {
      while (latestRef.current.has(cellKey)) {
        const payload = latestRef.current.get(cellKey)!;
        latestRef.current.delete(cellKey);
        try {
          await setAttendance({
            data: {
              chapterId,
              calendarEventId,
              memberId,
              status: payload.status,
              justification: payload.justification,
            },
          });
          // Só grava no cache se não houver clique mais novo nesta célula
          if (!latestRef.current.has(cellKey)) {
            patchCache(
              memberId,
              calendarEventId,
              payload.status,
              payload.justification,
            );
            setOverrides((prev) => {
              const cur = prev.get(cellKey);
              if (
                !cur ||
                cur.status !== payload.status ||
                cur.justification !== payload.justification
              ) {
                return prev;
              }
              const next = new Map(prev);
              next.delete(cellKey);
              return next;
            });
          }
        } catch (e) {
          latestRef.current.delete(cellKey);
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(cellKey);
            return next;
          });
          void qc.invalidateQueries({
            queryKey: attendanceOverviewKey(chapterId),
          });
          toast.error(
            e instanceof Error ? e.message : "Erro ao atualizar presença",
          );
          break;
        }
      }
    } finally {
      flushingRef.current.delete(cellKey);
      if (latestRef.current.has(cellKey)) void flushCell(cellKey);
    }
  }

  function setCell(
    memberId: string,
    eventId: string,
    next: "presente" | "ausente" | null,
  ) {
    const cellKey = `${memberId}:${eventId}`;
    const prev = recordByKey.get(cellKey);
    const justification =
      next === "ausente" ? (prev?.justification ?? null) : null;
    const payload = { status: next, justification };

    // UI imediata via overlay; servidor em background (latest-wins)
    latestRef.current.set(cellKey, payload);
    setOverrides((prevMap) => {
      const map = new Map(prevMap);
      map.set(cellKey, payload);
      return map;
    });
    void flushCell(cellKey);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(year)}
          onValueChange={(v) => onYearChange(Number(v))}
        >
          <SelectTrigger className="h-9 w-[110px] text-xs">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(semester)}
          onValueChange={(v) => onSemesterChange(Number(v) as 1 | 2)}
        >
          <SelectTrigger className="h-9 w-[min(100%,200px)] min-w-[140px] text-xs">
            <SelectValue placeholder="Semestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1º semestre</SelectItem>
            <SelectItem value="2">2º semestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {semesterEvents.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma chamada no {termLabel(year, semester)}.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum membro elegível nas chamadas deste semestre.
        </Card>
      ) : (
        <>
          {/* Mobile / telas estreitas: um card por membro */}
          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Card key={row.member.id} className="p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <Link
                    to="/membros/$id"
                    params={{ id: row.member.id }}
                    className="min-w-0 text-sm font-medium leading-snug hover:underline"
                  >
                    {row.member.full_name}
                  </Link>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {row.pct === null ? "—" : `${row.pct}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.present}/{row.total}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {row.cells.map((cell) => {
                    const ev = eventById.get(cell.eventId);
                    const meta = ev
                      ? TYPE_META[ev.event_type as CalendarType]
                      : undefined;
                    return (
                      <div
                        key={cell.eventId}
                        className={`min-w-0 space-y-1 ${cell.counts ? "" : "rounded-md bg-zinc-100/80 dark:bg-zinc-800/40"}`}
                      >
                        <Link
                          to="/ongoing/$id"
                          params={{ id: cell.eventId }}
                          search={{ tab: "chamada" }}
                          className={`flex items-center justify-center gap-1 text-xs hover:text-foreground ${
                            cell.counts
                              ? "text-muted-foreground"
                              : "text-zinc-400"
                          }`}
                          title={
                            ev
                              ? `${ev.title} · ${formatDateBR(ev.start_at)}${cell.counts ? "" : " · Facultativo"}`
                              : undefined
                          }
                        >
                          <span>{ev ? shortHeader(ev.start_at) : "—"}</span>
                          {cell.counts ? (
                            <span
                              className="h-1 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: meta?.color ?? "#888" }}
                            />
                          ) : (
                            <Ban className="h-2.5 w-2.5 shrink-0" />
                          )}
                        </Link>
                        <OverviewAttendanceCell
                          status={cell.status}
                          justification={cell.justification}
                          memberName={row.member.full_name}
                          eventTitle={ev?.title ?? "Chamada"}
                          eventDate={ev ? formatDateBR(ev.start_at) : ""}
                          onSet={(next) =>
                            setCell(row.member.id, cell.eventId, next)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
            <div className="flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
              <LegendDot
                className={CELL_STYLE.presente}
                letter="P"
                label="Presente"
              />
              <LegendDot
                className={CELL_STYLE.ausente}
                letter="A"
                label="Ausente"
              />
              <LegendDot
                className={CELL_STYLE.pendente}
                letter="·"
                label="Indefinido"
              />
              <LegendDot
                className={CELL_STYLE.na}
                letter="—"
                label="Não elegível"
              />
              <span className="inline-flex items-center gap-1.5">
                <Ban className="h-3 w-3 text-zinc-400" />
                Facultativo
              </span>
            </div>
          </div>

          {/* Desktop: matriz com scroll horizontal quando há muitos eventos */}
          <Card className="hidden overflow-hidden p-0 lg:block">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="sticky left-0 z-10 w-[12rem] bg-muted/40 px-3 py-3 text-left text-xs font-medium">
                      Membro
                    </th>
                    {semesterEvents.map((ev) => {
                      const meta = TYPE_META[ev.event_type as CalendarType];
                      const counts = eventCountsForAttendance(ev);
                      return (
                        <th
                          key={ev.id}
                          className={`min-w-[3rem] px-0.5 py-3 text-center text-xs font-medium ${
                            counts
                              ? "text-muted-foreground"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800/60"
                          }`}
                          title={`${ev.title} · ${formatDateBR(ev.start_at)} · ${meta?.label ?? ev.event_type}${counts ? " · Obrigatório" : " · Facultativo"}`}
                        >
                          <Link
                            to="/ongoing/$id"
                            params={{ id: ev.id }}
                            search={{ tab: "chamada" }}
                            className="inline-flex w-full flex-col items-center gap-0.5 hover:text-foreground"
                          >
                            <span>{shortHeader(ev.start_at)}</span>
                            {counts ? (
                              <span
                                className="h-1 w-1 rounded-full"
                                style={{
                                  backgroundColor: meta?.color ?? "#888",
                                }}
                              />
                            ) : (
                              <Ban className="h-3 w-3" />
                            )}
                          </Link>
                        </th>
                      );
                    })}
                    <th className="w-[3.5rem] px-2 py-3 text-center text-xs font-medium text-muted-foreground">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.member.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td
                        className="sticky left-0 z-10 bg-background px-3 py-2.5 font-medium"
                        title={row.member.full_name}
                      >
                        <Link
                          to="/membros/$id"
                          params={{ id: row.member.id }}
                          className="block truncate text-sm leading-snug hover:underline"
                        >
                          {row.member.full_name}
                        </Link>
                      </td>
                      {row.cells.map((cell) => {
                        const ev = eventById.get(cell.eventId);
                        return (
                          <td
                            key={cell.eventId}
                            className={`px-0.5 py-2 text-center ${
                              cell.counts
                                ? ""
                                : "bg-zinc-100/80 dark:bg-zinc-800/40"
                            }`}
                          >
                            <OverviewAttendanceCell
                              status={cell.status}
                              justification={cell.justification}
                              memberName={row.member.full_name}
                              eventTitle={ev?.title ?? "Chamada"}
                              eventDate={ev ? formatDateBR(ev.start_at) : ""}
                              onSet={(next) =>
                                setCell(row.member.id, cell.eventId, next)
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums">
                        {row.pct === null ? "—" : `${row.pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <LegendDot
                className={CELL_STYLE.presente}
                letter="P"
                label="Presente"
              />
              <LegendDot
                className={CELL_STYLE.ausente}
                letter="A"
                label="Ausente"
              />
              <LegendDot
                className={CELL_STYLE.pendente}
                letter="·"
                label="Indefinido"
              />
              <LegendDot
                className={CELL_STYLE.na}
                letter="—"
                label="Não elegível"
              />
              <span className="inline-flex items-center gap-1.5">
                <Ban className="h-3 w-3 text-zinc-400" />
                Facultativo
              </span>
            </div>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Clique na célula para ciclar: Presente → Ausente → Indefinido. Clique na
        data para abrir a chamada. Só sessões e filantropias têm chamada; colunas
        em cinza são facultativas e ficam fora da porcentagem. Indefinido (sem
        marcação) não conta como presença nem como falta. 1º semestre = jan–jun
        · 2º = jul–dez.
      </p>
    </div>
  );
}

function LegendDot({
  className,
  letter,
  label,
}: {
  className: string;
  letter: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold ${className}`}
      >
        {letter}
      </span>
      {label}
    </span>
  );
}
