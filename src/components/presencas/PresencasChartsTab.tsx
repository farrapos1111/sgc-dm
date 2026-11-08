import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventCountsForAttendance, TYPE_META, type CalendarType } from "@/lib/calendar-types";
import type { DueMemberLite } from "@/lib/dues-rules";
import {
  MONTH_SHORT,
  buildRecordMap,
  cellStatus,
  eventYear,
  monthKey,
  type AttendanceRec,
  type CalItem,
} from "@/components/presencas/PresencasAnalytics";

/** Aba de gráficos de presença — separada para o recharts (~400 KB) só carregar quando aberta. */
const byTypeConfig = {
  presentes: { label: "Presentes", color: "#047857" },
  ausentes: { label: "Ausentes", color: "#B91C1C" },
  pendentes: { label: "Indefinidos", color: "#D97706" },
} satisfies ChartConfig;

const rateConfig = {
  pct: { label: "% presença", color: "var(--chapter-primary, #9E1B32)" },
} satisfies ChartConfig;

const pieConfig = {
  presentes: { label: "Presentes", color: "#047857" },
  ausentes: { label: "Ausentes", color: "#B91C1C" },
  pendentes: { label: "Indefinidos", color: "#D97706" },
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
        .filter(
          (i) =>
            eventCountsForAttendance(i) && eventYear(i.start_at) === year,
        )
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
      {
        type: string;
        label: string;
        presentes: number;
        ausentes: number;
        pendentes: number;
        total: number;
      }
    >();
    const byMonth = new Map<
      string,
      { key: string; label: string; presentes: number; total: number }
    >();

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
        byMonth.set(mk, {
          key: mk,
          label: MONTH_SHORT[m - 1] ?? mk,
          presentes: 0,
          total: 0,
        });
      }
      const monthRow = mk ? byMonth.get(mk)! : null;

      for (const mem of eligibleMembers) {
        const st = cellStatus(mem, ev, recordByKey);
        if (st === "na") continue;
        // Sem marcação = indefinido: não é presença nem falta, fica fora da taxa.
        if (st === "pendente") {
          pendentes += 1;
          typeRow.pendentes += 1;
          continue;
        }
        typeRow.total += 1;
        if (monthRow) monthRow.total += 1;
        if (st === "presente") {
          presentes += 1;
          typeRow.presentes += 1;
          if (monthRow) monthRow.presentes += 1;
        } else {
          ausentes += 1;
          typeRow.ausentes += 1;
          const rec = recordByKey.get(`${mem.id}:${ev.id}`);
          if (rec?.justification) justified += 1;
        }
      }
    }

    const byTypeRows = [...byType.values()]
      .filter((r) => r.total + r.pendentes > 0)
      .map((r) => ({
        ...r,
        pct: r.total > 0 ? Math.round((r.presentes / r.total) * 100) : 0,
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
    const marked = presentes + ausentes;
    const overallPct =
      marked > 0 ? Math.round((presentes / marked) * 100) : null;

    const memberFreq = eligibleMembers
      .map((m) => {
        let totalM = 0;
        let presentM = 0;
        for (const ev of yearItems) {
          const st = cellStatus(m, ev, recordByKey);
          if (st === "na" || st === "pendente") continue;
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
      .sort(
        (a, b) =>
          (b.pct ?? -1) - (a.pct ?? -1) ||
          a.name.localeCompare(b.name, "pt-BR"),
      );

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
      bottom: memberFreq.slice(-5).reverse(),
    };
  }, [yearItems, eligibleMembers, recordByKey]);

  const pieData = [
    {
      key: "presentes",
      name: "Presentes",
      value: stats.presentes,
      fill: "#047857",
    },
    {
      key: "ausentes",
      name: "Ausentes",
      value: stats.ausentes,
      fill: "#B91C1C",
    },
    {
      key: "pendentes",
      name: "Indefinidos",
      value: stats.pendentes,
      fill: "#D97706",
    },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
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
        <p className="text-xs text-muted-foreground">
          Somente sessões e filantropias obrigatórias · {stats.events} chamada
          {stats.events === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Taxa de presença"
          value={stats.overallPct === null ? "—" : `${stats.overallPct}%`}
        />
        <Kpi
          label="Presentes"
          value={String(stats.presentes)}
          accent="#047857"
        />
        <Kpi label="Ausentes" value={String(stats.ausentes)} accent="#B91C1C" />
        <Kpi
          label="Justificadas"
          value={String(stats.justified)}
          hint={`${stats.pendentes} sem marcação (indefinido${stats.pendentes === 1 ? "" : "s"})`}
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
                Presentes, ausentes e indefinidos (sem marcação) por tipo
              </p>
              <ChartContainer
                config={byTypeConfig}
                className="aspect-[4/3] w-full"
              >
                <BarChart
                  data={stats.byTypeRows}
                  layout="vertical"
                  margin={{ left: 8, right: 12 }}
                >
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
                  <Bar
                    dataKey="presentes"
                    stackId="a"
                    fill="var(--color-presentes)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="ausentes"
                    stackId="a"
                    fill="var(--color-ausentes)"
                  />
                  <Bar
                    dataKey="pendentes"
                    stackId="a"
                    fill="var(--color-pendentes)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </Card>

            <Card className="rounded-[12px] p-4">
              <h3 className="mb-1 text-sm font-medium">Distribuição geral</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Total de marcações elegíveis em {year}
              </p>
              <ChartContainer
                config={pieConfig}
                className="mx-auto aspect-square max-h-[240px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="name" hideLabel />}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={96}
                    strokeWidth={2}
                    labelLine={false}
                    label={({
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      value,
                      percent,
                    }) => {
                      if (
                        value == null ||
                        value <= 0 ||
                        !percent ||
                        percent < 0.08 ||
                        cx == null ||
                        cy == null ||
                        midAngle == null ||
                        innerRadius == null ||
                        outerRadius == null
                      ) {
                        return null;
                      }
                      const RADIAN = Math.PI / 180;
                      const radius =
                        innerRadius + (outerRadius - innerRadius) * 0.52;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const label = Number(value).toLocaleString("pt-BR");
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#FFFFFF"
                          stroke="rgba(0,0,0,0.45)"
                          strokeWidth={3}
                          paintOrder="stroke"
                          style={{
                            pointerEvents: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {label}
                        </text>
                      );
                    }}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
                {pieData.map((d) => (
                  <li key={d.key} className="min-w-0">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: d.fill }}
                        aria-hidden
                      />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums">
                      {d.value.toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="rounded-[12px] p-4">
            <h3 className="mb-1 text-sm font-medium">
              Taxa mensal de presença
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              % de presentes entre as marcações (P + A) de cada mês
            </p>
            {stats.byMonthRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem dados mensais.
              </p>
            ) : (
              <ChartContainer
                config={rateConfig}
                className="aspect-[21/9] w-full min-h-[200px]"
              >
                <BarChart
                  data={stats.byMonthRows}
                  margin={{ left: 0, right: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(value) => `${value}%`} />
                    }
                  />
                  <Bar
                    dataKey="pct"
                    fill="var(--color-pct)"
                    radius={[4, 4, 0, 0]}
                  />
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
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <Link
                      to="/membros/$id"
                      params={{ id: m.id }}
                      className="min-w-0 truncate text-sm font-medium"
                    >
                      {m.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.present}/{m.total} ·{" "}
                      <span className="font-semibold text-emerald-700">
                        {m.pct}%
                      </span>
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
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <Link
                      to="/membros/$id"
                      params={{ id: m.id }}
                      className="min-w-0 truncate text-sm font-medium"
                    >
                      {m.name}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {m.present}/{m.total} ·{" "}
                      <span className="font-semibold text-rose-700">
                        {m.pct}%
                      </span>
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
      <div
        className="mt-1 text-2xl font-semibold tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </Card>
  );
}

/* ─── Visão geral (matriz) ─────────────────────────────────── */

