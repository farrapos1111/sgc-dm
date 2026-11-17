import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listEvents } from "@/lib/events.functions";
import { APP_TIMEZONE } from "@/lib/timezone";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  matchesTermSearch,
  termFromDate,
  termOptions,
  type Term,
} from "@/lib/terms";
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

function gestaoShort(term: Term) {
  return `${term.year}/${term.semester}`;
}

type ActiveChapter = NonNullable<ReturnType<typeof useActiveChapter>["active"]>;

// Hooks só no filho: o capítulo ativo pode estar nulo no primeiro render.
function EventosList() {
  const { active } = useActiveChapter();
  if (!active) return null;
  return <EventosListContent key={active.chapter_id} active={active} />;
}

function EventosListContent({ active }: { active: ActiveChapter }) {
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
    const fromTerms = new Set(
      termOptions({ foundedAt: founded, fallbackSpan: 6 }).map((t) => t.year),
    );
    for (const e of events) {
      const t = termOfEvent(e.starts_at);
      if (t) fromTerms.add(t.year);
    }
    return [...fromTerms].sort((a, b) => b - a);
  }, [active.chapter, events]);

  const filtered = useMemo(() => {
    const q = search.trim();
    let rows = events.filter((e) => {
      const display = eventDisplayStatus(
        e.starts_at,
        e.status,
        new Date(),
        e.finance_open_until,
      );
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
        matchesLooseSearch(formatDateTimeBR(e.starts_at), q) ||
        (term ? matchesTermSearch(term, q) : false)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sortKey === "nome") {
        return a.name.localeCompare(b.name, "pt-BR") * dir;
      }
      if (sortKey === "status") {
        const sa = eventDisplayStatus(
          a.starts_at,
          a.status,
          new Date(),
          a.finance_open_until,
        );
        const sb = eventDisplayStatus(
          b.starts_at,
          b.status,
          new Date(),
          b.finance_open_until,
        );
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

  const summary = useMemo(() => {
    const raised = filtered.reduce((acc, e) => acc + (Number(e.raised) || 0), 0);
    const tickets = filtered.reduce((acc, e) => acc + (Number(e.tickets_sold) || 0), 0);
    const now = Date.now();
    const next = [...events]
      .filter((e) => new Date(e.starts_at).getTime() >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return { raised, tickets, next };
  }, [filtered, events]);
  const periodLabel =
    yearFilter === "all"
      ? "em todos os anos"
      : semesterFilter === "all"
        ? `em ${yearFilter}`
        : `no ${semesterFilter}º semestre de ${yearFilter}`;

  return (
    <div>
      <PageHeader
        title="Eventos"
        subtitle={`${filtered.length} de ${events.length} ${events.length === 1 ? "evento" : "eventos"}`}
        actions={
          <Button asChild>
            <Link to="/eventos/novo">
              <PlusCircle className="h-[18px] w-[18px]" />
              <span className="md:hidden">Novo</span>
              <span className="hidden md:inline">Novo evento</span>
            </Link>
          </Button>
        }
      />

      {events.length > 0 ? (
        <>
          {/* Celular: total arrecadado */}
          <section className="mb-3 rounded-[22px] bg-tv-primary p-5 text-white md:hidden">
            <span className="block text-[13px] font-semibold text-white/80">Arrecadado {periodLabel}</span>
            <span className="mt-1 block font-display text-[30px] font-extrabold leading-tight tabular-nums">
              {formatBRL(summary.raised)}
            </span>
            <span className="mt-1 block text-[13px] text-white/80">
              {filtered.length} {filtered.length === 1 ? "evento" : "eventos"} · {summary.tickets}{" "}
              {summary.tickets === 1 ? "ingresso vendido" : "ingressos vendidos"}
            </span>
          </section>
          {/* Computador: três indicadores */}
          <div className="mb-4 hidden gap-3 md:grid md:grid-cols-3">
            <Card className="p-5">
              <span className="block text-sm text-tv-text-2">Arrecadado {periodLabel}</span>
              <span className="mt-1 block font-display text-[26px] font-extrabold tabular-nums">
                {formatBRL(summary.raised)}
              </span>
            </Card>
            <Card className="p-5">
              <span className="block text-sm text-tv-text-2">Ingressos vendidos</span>
              <span className="mt-1 block font-display text-[26px] font-extrabold tabular-nums">
                {summary.tickets}
              </span>
            </Card>
            <Card className="p-5">
              <span className="block text-sm text-tv-text-2">Próximo evento</span>
              {summary.next ? (
                <Link
                  to="/eventos/$id"
                  params={{ id: summary.next.id }}
                  className="mt-1 block truncate text-lg font-bold hover:underline"
                >
                  {summary.next.name}
                  <span className="block text-sm font-normal text-tv-text-2">
                    {formatDateTimeBR(summary.next.starts_at)}
                  </span>
                </Link>
              ) : (
                <span className="mt-1 block text-lg font-bold text-tv-text-2">Nenhum marcado</span>
              )}
            </Card>
          </div>
          {!summary.next ? (
            <Link
              to="/eventos/novo"
              className="mb-4 flex min-h-16 items-center gap-3 rounded-[20px] border border-dashed border-[#CFCFCA] bg-tv-surface px-4 py-3 md:hidden dark:border-tv-border"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tv-soft text-tv-primary">
                <PlusCircle className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-bold">Nenhum evento aberto</span>
                <span className="block text-[13px] text-tv-text-2">Crie o próximo para vender ingressos</span>
              </span>
            </Link>
          ) : null}
        </>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-7 w-7" />}
          title="Nenhum evento ainda"
          description="Crie o primeiro evento do seu capítulo."
          action={
            <Button asChild>
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
                placeholder="Buscar por nome, local, status ou gestão…"
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
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
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
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
              <Link
                to="/eventos/novo"
                className="hidden min-h-[120px] items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-[#CFCFCA] text-[15px] font-semibold text-tv-text-2 hover:bg-tv-surface md:flex dark:border-tv-border"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-tv-soft text-tv-primary">
                  <PlusCircle className="h-5 w-5" aria-hidden />
                </span>
                Criar o próximo evento
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event: e }: { event: EventRow }) {
  const raised = Number(e.raised) || 0;
  const goal = Number(e.goal_amount) || 0;
  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
  const display = eventDisplayStatus(
    e.starts_at,
    e.status,
    new Date(),
    e.finance_open_until,
  );
  const label = EVENT_DISPLAY_STATUS_LABELS[display];
  const term = termOfEvent(e.starts_at);

  const start = new Date(e.starts_at);
  const day = start.toLocaleDateString("pt-BR", { day: "2-digit", timeZone: APP_TIMEZONE });
  const mon = start
    .toLocaleDateString("pt-BR", { month: "short", timeZone: APP_TIMEZONE })
    .replace(".", "");
  const closed = display === "fechado";
  return (
    <Link to="/eventos/$id" params={{ id: e.id }} className="block">
      <Card className="flex gap-4 p-4 transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)] md:p-5">
        <span className="flex w-14 shrink-0 flex-col items-center gap-2">
          <span className="flex w-14 flex-col items-center rounded-[14px] bg-tv-soft py-2 text-tv-ink">
            <span className="font-display text-[22px] font-extrabold leading-none">{day}</span>
            <span className="mt-0.5 text-xs font-bold uppercase">{mon}</span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block break-words text-base font-bold leading-snug">{e.name}</span>
              <span className="block text-[13px] text-tv-text-2">
                {formatDateTimeBR(e.starts_at)}
                {term ? ` · Gestão ${gestaoShort(term)}` : ""}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold first-letter:uppercase ${
                closed ? "bg-tv-line text-[#3F4249] dark:text-tv-text-2" : "bg-tv-in-bg text-tv-in"
              }`}
            >
              {label}
            </span>
          </span>
          <span className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-[17px] font-bold tabular-nums">{formatBRL(raised)}</span>
            {goal > 0 ? <span className="text-[13px] text-tv-text-2">meta {formatBRL(goal)}</span> : null}
          </span>
          {goal > 0 ? (
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-tv-line" aria-hidden>
              <span className="block h-full rounded-full bg-tv-primary" style={{ width: `${pct}%` }} />
            </span>
          ) : null}
          <span className="mt-1.5 flex justify-between text-[13px] text-tv-text-2">
            <span>{goal > 0 ? `${((raised / goal) * 100).toFixed(0)}% da meta` : "Sem meta"}</span>
            <span>
              {e.tickets_sold} {e.tickets_sold === 1 ? "ingresso" : "ingressos"}
            </span>
          </span>
        </span>
      </Card>
    </Link>
  );
}
