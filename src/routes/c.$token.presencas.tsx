import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { getPublicAttendance } from "@/lib/lobby-share.functions";
import {
  memberEligibleForAttendance,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { typeLabel } from "@/lib/calendar-types";
import { formatDateBR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/c/$token/presencas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Presenças — SG-CDM" }],
  }),
  component: LobbyPresencasPage,
});

function eventSemester(startsAt: string): 1 | 2 {
  const m = Number(startsAt.slice(5, 7));
  if (!Number.isFinite(m) || m < 1 || m > 12) return 1;
  return m < 7 ? 1 : 2;
}

function shortDate(startsAt: string): string {
  const ymd = startsAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "—";
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

function attendanceCellClass(status: string) {
  if (status === "presente") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  if (status === "ausente") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";
  }
  if (status === "n/a") {
    return "bg-transparent text-muted-foreground/40";
  }
  return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400";
}

function attendanceCellLetter(status: string) {
  if (status === "presente") return "P";
  if (status === "ausente") return "A";
  if (status === "n/a") return "·";
  return "—";
}

function LobbyPresencasPage() {
  const { token } = usePublicLobby();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [semester, setSemester] = useState<1 | 2>(now.getMonth() < 6 ? 1 : 2);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["public-attendance", token, year],
    queryFn: () => getPublicAttendance({ data: { token, year } }),
    retry: false,
    staleTime: 60_000,
  });

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 4; y--) list.push(y);
    return list;
  }, []);

  const semesterEvents = useMemo(() => {
    const events = data?.events ?? [];
    return events
      .filter((e) => eventSemester(e.starts_at) === semester)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [data?.events, semester]);

  const recordByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data?.records ?? []) {
      map.set(`${r.member_id}:${r.event_id}`, r.status);
    }
    return map;
  }, [data?.records]);

  const rows = useMemo(() => {
    const members = (data?.members ?? []) as DueMemberLite[];
    return members
      .map((m) => {
        const cells = semesterEvents.map((ev) => {
          if (!memberEligibleForAttendance(m, ev.starts_at)) {
            return { eventId: ev.id, status: "n/a" as const };
          }
          const status = recordByKey.get(`${m.id}:${ev.id}`);
          return {
            eventId: ev.id,
            status: (status as "presente" | "ausente" | undefined) ?? "sem",
          };
        });
        const counted = cells.filter((c) => c.status === "presente" || c.status === "ausente");
        const present = counted.filter((c) => c.status === "presente").length;
        const pct = counted.length ? Math.round((present / counted.length) * 100) : null;
        return { member: m, cells, pct, present, total: counted.length };
      })
      .filter((r) => r.cells.some((c) => c.status !== "n/a"))
      .sort((a, b) => a.member.full_name.localeCompare(b.member.full_name, "pt-BR"));
  }, [data?.members, semesterEvents, recordByKey]);

  return (
    <div>
      <LobbyBackLink />
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Presenças e frequência</h2>
        <p className="text-sm text-muted-foreground">
          Eventos obrigatórios · somente leitura
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Ano</p>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Semestre</p>
          <Select
            value={String(semester)}
            onValueChange={(v) => setSemester(Number(v) as 1 | 2)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º (jan–jun)</SelectItem>
              <SelectItem value="2">2º (jul–dez)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFetching && !isLoading ? (
          <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {error ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {(error as Error).message}
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
        </div>
      ) : semesterEvents.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma chamada obrigatória neste semestre.
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Mobile: cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Card key={row.member.id} className="rounded-[12px] p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm font-medium leading-snug">
                    {row.member.full_name}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {row.pct == null ? "—" : `${row.pct}%`}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.present}/{row.total}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {row.cells.map((cell, idx) => {
                    const ev = semesterEvents[idx];
                    return (
                      <div key={cell.eventId} className="min-w-0 space-y-1">
                        <div
                          className="truncate text-center text-[10px] text-muted-foreground"
                          title={
                            ev
                              ? `${ev.title} · ${formatDateBR(ev.starts_at)} · ${typeLabel(ev.event_type)}`
                              : undefined
                          }
                        >
                          {ev
                            ? formatDateBR(ev.starts_at).slice(0, 5)
                            : "—"}
                        </div>
                        <div
                          className={`flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold ${attendanceCellClass(cell.status)}`}
                        >
                          {attendanceCellLetter(cell.status)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: matriz com scroll horizontal */}
          <Card className="hidden overflow-hidden rounded-[12px] p-0 lg:block">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="sticky left-0 z-10 w-[12rem] bg-muted/40 px-3 py-2 text-left font-medium">
                      Membro
                    </th>
                    {semesterEvents.map((ev) => (
                      <th
                        key={ev.id}
                        className="min-w-[3rem] px-0.5 py-2 text-center text-[10px] font-medium text-muted-foreground"
                        title={`${ev.title} · ${typeLabel(ev.event_type)} · ${formatDateBR(ev.starts_at)}`}
                      >
                        {shortDate(ev.starts_at)}
                      </th>
                    ))}
                    <th className="w-[4.5rem] px-2 py-2 text-center text-xs font-medium">
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
                        className="sticky left-0 z-10 bg-background px-3 py-2 font-medium"
                        title={row.member.full_name}
                      >
                        <div className="truncate">{row.member.full_name}</div>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={cell.eventId} className="px-0.5 py-1.5 text-center">
                          <span
                            className={`inline-flex h-8 w-full items-center justify-center rounded-md text-[10px] font-semibold ${attendanceCellClass(cell.status)}`}
                          >
                            {attendanceCellLetter(cell.status)}
                          </span>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center tabular-nums text-xs font-semibold">
                        {row.pct == null ? "—" : `${row.pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground">
            P presente · A ausente · — sem registro · · não elegível
          </p>
        </div>
      )}
    </div>
  );
}
