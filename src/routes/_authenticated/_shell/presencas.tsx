import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ClipboardList } from "lucide-react";

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

function PresencasFrequencyTab({
  items,
  members,
  records,
}: {
  items: any[];
  members: any[];
  records: any[];
}) {
  const frequency = useMemo(() => {
    const mandatoryIds = new Set(items.filter((i) => i.mandatory).map((i) => i.id));
    const tallies = new Map<string, { total: number; present: number }>();

    for (const r of records) {
      if (!mandatoryIds.has(r.calendar_event_id)) continue;
      const t = tallies.get(r.member_id) ?? { total: 0, present: 0 };
      t.total += 1;
      if (r.status === "presente") t.present += 1;
      tallies.set(r.member_id, t);
    }

    return members
      .filter((m) => m.status === "ativo")
      .map((m) => {
        const t = tallies.get(m.id) ?? { total: 0, present: 0 };
        return {
          ...m,
          total: t.total,
          present: t.present,
          pct: t.total > 0 ? Math.round((t.present / t.total) * 100) : null,
        };
      });
  }, [items, members, records]);

  return (
    <>
      <Card className="rounded-[12px] p-0">
        <ul className="divide-y divide-border">
          {frequency.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">Nenhum membro ativo.</li>
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
        A frequência considera apenas itens marcados como obrigatórios.
      </p>
    </>
  );
}

function PresencasPage() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id ?? "";
  const { data } = useSuspenseQuery(overviewQO(chapterId));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [mandFilter, setMandFilter] = useState<string>("all");
  const [tab, setTab] = useState("itens");

  const allowed = canManageAttendance(active?.role.name);

  const items = useMemo(
    () =>
      (data.items as any[]).filter((it) => {
        if (typeFilter !== "all" && it.event_type !== typeFilter) return false;
        if (mandFilter === "obrigatorio" && !it.mandatory) return false;
        if (mandFilter === "facultativo" && it.mandatory) return false;
        return true;
      }),
    [data.items, typeFilter, mandFilter],
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

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
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
        <Select value={mandFilter} onValueChange={setMandFilter}>
          <SelectTrigger className="h-9 w-[190px] text-xs">
            <SelectValue placeholder="Obrigatoriedade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Obrigatórios e facultativos</SelectItem>
            <SelectItem value="obrigatorio">Somente obrigatórios</SelectItem>
            <SelectItem value="facultativo">Somente facultativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="itens">Chamadas</TabsTrigger>
          <TabsTrigger value="frequencia">Frequência</TabsTrigger>
        </TabsList>

        <TabsContent value="itens">
          {items.length === 0 ? (
            <Card className="rounded-[12px] p-10 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <div className="text-sm font-medium">Nenhuma chamada registrada ainda.</div>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{it.title}</span>
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
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
