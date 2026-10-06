import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AgendaView,
  MandatoryDatesBanner,
  MonthView,
  eventIntersectsSearchRange,
  occursOnDay,
  yearBoundsIso,
  type CalendarItem,
} from "@/routes/_authenticated/_shell/calendario";
import {
  CALENDAR_TYPES,
  parseCalendarTypeLabels,
  resolveTypeMeta,
  type CalendarType,
} from "@/lib/calendar-types";
import { getPublicCalendar } from "@/lib/public-conference.functions";
import {
  formatPrazoLabel,
  mandatoryDateAppliesToMonth,
  sortMandatoryDatesChronological,
} from "@/lib/org-mandatory-dates.functions";
import { formatDateTimeBR } from "@/lib/format";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/ics";
import { matchesLooseSearch } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export const Route = createFileRoute("/$org/calendario")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Calendário — Templo Virtual" }],
  }),
  component: PublicCalendarPage,
});

function toBoardItem(item: {
  id: string;
  title: string;
  event_type: CalendarType;
  mandatory: boolean;
  public_open: boolean;
  start_at: string;
  end_at: string | null;
  location: string | null;
  address: string | null;
  dress_code: string | null;
  description: string | null;
  custom_category_id: string | null;
  org_mandatory_date_id: string | null;
}): CalendarItem {
  return {
    ...item,
    chapter_id: "",
    lodge_id: null,
    related_event_id: null,
    created_by: null,
    created_at: item.start_at,
  };
}

