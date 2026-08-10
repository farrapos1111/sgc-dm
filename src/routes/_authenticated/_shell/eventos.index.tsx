import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listEvents } from "@/lib/events.functions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  PlusCircle,
  Search,
  X,
} from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { matchesLooseSearch } from "@/lib/utils";
import {
  chapterFoundedAt,
  currentTerm,
  termFromDate,
  termOptions,
} from "@/lib/terms";
import { datePartsInAppTz } from "@/lib/timezone";
import {
  EVENT_DISPLAY_STATUS_LABELS,
  eventDisplayStatus,
  eventStartYmd,
  type EventDisplayStatus,
} from "@/lib/event-lifecycle";

export const Route = createFileRoute("/_authenticated/_shell/eventos/")({
  head: () => ({ meta: [{ title: "Eventos — Templo Virtual" }] }),
  component: EventosList,
});

const eventsQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["events", chapterId],
    queryFn: () => listEvents({ data: { chapterId } }),
  });

type EventRow = Awaited<ReturnType<typeof listEvents>>[number];
type SortKey = "data" | "nome" | "status" | "arrecadacao";

function termOfEvent(startsAt: string) {
  return termFromDate(eventStartYmd(startsAt));
}

function EventosList() {
  const { active } = useActiveChapter();
  if (!active) return null;
  const { data: events } = useSuspenseQuery(eventsQO(active.chapter_id));

  const cur = currentTerm();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(String(cur.year));
  const [semesterFilter, setSemesterFilter] = useState(String(cur.semester));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const years = useMemo(() => {
    const founded = chapterFoundedAt(active.chapter);
    const base = termOptions({ foundedAt: founded, fallbackSpan: 6 });
    const fromTerms = new Set(base.map((t) => t.year));
    for (const e of events) {
      const parts = datePartsInAppTz(e.starts_at);
      if (Number.isFinite(parts.year)) fromTerms.add(parts.year);
    }
    return [...fromTerms].sort((a, b) => b - a);
  }, [active.chapter, events]);

  const filtered = useMemo(() => {
    const q = search.trim();
    let rows = events.filter((e) => {
      const display = eventDisplayStatus(e.starts_at, e.status);
      if (statusFilter !== "all" && display !== statusFilter) return false;

      const term = termOfEvent(e.starts_at);
      if (yearFilter !== "all") {
        if (!term || String(term.year) !== yearFilter) return false;
      }
      if (semesterFilter !== "all") {
        if (!term || String(term.semester) !== semesterFilter) return false;
      }

      if (!q) return true;
      const statusLabel = EVENT_DISPLAY_STATUS_LABELS[display];
      return (
        matchesLooseSearch(e.name, q) ||
        matchesLooseSearch(e.location ?? "", q) ||
        matchesLooseSearch(e.description ?? "", q) ||
        matchesLooseSearch(statusLabel, q) ||
        matchesLooseSearch(formatDateTimeBR(e.starts_at), q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sortKey === "nome") {
        return a.name.localeCompare(b.name, "pt-BR") * dir;
      }
      if (sortKey === "status") {
        const sa = eventDisplayStatus(a.starts_at, a.status);
        const sb = eventDisplayStatus(b.starts_at, b.status);
        return (
          EVENT_DISPLAY_STATUS_LABELS[sa].localeCompare(
            EVENT_DISPLAY_STATUS_LABELS[sb],
            "pt-BR",
          ) * dir
        );
      }
      if (sortKey === "arrecadacao") {
        return (Number(a.raised) - Number(b.raised)) * dir;
      }
      // data
      return (
        (new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()) *
        dir
      );
    });
    return rows;
  }, [
    events,
    search,
    yearFilter,
    semesterFilter,
    statusFilter,
    sortKey,
    sortDir,
  ]);

  return (
    <div>
      <PageHeader
        title="Eventos"
        subtitle={`${filtered.length} de ${events.length} ${events.length === 1 ? "evento" : "eventos"}`}
        actions={
          <Button
            asChild
            style={{ backgroundColor: active.chapter.primary_color }}
          >
            <Link to="/eventos/novo">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo evento
            </Link>
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-7 w-7" />}
          title="Nenhum evento ainda"
          description="Crie o primeiro evento do seu capítulo."
          action={
            <Button
              asChild
              style={{ backgroundColor: active.chapter.primary_color }}
            >
              <Link to="/eventos/novo">
                <PlusCircle className="mr-2 h-4 w-4" /> Criar evento
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-3 space-y-2">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, local ou status…"
                className="h-10 pl-9 pr-9"
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-10 w-full" aria-label="Ano">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="h-10 w-full" aria-label="Semestre">
                  <SelectValue placeholder="Semestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="1">1º semestre</SelectItem>
                  <SelectItem value="2">2º semestre</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full" aria-label="Status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {(
                    Object.keys(
                      EVENT_DISPLAY_STATUS_LABELS,
                    ) as EventDisplayStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {EVENT_DISPLAY_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger className="h-10 w-full" aria-label="Ordenar por">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="arrecadacao">Arrecadação</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                aria-label={
                  sortDir === "asc" ? "Ordem crescente" : "Ordem decrescente"
                }
                onClick={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
              >
                {sortDir === "asc" ? (
                  <ArrowUpAZ className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowDownAZ className="mr-2 h-4 w-4" />
                )}
                {sortDir === "asc" ? "Crescente" : "Decrescente"}
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-7 w-7" />}
              title="Nenhum evento encontrado"
              description="Ajuste a busca ou os filtros para ver outros eventos."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event: e }: { event: EventRow }) {
  const pct =
    e.goal_amount > 0
      ? Math.min(100, (Number(e.raised) / Number(e.goal_amount)) * 100)
      : 0;
  const display = eventDisplayStatus(e.starts_at, e.status);
  const label = EVENT_DISPLAY_STATUS_LABELS[display];

  return (
    <Link to="/eventos/$id" params={{ id: e.id }}>
      <Card className="rounded-[12px] p-5 transition-colors hover:bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="break-words font-semibold leading-snug">
              {e.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTimeBR(e.starts_at)}
            </div>
          </div>
          <Badge
            variant={display === "fechado" ? "outline" : "secondary"}
            className="shrink-0 capitalize"
          >
            {label}
          </Badge>
        </div>
        {e.goal_amount > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatBRL(Number(e.raised))}</span>
              <span>Meta: {formatBRL(Number(e.goal_amount))}</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          {e.tickets_sold}{" "}
          {e.tickets_sold === 1 ? "ingresso vendido" : "ingressos vendidos"}
        </div>
      </Card>
    </Link>
  );
}
