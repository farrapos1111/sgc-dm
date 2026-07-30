import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listAttendanceOverview } from "@/lib/attendance.functions";
import { attendanceOverviewKey } from "@/lib/query-keys";
import { TYPE_META, CALENDAR_TYPES, type CalendarType } from "@/lib/calendar-types";
import { canManageAttendance } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";
import {
  memberEligibleForAttendance,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { chapterFoundedAt } from "@/lib/terms";
import { ClipboardList } from "lucide-react";
import {
  PresencasChartsTab,
  PresencasOverviewTab,
} from "@/components/presencas/PresencasAnalytics";

export const Route = createFileRoute("/_authenticated/_shell/presencas")({
  head: () => ({
    meta: [
      { title: "Presenças e frequência — SG-CDM" },
      {
        name: "description",
        content: "Controle de presenças, ausências, justificativas e frequência dos membros.",
      },
    ],
  }),
  component: PresencasPage,
});

const overviewQO = (chapterId: string) =>
  queryOptions({
    queryKey: attendanceOverviewKey(chapterId),
    queryFn: () => listAttendanceOverview({ data: { chapterId } }),
  });

function eventYear(startAt: string): number | null {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

type FrequencyRange =
  | { kind: "year"; year: number }
  | { kind: "months"; months: 3 | 6 | 12 };

type PresencasFilters = {
  year: number;
  typeFilter: string;
  mandFilter: "all" | "obrigatorio" | "facultativo";
  dateSort: "desc" | "asc";
  tab: "itens" | "frequencia" | "graficos" | "visao";
  freq: string;
};

function defaultPresencasFilters(): PresencasFilters {
  const year = new Date().getFullYear();
  return {
    year,
    typeFilter: "all",
    mandFilter: "all",
    dateSort: "desc",
    tab: "itens",
    freq: String(year),
  };
}

const MAND_VALUES = new Set(["all", "obrigatorio", "facultativo"]);
const SORT_VALUES = new Set(["desc", "asc"]);
const TAB_VALUES = new Set(["itens", "frequencia", "graficos", "visao"]);

function filtersKey(chapterId: string) {
  return `sgcdm:presencas-filters:${chapterId}`;
}

function loadFilters(chapterId: string): PresencasFilters {
  const defaults = defaultPresencasFilters();
  try {
    const raw = sessionStorage.getItem(filtersKey(chapterId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PresencasFilters>;
    const year =
      typeof parsed.year === "number" && Number.isFinite(parsed.year)
        ? parsed.year
        : defaults.year;
    const typeFilter =
      typeof parsed.typeFilter === "string" &&
      (parsed.typeFilter === "all" ||
        (CALENDAR_TYPES as readonly string[]).includes(parsed.typeFilter))
        ? parsed.typeFilter
        : "all";
    return {
      year,
      typeFilter,
      mandFilter: MAND_VALUES.has(parsed.mandFilter ?? "")
        ? (parsed.mandFilter as PresencasFilters["mandFilter"])
        : "all",
      dateSort: SORT_VALUES.has(parsed.dateSort ?? "")
        ? (parsed.dateSort as PresencasFilters["dateSort"])
        : "desc",
      tab: TAB_VALUES.has(parsed.tab ?? "")
        ? (parsed.tab as PresencasFilters["tab"])
        : "itens",
      freq: typeof parsed.freq === "string" ? parsed.freq : String(year),
    };
  } catch {
    return defaults;
  }
}

function saveFilters(chapterId: string, filters: PresencasFilters) {
  try {
    sessionStorage.setItem(filtersKey(chapterId), JSON.stringify(filters));
  } catch {
    /* ignore quota / private mode */
  }
}

function parseFrequencyRange(value: string): FrequencyRange {
  if (value.startsWith("m:")) {
    const months = Number(value.slice(2)) as 3 | 6 | 12;
    return { kind: "months", months };
  }
  return { kind: "year", year: Number(value) };
}

function periodStart(months: number, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setMonth(d.getMonth() - months);
  return d;
}

function PresencasFrequencyTab({
  items,
  members,
  records,
  availableYears,
  freq,
  onFreqChange,
}: {
  items: any[];
  members: any[];
  records: any[];
  availableYears: number[];
  freq: string;
  onFreqChange: (freq: string) => void;
}) {
  const frequency = useMemo(() => {
    const range = parseFrequencyRange(freq);
    const mandatoryItems = items.filter((i) => {
      if (!i.mandatory) return false;
      const start = new Date(i.start_at);
      if (Number.isNaN(start.getTime())) return false;
      if (range.kind === "year") return start.getFullYear() === range.year;
      return start >= periodStart(range.months);
    });
    const recordByKey = new Map<string, string>();
    for (const r of records) {
      recordByKey.set(`${r.member_id}:${r.calendar_event_id}`, r.status);
    }

    return (members as DueMemberLite[])
      .filter((m) => m.status === "regular" && (m.kind === "demolay_ativo" || m.kind === "senior"))
      .map((m) => {
        let total = 0;
        let present = 0;
        for (const ev of mandatoryItems) {
          if (!memberEligibleForAttendance(m, ev.start_at)) continue;
          total += 1;
          if (recordByKey.get(`${m.id}:${ev.id}`) === "presente") present += 1;
        }
        return {
          ...m,
          total,
          present,
          pct: total > 0 ? Math.round((present / total) * 100) : null,
        };
      })
      .filter((m) => m.total > 0)
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [items, members, records, freq]);

  const range = parseFrequencyRange(freq);
  const rangeLabel =
    range.kind === "year" ? String(range.year) : `últimos ${range.months} meses`;

  return (
    <>
      <div className="mb-3">
        <Select value={freq} onValueChange={onFreqChange}>
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                Ano {y}
              </SelectItem>
            ))}
            <SelectItem value="m:12">Últimos 12 meses</SelectItem>
            <SelectItem value="m:6">Últimos 6 meses</SelectItem>
            <SelectItem value="m:3">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="rounded-[12px] p-0">
        <ul className="divide-y divide-border">
          {frequency.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">
              Nenhum membro elegível nos eventos obrigatórios ({rangeLabel}).
            </li>
          )}
          {frequency.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-4">
              <Link
                to="/membros/$id"
                params={{ id: m.id }}
                className="min-w-0 truncate text-sm font-medium"
              >
                {m.full_name}
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {m.present}/{m.total} obrigatórios
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      m.pct === null ? "var(--muted-foreground)" : m.pct >= 75 ? "#047857" : "#B91C1C",
                  }}
                >
                  {m.pct === null ? "—" : `${m.pct}%`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Frequência ({rangeLabel}): apenas itens obrigatórios em que o membro era elegível
        (após a iniciação e até virar Senior no aniversário de 21 anos).
      </p>
    </>
  );
}

function PresencasPage() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id ?? "";
  const { data } = useSuspenseQuery(overviewQO(chapterId));
  const now = new Date();
  const [filters, setFilters] = useState<PresencasFilters>(() =>
    chapterId ? loadFilters(chapterId) : defaultPresencasFilters(),
  );

  useEffect(() => {
    if (!chapterId) return;
    setFilters(loadFilters(chapterId));
  }, [chapterId]);

  useEffect(() => {
    if (!chapterId) return;
    saveFilters(chapterId, filters);
  }, [chapterId, filters]);

  const { year, typeFilter, mandFilter, dateSort, tab, freq } = filters;

  const allowed = canManageAttendance(active?.role.name);

  const availableYears = useMemo(() => {
    const founded = chapterFoundedAt(active?.chapter);
    const start = founded ? Number(founded.slice(0, 4)) : now.getFullYear() - 2;
    const years: number[] = [];
    for (let y = now.getFullYear() + 1; y >= start; y--) years.push(y);
    return years;
  }, [active?.chapter]);

  const items = useMemo(
    () =>
      (data.items as any[])
        .filter((it) => {
          if (eventYear(it.start_at) !== year) return false;
          if (typeFilter !== "all" && it.event_type !== typeFilter) return false;
          if (mandFilter === "obrigatorio" && !it.mandatory) return false;
          if (mandFilter === "facultativo" && it.mandatory) return false;
          return true;
        })
        .sort((a, b) => {
          const ta = new Date(a.start_at).getTime();
          const tb = new Date(b.start_at).getTime();
          return dateSort === "asc" ? ta - tb : tb - ta;
        }),
    [data.items, year, typeFilter, mandFilter, dateSort],
  );

  const byEvent = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of data.records as any[]) {
      const arr = m.get(r.calendar_event_id) ?? [];
      arr.push(r);
      m.set(r.calendar_event_id, arr);
    }
    return m;
  }, [data.records]);

  if (!allowed) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Módulo disponível apenas para administradores e Escrivão.
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Presenças"
        subtitle="Histórico de chamadas, justificativas e frequência do capítulo."
      />

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setFilters((f) => ({ ...f, tab: v as PresencasFilters["tab"] }))
        }
      >
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="itens">Chamadas</TabsTrigger>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          <div className="mb-4 flex flex-wrap gap-2">
            <Select
              value={String(year)}
              onValueChange={(v) => setFilters((f) => ({ ...f, year: Number(v) }))}
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
              value={typeFilter}
              onValueChange={(v) => setFilters((f) => ({ ...f, typeFilter: v }))}
            >
              <SelectTrigger className="h-9 w-[190px] text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {CALENDAR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mandFilter}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  mandFilter: v as PresencasFilters["mandFilter"],
                }))
              }
            >
              <SelectTrigger className="h-9 w-[190px] text-xs">
                <SelectValue placeholder="Obrigatoriedade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Obrigatórios e facultativos</SelectItem>
                <SelectItem value="obrigatorio">Somente obrigatórios</SelectItem>
                <SelectItem value="facultativo">Somente facultativos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={dateSort}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  dateSort: v as PresencasFilters["dateSort"],
                }))
              }
            >
              <SelectTrigger className="h-9 w-[200px] text-xs">
                <SelectValue placeholder="Ordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Mais recente → antigo</SelectItem>
                <SelectItem value="asc">Mais antigo → atual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {items.length === 0 ? (
            <Card className="rounded-[12px] p-10 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <div className="text-sm font-medium">Nenhuma chamada em {year}.</div>
            </Card>
          ) : (
            <Card className="rounded-[12px] p-0">
              <ul className="divide-y divide-border">
                {items.map((it) => {
                  const recs = byEvent.get(it.id) ?? [];
                  const p = recs.filter((r) => r.status === "presente").length;
                  const a = recs.filter((r) => r.status === "ausente").length;
                  const j = recs.filter((r) => r.justification).length;
                  const meta = TYPE_META[it.event_type as CalendarType];
                  return (
                    <li key={it.id}>
                      <Link
                        to="/ongoing/$id"
                        params={{ id: it.id }}
                        className="block p-4 hover:bg-muted"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium">{it.title}</span>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: meta?.bg, color: meta?.color }}
                            >
                              {meta?.label ?? it.event_type}
                            </span>
                            <Badge variant={it.mandatory ? "default" : "secondary"}>
                              {it.mandatory ? "Obrigatório" : "Facultativo"}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDateTimeBR(it.start_at)} · {p} presentes · {a} ausentes · {j} justificativas
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="frequencia">
          {tab === "frequencia" && (
            <PresencasFrequencyTab
              items={data.items as any[]}
              members={data.members as any[]}
              records={data.records as any[]}
              availableYears={availableYears}
              freq={freq}
              onFreqChange={(next) => setFilters((f) => ({ ...f, freq: next }))}
            />
          )}
        </TabsContent>

        <TabsContent value="visao">
          {tab === "visao" && (
            <PresencasOverviewTab
              items={data.items as any[]}
              members={data.members as any[]}
              records={data.records as any[]}
              year={year}
              availableYears={availableYears}
              onYearChange={(y) => setFilters((f) => ({ ...f, year: y }))}
              chapterId={chapterId}
            />
          )}
        </TabsContent>

        <TabsContent value="graficos">
          {tab === "graficos" && (
            <PresencasChartsTab
              items={data.items as any[]}
              members={data.members as any[]}
              records={data.records as any[]}
              year={year}
              availableYears={availableYears}
              onYearChange={(y) => setFilters((f) => ({ ...f, year: y }))}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