function PublicCalendarPage() {
  const { token } = usePublicLobby();
  const isMobile = useIsMobile();
  const [view, setView] = useState<"mes" | "agenda">(isMobile ? "agenda" : "mes");
  const [typeFilters, setTypeFilters] = useState<Set<CalendarType>>(
    () => new Set(CALENDAR_TYPES),
  );
  const [customCatFilters, setCustomCatFilters] = useState<Set<string> | null>(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState<string | null>(null);
  const [searchTo, setSearchTo] = useState<string | null>(null);

  const queryRange = useMemo(() => {
    const y = cursor.getFullYear();
    return {
      from: yearBoundsIso(y - 1).from,
      to: yearBoundsIso(y + 1).to,
    };
  }, [cursor]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-calendar", token, queryRange.from, queryRange.to],
    queryFn: () =>
      getPublicCalendar({
        data: { token, from: queryRange.from, to: queryRange.to },
      }),
    enabled: Boolean(token),
    retry: false,
  });

  const typeLabels = useMemo(
    () =>
      parseCalendarTypeLabels({
        calendar_type_labels: data?.chapter.calendar_type_labels ?? {},
      }),
    [data?.chapter.calendar_type_labels],
  );
  const categories = data?.categories ?? [];
  const customCatIdsKey = categories.map((c) => c.id).join(",");

  useEffect(() => {
    setCustomCatFilters(new Set(categories.map((c) => c.id)));
  }, [customCatIdsKey]);

  const items = useMemo(
    () => (data?.items ?? []).map(toBoardItem),
    [data?.items],
  );

  const mandatoryDatesForCursor = useMemo(() => {
    const month = cursor.getMonth() + 1;
    const year = cursor.getFullYear();
    return sortMandatoryDatesChronological(
      (data?.mandatory_dates ?? [])
        .filter((row) => mandatoryDateAppliesToMonth(row, year, month))
        .map((row) => ({
          ...row,
          prazo_label: formatPrazoLabel(row),
        })),
    );
  }, [data?.mandatory_dates, cursor]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    const catById = new Map(categories.map((c) => [c.id, c.name]));
    return items.filter((it) => {
      if (!typeFilters.has(it.event_type)) return false;
      if (it.custom_category_id && customCatFilters && !customCatFilters.has(it.custom_category_id)) {
        return false;
      }
      if (!q) return true;
      const typeLabel = resolveTypeMeta(it.event_type, typeLabels).label;
      const catName = it.custom_category_id
        ? (catById.get(it.custom_category_id) ?? "")
        : "";
      const hay = [
        it.title,
        it.description ?? "",
        it.location ?? "",
        it.address ?? "",
        typeLabel,
        catName,
      ].join(" ");
      if (!matchesLooseSearch(hay, q)) return false;
      return eventIntersectsSearchRange(it, searchFrom, searchTo);
    });
  }, [
    items,
    typeFilters,
    customCatFilters,
    searchQuery,
    searchFrom,
    searchTo,
    categories,
    typeLabels,
  ]);

  const typeFilterLabel = useMemo(() => {
    if (typeFilters.size === CALENDAR_TYPES.length) return "Todos os tipos";
    if (typeFilters.size === 0) return "Nenhum tipo";
    if (typeFilters.size === 1) {
      const only = [...typeFilters][0]!;
      return resolveTypeMeta(only, typeLabels).label;
    }
    return `${typeFilters.size} tipos`;
  }, [typeFilters, typeLabels]);

  const chapter = data?.chapter;
  const accent = chapter?.primary_color || "#9E1B32";
  const linkedMandatory = detail?.org_mandatory_date_id
    ? (data?.mandatory_dates ?? []).find((d) => d.id === detail.org_mandatory_date_id)
    : undefined;

  if (!token || error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este calendário público é inválido ou foi revogado.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <header
        className="border-b border-border px-4 py-5 sm:px-6"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Calendário · visualização pública
            </p>
            <h1 className="text-xl font-semibold sm:text-2xl">
              {chapter
                ? `${chapter.name} nº ${chapter.number}`
                : isLoading
                  ? "Carregando…"
                  : "Calendário"}
            </h1>
            {chapter?.city ? (
              <p className="text-sm text-muted-foreground">{chapter.city}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle className="h-9 w-9 shrink-0" />
            <div className="inline-flex rounded-[8px] border border-border p-0.5">
              <button
                type="button"
                onClick={() => setView("mes")}
                className="flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium"
                style={
                  view === "mes"
                    ? { backgroundColor: accent, color: "#fff" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Mês
              </button>
              <button
                type="button"
                onClick={() => setView("agenda")}
                className="flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium"
                style={
                  view === "agenda"
                    ? { backgroundColor: accent, color: "#fff" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                <List className="h-3.5 w-3.5" /> Agenda
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={!data}
              onClick={() =>
                downloadIcs(filtered, "calendario", `${chapter?.name ?? "Capítulo"} · Calendário`)
              }
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6">
        <LobbyBackLink />
        {isLoading ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setSearchFrom(null);
                      setSearchTo(null);
                    }
                  }}
                  placeholder="Buscar eventos…"
                  className="h-9 pl-9 pr-9 text-sm"
                  aria-label="Buscar no calendário"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchFrom(null);
                      setSearchTo(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {searchQuery.trim() ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    type="date"
                    value={searchFrom ?? ""}
                    onChange={(e) => setSearchFrom(e.target.value || null)}
                    className="h-9 w-[140px] text-xs"
                    aria-label="Início do período da busca"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="date"
                    value={searchTo ?? ""}
                    onChange={(e) => setSearchTo(e.target.value || null)}
                    className="h-9 w-[140px] text-xs"
                    aria-label="Fim do período da busca"
                  />
                </div>
              ) : null}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 justify-between text-xs sm:min-w-[180px]"
                  >
                    <span className="truncate">{typeFilterLabel}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[min(100vw-2rem,260px)]">
                  <DropdownMenuLabel>Tipos de evento</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {CALENDAR_TYPES.map((t) => {
                    const meta = resolveTypeMeta(t, typeLabels);
                    return (
                      <DropdownMenuCheckboxItem
                        key={t}
                        checked={typeFilters.has(t)}
                        onCheckedChange={() =>
                          setTypeFilters((prev) => {
                            const next = new Set(prev);
                            if (next.has(t)) next.delete(t);
                            else next.add(t);
                            return next;
                          })
                        }
                        onSelect={(e) => e.preventDefault()}
                        className="gap-2"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span style={{ color: meta.color }}>{meta.label}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setTypeFilters(new Set(CALENDAR_TYPES))}>
                    Selecionar todas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setTypeFilters(new Set())}
                    disabled={typeFilters.size === 0}
                  >
                    Limpar seleção
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {categories.map((c) => {
                const on = customCatFilters?.has(c.id) ?? true;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCustomCatFilters((prev) => {
                        const next = new Set(prev ?? []);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor: on
                        ? `color-mix(in srgb, ${c.color} 18%, transparent)`
                        : "transparent",
                      color: on ? c.color : "var(--muted-foreground)",
                      borderColor: on ? c.color : "var(--border)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </button>
                );
              })}
            </div>

            {view === "mes" ? (
              <MonthView
                cursor={cursor}
                setCursor={setCursor}
                items={filtered}
                typeLabels={typeLabels}
                mandatoryDates={mandatoryDatesForCursor}
                onDayClick={setSelectedDay}
              />
            ) : (
              <div className="space-y-3">
                <MandatoryDatesBanner items={mandatoryDatesForCursor} />
                <AgendaView
                  items={filtered}
                  typeLabels={typeLabels}
                  onSelect={setDetail}
                  chapterNameMap={new Map()}
                  showChapter={false}
                />
              </div>
            )}
          </>
        )}
      </main>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay
                ? new Date(`${selectedDay}T00:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "Dia"}
            </DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {selectedDay &&
            filtered.filter((it) => occursOnDay(it, selectedDay)).length === 0 ? (
              <li className="text-sm text-muted-foreground">Nenhum item neste dia.</li>
            ) : null}
            {selectedDay
              ? filtered
                  .filter((it) => occursOnDay(it, selectedDay))
                  .sort((a, b) => a.start_at.localeCompare(b.start_at))
                  .map((it) => {
                    const meta = resolveTypeMeta(it.event_type, typeLabels);
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          className="w-full rounded-[8px] border border-border p-3 text-left hover:bg-muted"
                          onClick={() => {
                            setDetail(it);
                            setSelectedDay(null);
                          }}
                        >
                          <span className="text-sm font-medium">{it.title}</span>
                          <span
                            className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </button>
                      </li>
                    );
                  })
              : null}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: resolveTypeMeta(detail.event_type, typeLabels).bg,
                      color: resolveTypeMeta(detail.event_type, typeLabels).color,
                    }}
                  >
                    {resolveTypeMeta(detail.event_type, typeLabels).label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={
                      detail.mandatory
                        ? { backgroundColor: "#FEE2E2", color: "#B91C1C" }
                        : {
                            backgroundColor: "var(--muted)",
                            color: "var(--muted-foreground)",
                          }
                    }
                  >
                    {detail.mandatory ? "Obrigatório" : "Facultativo"}
                  </span>
                  <span>{detail.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Início</div>
                  <div>{formatDateTimeBR(detail.start_at)}</div>
                </div>
                {detail.end_at ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Término</div>
                    <div>{formatDateTimeBR(detail.end_at)}</div>
                  </div>
                ) : null}
                {detail.location ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Local</div>
                    <div>{detail.location}</div>
                  </div>
                ) : null}
                {detail.dress_code ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Traje</div>
                    <div>{detail.dress_code}</div>
                  </div>
                ) : null}
                {detail.address ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Endereço</div>
                    <div>{detail.address}</div>
                  </div>
                ) : null}
                {linkedMandatory ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Data obrigatória</div>
                    <div>
                      {linkedMandatory.title}
                      {" · "}
                      {formatPrazoLabel(linkedMandatory)}
                    </div>
                  </div>
                ) : null}
                {detail.description ? (
                  <div>
                    <div className="text-xs text-muted-foreground">Descrição</div>
                    <div className="whitespace-pre-wrap">{detail.description}</div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const text = [
                        detail.title,
                        formatDateTimeBR(detail.start_at),
                        detail.location,
                        detail.address,
                      ]
                        .filter(Boolean)
                        .join("\n");
                      void navigator.clipboard.writeText(text).then(
                        () => toast.success("Evento copiado"),
                        () => toast.error("Não foi possível copiar"),
                      );
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={googleCalendarUrl(detail)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" /> Google Agenda
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={outlookCalendarUrl(detail)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" /> Outlook
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadIcs([detail], detail.title)}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" /> .ics
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
