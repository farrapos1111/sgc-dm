import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAttendance } from "@/lib/attendance.functions";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
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

type CellStatus = "presente" | "ausente" | "pendente" | "na";

function eventYear(startAt: string): number | null {
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

function monthKey(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const CELL_STYLE: Record<CellStatus, string> = {
  presente: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  ausente: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  pendente: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
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
  pendente: "Pendente",
};

const CELL_DOT: Record<Exclude<CellStatus, "na">, string> = {
  presente: "bg-emerald-500",
  ausente: "bg-rose-500",
  pendente: "bg-amber-400",
};

function buildRecordMap(records: AttendanceRec[]) {
  const m = new Map<string, AttendanceRec>();
  for (const r of records) m.set(`${r.member_id}:${r.calendar_event_id}`, r);
  return m;
}

function cellStatus(
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

const byTypeConfig = {
  presentes: { label: "Presentes", color: "#047857" },
  ausentes: { label: "Ausentes", color: "#B91C1C" },
  pendentes: { label: "Pendentes", color: "#D97706" },
} satisfies ChartConfig;

const rateConfig = {
  pct: { label: "% presença", color: "var(--chapter-primary, #9E1B32)" },
} satisfies ChartConfig;

const pieConfig = {
  presentes: { label: "Presentes", color: "#047857" },
  ausentes: { label: "Ausentes", color: "#B91C1C" },
  pendentes: { label: "Pendentes", color: "#D97706" },
} satisfies ChartConfig;

export function PresencasChartsTab({
  items,
  members,
  records,
  year,
  availableYears,
  onYearChange,
}: {
  items: CalItem[];
  members: DueMemberLite[];
  records: AttendanceRec[];
  year: number;
  availableYears: number[];
  onYearChange: (y: number) => void;
}) {
  const yearItems = useMemo(
    () =>
      items
        .filter((i) => i.mandatory && eventYear(i.start_at) === year)
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [items, year],
  );

  const recordByKey = useMemo(() => buildRecordMap(records), [records]);

  const eligibleMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.status === "regular" &&
          (m.kind === "demolay_ativo" || m.kind === "senior"),
      ),
    [members],
  );

  const stats = useMemo(() => {
    let presentes = 0;
    let ausentes = 0;
    let pendentes = 0;
    let justified = 0;

    const byType = new Map<
      string,
      { type: string; label: string; presentes: number; ausentes: number; pendentes: number; total: number }
    >();
    const byMonth = new Map<string, { key: string; label: string; presentes: number; total: number }>();

    for (const ev of yearItems) {
      const t = ev.event_type;
      if (!byType.has(t)) {
        byType.set(t, {
          type: t,
          label: TYPE_META[t as CalendarType]?.label ?? t,
          presentes: 0,
          ausentes: 0,
          pendentes: 0,
          total: 0,
        });
      }
      const typeRow = byType.get(t)!;

      const mk = monthKey(ev.start_at);
      if (mk && !byMonth.has(mk)) {
        const m = Number(mk.slice(5, 7));
        byMonth.set(mk, { key: mk, label: MONTH_SHORT[m - 1] ?? mk, presentes: 0, total: 0 });
      }
      const monthRow = mk ? byMonth.get(mk)! : null;

      for (const mem of eligibleMembers) {
        const st = cellStatus(mem, ev, recordByKey);
        if (st === "na") continue;
        typeRow.total += 1;
        if (monthRow) monthRow.total += 1;
        if (st === "presente") {
          presentes += 1;
          typeRow.presentes += 1;
          if (monthRow) monthRow.presentes += 1;
        } else if (st === "ausente") {
          ausentes += 1;
          typeRow.ausentes += 1;
          const rec = recordByKey.get(`${mem.id}:${ev.id}`);
          if (rec?.justification) justified += 1;
        } else {
          pendentes += 1;
          typeRow.pendentes += 1;
        }
      }
    }

    const byTypeRows = [...byType.values()]
      .filter((r) => r.total > 0)
      .map((r) => ({
        ...r,
        pct: Math.round((r.presentes / r.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    const byMonthRows = [...byMonth.values()]
      .filter((r) => r.total > 0)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({
        ...r,
        pct: Math.round((r.presentes / r.total) * 100),
      }));

    const total = presentes + ausentes + pendentes;
    const overallPct = total > 0 ? Math.round((presentes / total) * 100) : null;

    const memberFreq = eligibleMembers
      .map((m) => {
        let totalM = 0;
        let presentM = 0;
        for (const ev of yearItems) {
          const st = cellStatus(m, ev, recordByKey);
          if (st === "na") continue;
          totalM += 1;
          if (st === "presente") presentM += 1;
        }
        return {
          id: m.id,
          name: m.full_name,
          total: totalM,
          present: presentM,
          pct: totalM > 0 ? Math.round((presentM / totalM) * 100) : null,
        };
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name, "pt-BR"));

    return {
      presentes,
      ausentes,
      pendentes,
      justified,
      total,
      overallPct,
      events: yearItems.length,
      byTypeRows,
      byMonthRows,
      top: memberFreq.slice(0, 8),
      bottom: memberFreq.slice(8).reverse().slice(0, 5),
    };
  }, [yearItems, eligibleMembers, recordByKey]);

  const pieData = [
    { key: "presentes", name: "Presentes", value: stats.presentes, fill: "#047857" },
    { key: "ausentes", name: "Ausentes", value: stats.ausentes, fill: "#B91C1C" },
    { key: "pendentes", name: "Pendentes", value: stats.pendentes, fill: "#D97706" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
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
        <p className="text-xs text-muted-foreground">
          Somente eventos obrigatórios · {stats.events} chamada{stats.events === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Taxa de presença" value={stats.overallPct === null ? "—" : `${stats.overallPct}%`} />
        <Kpi label="Presentes" value={String(stats.presentes)} accent="#047857" />
        <Kpi label="Ausentes" value={String(stats.ausentes)} accent="#B91C1C" />
        <Kpi
          label="Justificadas"
          value={String(stats.justified)}
          hint={`${stats.pendentes} pendente${stats.pendentes === 1 ? "" : "s"}`}
        />
      </div>

      {stats.total === 0 ? (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Sem registros de presença em {year} para montar os gráficos.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[12px] p-4">
              <h3 className="mb-1 text-sm font-medium">Presença por pauta</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Presentes, ausentes e pendentes por tipo de evento
              </p>
              <ChartContainer config={byTypeConfig} className="aspect-[4/3] w-full">
                <BarChart data={stats.byTypeRows} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <XAxis type="number" hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="presentes" stackId="a" fill="var(--color-presentes)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="ausentes" stackId="a" fill="var(--color-ausentes)" />
                  <Bar dataKey="pendentes" stackId="a" fill="var(--color-pendentes)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </Card>

            <Card className="rounded-[12px] p-4">
              <h3 className="mb-1 text-sm font-medium">Distribuição geral</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Total de marcações elegíveis em {year}
              </p>
              <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-[260px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={2}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                    <LabelList dataKey="value" className="fill-background text-[11px] font-medium" />
                  </Pie>
                </PieChart>
              </ChartContainer>
            </Card>
          </div>

          <Card className="rounded-[12px] p-4">
            <h3 className="mb-1 text-sm font-medium">Taxa mensal de presença</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              % de presentes sobre o total elegível em cada mês
            </p>
            {stats.byMonthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados mensais.</p>
            ) : (
              <ChartContainer config={rateConfig} className="aspect-[21/9] w-full min-h-[200px]">
                <BarChart data={stats.byMonthRows} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `${value}%`}
                      />
                    }
                  />
                  <Bar dataKey="pct" fill="var(--color-pct)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[12px] p-0">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-medium">Melhores frequências</h3>
              </div>
              <ul className="divide-y divide-border">
                {stats.top.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link
                      to="/membros/$id"
                      params={{ id: m.id }}
                      className="min-w-0 truncate text-sm font-medium"
                    >
                      {m.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.present}/{m.total} ·{" "}
                      <span className="font-semibold text-emerald-700">{m.pct}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="rounded-[12px] p-0">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-medium">Menores frequências</h3>
              </div>
              <ul className="divide-y divide-border">
                {stats.bottom.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link
                      to="/membros/$id"
                      params={{ id: m.id }}
                      className="min-w-0 truncate text-sm font-medium"
                    >
                      {m.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.present}/{m.total} ·{" "}
                      <span className="font-semibold text-rose-700">{m.pct}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-[12px] p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

/* ─── Visão geral (matriz) ─────────────────────────────────── */

function OverviewAttendanceCell({
  status,
  justification,
  memberName,
  eventTitle,
  eventDate,
  busy,
  onSet,
}: {
  status: CellStatus;
  justification: string | null;
  memberName: string;
  eventTitle: string;
  eventDate: string;
  busy: boolean;
  onSet: (next: "presente" | "ausente" | null) => void;
}) {
  const statusLabel = status === "na" ? "Não elegível" : CELL_LABEL[status];
  const tip =
    status === "ausente" && justification
      ? `Ausente · ${justification}`
      : status === "presente"
        ? "Presente · clique para alterar"
        : status === "ausente"
          ? "Ausente · clique para alterar"
          : status === "pendente"
            ? "Pendente · clique para alterar"
            : "Não elegível";

  const button = (
    <button
      type="button"
      disabled={status === "na" || busy}
      title={tip}
      aria-label={`${memberName} · ${eventTitle} · ${eventDate} · ${statusLabel}`}
      className={`inline-flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wide transition hover:ring-2 hover:ring-ring disabled:cursor-default disabled:hover:ring-0 ${CELL_STYLE[status]} ${busy ? "opacity-60" : ""}`}
    >
      {CELL_LETTER[status]}
    </button>
  );

  if (status === "na") return button;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-xs font-medium">{memberName}</div>
          <div className="truncate text-[11px] text-muted-foreground">{eventTitle}</div>
          <div className="text-[11px] text-muted-foreground">{eventDate}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["presente", "ausente", "pendente"] as const).map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={status === s || busy}
            onSelect={() => onSet(s === "pendente" ? null : s)}
          >
            <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-sm ${CELL_DOT[s]}`} />
            {CELL_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const semesterEvents = useMemo(
    () =>
      items
        .filter(
          (i) =>
            eventYear(i.start_at) === year && eventSemester(i.start_at) === semester,
        )
        .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [items, year, semester],
  );

  const eventById = useMemo(() => {
    const m = new Map<string, CalItem>();
    for (const ev of semesterEvents) m.set(ev.id, ev);
    return m;
  }, [semesterEvents]);

  const recordByKey = useMemo(() => buildRecordMap(records), [records]);

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
          return { eventId: ev.id, status: st, justification: rec?.justification ?? null };
        });
        const eligible = cells.filter((c) => c.status !== "na");
        const present = eligible.filter((c) => c.status === "presente").length;
        return {
          member: m,
          cells,
          present,
          total: eligible.length,
          pct: eligible.length > 0 ? Math.round((present / eligible.length) * 100) : null,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => a.member.full_name.localeCompare(b.member.full_name, "pt-BR"));
  }, [members, semesterEvents, recordByKey]);

  const mark = useMutation({
    mutationFn: (v: {
      memberId: string;
      calendarEventId: string;
      status: "presente" | "ausente" | null;
      justification?: string | null;
    }) =>
      setAttendance({
        data: {
          chapterId,
          calendarEventId: v.calendarEventId,
          memberId: v.memberId,
          status: v.status,
          justification: v.justification ?? null,
        },
      }),
    onMutate: (v) => setPendingKey(`${v.memberId}:${v.calendarEventId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attendanceOverviewKey(chapterId) });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar presença"),
    onSettled: () => setPendingKey(null),
  });

  function setCell(
    memberId: string,
    eventId: string,
    next: "presente" | "ausente" | null,
  ) {
    const prev = recordByKey.get(`${memberId}:${eventId}`);
    mark.mutate({
      memberId,
      calendarEventId: eventId,
      status: next,
      justification: next === "ausente" ? (prev?.justification ?? null) : null,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
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
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue placeholder="Semestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{termLabel(year, 1)}</SelectItem>
            <SelectItem value="2">{termLabel(year, 2)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {semesterEvents.length === 0 ? (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma chamada no {termLabel(year, semester)}.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhum membro elegível nas chamadas deste semestre.
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-[12px] p-0">
          <div className="w-full">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[28%]" />
                {semesterEvents.map((ev) => (
                  <col key={ev.id} />
                ))}
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium">Membro</th>
                  {semesterEvents.map((ev) => {
                    const meta = TYPE_META[ev.event_type as CalendarType];
                    return (
                      <th
                        key={ev.id}
                        className="px-1 py-3 text-center text-[10px] font-medium text-muted-foreground"
                        title={`${ev.title} · ${formatDateBR(ev.start_at)} · ${meta?.label ?? ev.event_type}${ev.mandatory ? " · Obrigatório" : " · Facultativo"}`}
                      >
                        <Link
                          to="/ongoing/$id"
                          params={{ id: ev.id }}
                          className="inline-flex w-full flex-col items-center gap-0.5 hover:text-foreground"
                        >
                          <span>{shortHeader(ev.start_at)}</span>
                          <span
                            className="h-1 w-1 rounded-full"
                            style={{ backgroundColor: meta?.color ?? "#888" }}
                          />
                        </Link>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.member.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium" title={row.member.full_name}>
                      <Link
                        to="/membros/$id"
                        params={{ id: row.member.id }}
                        className="block text-sm leading-snug hover:underline"
                      >
                        {row.member.full_name}
                      </Link>
                    </td>
                    {row.cells.map((cell) => {
                      const ev = eventById.get(cell.eventId);
                      return (
                        <td key={cell.eventId} className="px-1.5 py-2 text-center">
                          <OverviewAttendanceCell
                            status={cell.status}
                            justification={cell.justification}
                            memberName={row.member.full_name}
                            eventTitle={ev?.title ?? "Chamada"}
                            eventDate={ev ? formatDateBR(ev.start_at) : ""}
                            busy={pendingKey === `${row.member.id}:${cell.eventId}`}
                            onSet={(next) => setCell(row.member.id, cell.eventId, next)}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums">
                      {row.pct === null ? "—" : `${row.pct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <LegendDot className={CELL_STYLE.presente} letter="P" label="Presente" />
            <LegendDot className={CELL_STYLE.ausente} letter="A" label="Ausente" />
            <LegendDot className={CELL_STYLE.pendente} letter="·" label="Pendente" />
            <LegendDot className={CELL_STYLE.na} letter="—" label="Não elegível" />
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Clique na célula para marcar presente, ausente ou pendente. Clique na data do cabeçalho
        para abrir a chamada. 1º semestre = jan–jun · 2º = jul–dez.
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
        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${className}`}
      >
        {letter}
      </span>
      {label}
    </span>
  );
}
