import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  listCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
  listChapterCalendarCategories,
  upsertChapterCalendarCategory,
  deleteChapterCalendarCategory,
  updateCalendarTypeLabels,
  type ChapterCalendarCategory,
} from "@/lib/calendar.functions";
import { listLodges } from "@/lib/chapter.functions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Expand } from "@/components/ui/expand";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Shirt,
  Users,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  PlusCircle,
  MapPin,
  Link as LinkIcon,
  Trash2,
  Pencil,
  Download,
  Copy,
  ExternalLink,
  Sparkles,
  Tags,
  Loader2,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
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
  listMandatoryDatesForChapter,
  mandatoryDateAppliesToMonth,
  sortMandatoryDatesChronological,
} from "@/lib/org-mandatory-dates.functions";
import { composeEventDescription } from "@/lib/ai.functions";
import { formatDateTimeBR } from "@/lib/format";
import {
  formatTimeInAppTz,
  todayYmd,
  APP_TIMEZONE,
  fromAppTzDateTimeLocal,
  toAppTzDateTimeLocal,
} from "@/lib/timezone";
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/ics";
import { matchesLooseSearch } from "@/lib/utils";
import { resolveCalendarChaveText } from "@/lib/resolve-calendar-chave";
import {
  TYPE_META,
  CALENDAR_TYPES,
  isSessionType,
  parseCalendarTypeLabels,
  supportsAttendance,
  supportsMinutes,
  resolveTypeMeta,
  type CalendarType,
  type CalendarTypeLabels,
} from "@/lib/calendar-types";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { DayAgendaDialog } from "@/components/calendar/DayAgendaDialog";
import { useConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/_shell/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Templo Virtual" },
      {
        name: "description",
        content:
          "Calendário unificado de sessões, eventos e filantropia do capítulo.",
      },
    ],
  }),
  component: CalendarioPage,
});

export type CalendarItem = {
  id: string;
  chapter_id: string;
  title: string;
  event_type: CalendarType;
  mandatory: boolean;
  public_open: boolean;
  start_at: string;
  end_at: string | null;
  location: string | null;
  address: string | null;
  lodge_id: string | null;
  dress_code: string | null;

  description: string | null;
  related_event_id: string | null;
  custom_category_id: string | null;
  org_mandatory_date_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Interseção do evento com o intervalo YYYY-MM-DD da busca. */
export function eventIntersectsSearchRange(
  it: { start_at: string; end_at: string | null },
  fromYmd: string | null,
  toYmd: string | null,
): boolean {
  if (!fromYmd && !toYmd) return true;
  const startKey = todayYmd(it.start_at);
  const endKey = todayYmd(it.end_at ?? it.start_at);
  const from = fromYmd || "0000-01-01";
  const to = toYmd || "9999-12-31";
  const a = from <= to ? from : to;
  const b = from <= to ? to : from;
  return startKey <= b && endKey >= a;
}

const itemsQO = (
  chapterIds: string[],
  range: { from?: string; to?: string },
) =>
  queryOptions({
    queryKey: [
      "calendar",
      chapterIds.join(","),
      range.from ?? "",
      range.to ?? "",
    ],
    queryFn: () =>
      listCalendarItems({
        data: {
          chapterIds,
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
      }) as Promise<CalendarItem[]>,
    enabled: chapterIds.length > 0,
  });

export function yearBoundsIso(year: number) {
  return {
    from: new Date(year, 0, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
  };
}

function toLocalDateKey(iso: string): string {
  return todayYmd(iso);
}

/** Incrementa um dia em uma chave YYYY-MM-DD (aritmética de calendário). */
function addOneDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** Todas as datas (chaves no fuso do app) cobertas pelo item — itens que viram o dia aparecem em ambas. */
function itemDayKeys(it: {
  start_at: string;
  end_at: string | null;
}): string[] {
  const startKey = todayYmd(it.start_at);
  const endKey = todayYmd(it.end_at ?? it.start_at);
  const keys: string[] = [];
  let cur = startKey;
  while (cur <= endKey && keys.length < 60) {
    keys.push(cur);
    cur = addOneDayYmd(cur);
  }
  return keys.length ? keys : [startKey];
}

export function occursOnDay(
  it: { start_at: string; end_at: string | null },
  key: string,
) {
  return itemDayKeys(it).includes(key);
}

function CalendarioPage() {
  const { active, memberships, refetch } = useActiveChapter();
  const { can, canScreen } = useChapterAccess();
  const canManageCats =
    canScreen("calendario", "edit") || can("secretaria");
  const qc = useQueryClient();

  const [view, setView] = useState<"mes" | "agenda">("mes");
  const [pickedDay, setPickedDay] = useState<string>(() =>
    toLocalDateKey(new Date().toISOString()),
  );
  const [typeFilters, setTypeFilters] = useState<Set<CalendarType>>(
    new Set(CALENDAR_TYPES),
  );
  const [customCatFilters, setCustomCatFilters] = useState<Set<string> | null>(
    null,
  );
  const [chapterFilter, setChapterFilter] = useState<string>(
    () => active?.chapter_id ?? "all",
  );
  const [catsOpen, setCatsOpen] = useState(false);

  useEffect(() => {
    if (active?.chapter_id) setChapterFilter(active.chapter_id);
  }, [active?.chapter_id]);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState<string | null>(null);
  const [searchTo, setSearchTo] = useState<string | null>(null);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchFrom(null);
      setSearchTo(null);
    }
  }

  const chapterIds = useMemo(
    () => memberships.map((m) => m.chapter_id),
    [memberships],
  );

  // Janela de carga ligada ao mês/ano navegados (±1 ano).
  const queryRange = useMemo(() => {
    const y = cursor.getFullYear();
    return {
      from: yearBoundsIso(y - 1).from,
      to: yearBoundsIso(y + 1).to,
    };
  }, [cursor]);

  const { data: items } = useSuspenseQuery(itemsQO(chapterIds, queryRange));

  const categoriesChapterId =
    chapterFilter !== "all" ? chapterFilter : (active?.chapter_id ?? null);

  const typeLabels = useMemo((): CalendarTypeLabels => {
    const chapterId = categoriesChapterId ?? active?.chapter_id;
    const mem =
      memberships.find((m) => m.chapter_id === chapterId) ?? active ?? null;
    return parseCalendarTypeLabels(mem?.chapter.settings);
  }, [memberships, categoriesChapterId, active]);

  const { data: customCategories = [] } = useQuery({
    queryKey: ["calendar-categories", categoriesChapterId],
    queryFn: () =>
      listChapterCalendarCategories({
        data: { chapterId: categoriesChapterId! },
      }),
    enabled: Boolean(categoriesChapterId),
  });

  const customCatIdsKey = customCategories.map((c) => c.id).join(",");

  // Inicializa filtros de categorias custom (todas ativas)
  useEffect(() => {
    setCustomCatFilters(new Set(customCategories.map((c) => c.id)));
  }, [customCatIdsKey]);

  const canCreate =
    canScreen("calendario", "create") ||
    can("admin") ||
    can("secretaria");

  const mandatoryChapterId =
    chapterFilter !== "all" ? chapterFilter : (active?.chapter_id ?? null);

  const { data: mandatoryDates = [] } = useQuery({
    queryKey: ["mandatory-dates-chapter", mandatoryChapterId],
    queryFn: () =>
      listMandatoryDatesForChapter({
        data: { chapterId: mandatoryChapterId! },
      }),
    enabled: Boolean(mandatoryChapterId),
  });

  const mandatoryDatesForCursor = useMemo(() => {
    const month = cursor.getMonth() + 1;
    const year = cursor.getFullYear();
    return sortMandatoryDatesChronological(
      mandatoryDates.filter((r) =>
        mandatoryDateAppliesToMonth(r, year, month),
      ),
    );
  }, [mandatoryDates, cursor]);

  const filtered = useMemo(() => {
    const catOn = customCatFilters;
    const q = searchQuery.trim();
    const catById = new Map(customCategories.map((c) => [c.id, c.name]));
    return items.filter((it) => {
      if (!typeFilters.has(it.event_type)) return false;
      if (chapterFilter !== "all" && it.chapter_id !== chapterFilter)
        return false;
      if (it.custom_category_id && catOn && !catOn.has(it.custom_category_id))
        return false;
      if (q) {
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
        if (!eventIntersectsSearchRange(it, searchFrom, searchTo)) return false;
      }
      return true;
    });
  }, [
    items,
    typeFilters,
    chapterFilter,
    customCatFilters,
    searchQuery,
    searchFrom,
    searchTo,
    customCategories,
    typeLabels,
  ]);

  const chapterNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of memberships)
      m.set(mem.chapter_id, `${mem.chapter.name} · Nº ${mem.chapter.number}`);
    return m;
  }, [memberships]);

  function toggleType(t: CalendarType) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleCustomCat(id: string) {
    setCustomCatFilters((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const typeFilterLabel = useMemo(() => {
    if (typeFilters.size === CALENDAR_TYPES.length) return "Todos os tipos";
    if (typeFilters.size === 0) return "Nenhum tipo";
    if (typeFilters.size === 1) {
      const only = [...typeFilters][0]!;
      return resolveTypeMeta(only, typeLabels).label;
    }
    return `${typeFilters.size} tipos`;
  }, [typeFilters, typeLabels]);

  return (
    <div>
      <PageHeader
        title="Calendário"
        subtitle="Sessões, eventos e ações de filantropia em uma visão única."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div
              role="tablist"
              aria-label="Visualização"
              className="inline-flex gap-1 rounded-[12px] bg-[#E9E9E5] p-1 dark:bg-tv-line"
            >
              {(
                [
                  ["mes", "Mês", LayoutGrid],
                  ["agenda", "Agenda", List],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => setView(k)}
                  className={`flex min-h-[38px] items-center gap-1.5 rounded-[9px] px-3.5 text-sm font-semibold ${
                    view === k
                      ? "bg-tv-surface text-tv-text shadow-[0_1px_3px_rgba(20,20,20,0.12)]"
                      : "text-[#4A4D54] dark:text-tv-text-2"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                downloadIcs(filtered, `calendario-sgcdm`, "Templo Virtual · Calendário")
              }
              title="Baixar .ics para Google Agenda, Apple, Outlook ou Teams"
              aria-label="Exportar calendário"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            {canManageCats && categoriesChapterId && (
              <Button
                variant="outline"
                onClick={() => setCatsOpen(true)}
                title="Categorias do calendário"
                aria-label="Categorias do calendário"
              >
                <Tags className="h-4 w-4" />
                <span className="hidden sm:inline">Categorias</span>
              </Button>
            )}
            {canCreate && (
              <Dialog
                open={createOpen}
                onOpenChange={(o) => {
                  setCreateOpen(o);
                  if (!o) setCreateDate(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button onClick={() => setCreateDate(null)}>
                    <PlusCircle className="h-[18px] w-[18px]" />
                    <span className="md:hidden">Novo</span>
                    <span className="hidden md:inline">Novo compromisso</span>
                  </Button>
                </DialogTrigger>
                <CreateDialog
                  key={createDate ?? "novo"}
                  chapterId={active?.chapter_id ?? ""}
                  chapterName={
                    active
                      ? `${active.chapter.name} · Nº ${active.chapter.number}`
                      : ""
                  }
                  customCategories={customCategories}
                  typeLabels={typeLabels}
                  defaultDate={createDate}
                  onClose={() => setCreateOpen(false)}
                  onCreated={() => {
                    setCreateOpen(false);
                    setCreateDate(null);
                    qc.invalidateQueries({ queryKey: ["calendar"] });
                    qc.invalidateQueries({ queryKey: ["calendar-chave-text"] });
                    qc.invalidateQueries({ queryKey: ["calendar-next"] });
                  }}
                />
              </Dialog>
            )}
          </div>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar eventos…"
            className="pl-9 pr-9"
            aria-label="Buscar no calendário"
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
              onClick={() => handleSearchChange("")}
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
              className="h-9 w-[140px] cursor-pointer text-xs"
              aria-label="Início do período da busca"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={searchTo ?? ""}
              onChange={(e) => setSearchTo(e.target.value || null)}
              className="h-9 w-[140px] cursor-pointer text-xs"
              aria-label="Fim do período da busca"
            />
          </div>
        ) : null}
      </div>

      <MandatoryDatesCard dates={mandatoryDatesForCursor} items={items} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={typeFilters.size === CALENDAR_TYPES.length}
          onClick={() => setTypeFilters(new Set(CALENDAR_TYPES))}
          className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 ${
            typeFilters.size === CALENDAR_TYPES.length
              ? "border-tv-text bg-tv-text text-tv-surface"
              : "border-tv-border bg-tv-surface text-tv-text"
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#9A9DA3]" aria-hidden />
          Todos
        </button>
        {CALENDAR_TYPES.map((t) => {
          const meta = resolveTypeMeta(t, typeLabels);
          const all = typeFilters.size === CALENDAR_TYPES.length;
          const on = !all && typeFilters.has(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => (all ? setTypeFilters(new Set([t])) : toggleType(t))}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 ${
                on
                  ? "border-tv-text bg-tv-text text-tv-surface"
                  : "border-tv-border bg-tv-surface text-tv-text"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
              {meta.label}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="cursor-pointer justify-between text-sm" aria-label="Escolher vários tipos">
              <span className="truncate">{typeFilterLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(100vw-2rem,260px)]"
          >
            <DropdownMenuLabel>Tipos de evento</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CALENDAR_TYPES.map((t) => {
              const meta = resolveTypeMeta(t, typeLabels);
              return (
                <DropdownMenuCheckboxItem
                  key={t}
                  checked={typeFilters.has(t)}
                  onCheckedChange={() => toggleType(t)}
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
            <DropdownMenuItem
              onSelect={() => setTypeFilters(new Set(CALENDAR_TYPES))}
            >
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
        {customCategories.map((c) => {
          const on = customCatFilters?.has(c.id) ?? true;
          const bg = `color-mix(in srgb, ${c.color} 18%, transparent)`;
          return (
            <button
              key={c.id}
              onClick={() => toggleCustomCat(c.id)}
              aria-pressed={on}
              className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: on ? bg : "transparent",
                color: on ? c.color : "var(--muted-foreground)",
                borderColor: on ? c.color : "var(--border)",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              {c.name}
            </button>
          );
        })}
        {memberships.length > 1 && (
          <div className="w-full sm:ml-auto sm:w-auto">
            <SearchableSelect
              value={chapterFilter}
              onChange={setChapterFilter}
              placeholder="Capítulo"
              searchPlaceholder="Buscar capítulo…"
              emptyText="Nenhum capítulo encontrado."
              className="h-9 text-xs sm:w-[220px]"
              options={[
                { value: "all", label: "Todos os capítulos" },
                ...memberships.map((m) => ({
                  value: m.chapter_id,
                  label: `${m.chapter.name} · Nº ${m.chapter.number}`,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {categoriesChapterId && (
        <ManageCategoriesDialog
          open={catsOpen}
          onOpenChange={setCatsOpen}
          chapterId={categoriesChapterId}
          canManage={canManageCats}
          typeLabels={typeLabels}
          onLabelsSaved={() => {
            void refetch();
            qc.invalidateQueries({ queryKey: ["memberships"] });
          }}
        />
      )}

      {view === "mes" ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:flex-[3]">
            <MonthView
              cursor={cursor}
              setCursor={setCursor}
              items={filtered}
              typeLabels={typeLabels}
              mandatoryDates={[]}
              selectedDay={pickedDay}
              onDayClick={setPickedDay}
            />
          </div>
          <SelectedDayPanel
            dayKey={pickedDay}
            items={filtered.filter((it) => occursOnDay(it, pickedDay))}
            typeLabels={typeLabels}
            chapterNameMap={chapterNameMap}
            showChapter={memberships.length > 1}
            onSelect={setDetail}
            onCreate={
              canCreate
                ? (key) => {
                    setCreateDate(key);
                    setCreateOpen(true);
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <AgendaView
            items={filtered}
            typeLabels={typeLabels}
            onSelect={setDetail}
            chapterNameMap={chapterNameMap}
            showChapter={memberships.length > 1}
          />
        </div>
      )}

      {/* Day list dialog (month view) */}
      <DayAgendaDialog
        dayKey={selectedDay}
        items={
          selectedDay
            ? filtered.filter((it) => occursOnDay(it, selectedDay))
            : []
        }
        typeLabels={typeLabels}
        chapterNameMap={chapterNameMap}
        showChapter={memberships.length > 1}
        canCreate={canCreate}
        onOpenChange={(o) => !o && setSelectedDay(null)}
        onNavigate={(key) => {
          setSelectedDay(key);
          const [y, m] = key.split("-").map(Number);
          if (y !== cursor.getFullYear() || m - 1 !== cursor.getMonth()) {
            setCursor(new Date(y, m - 1, 1));
          }
        }}
        onSelect={(it) => {
          setDetail(it as CalendarItem);
          setSelectedDay(null);
        }}
        onCreate={(key) => {
          setCreateDate(key);
          setSelectedDay(null);
          setCreateOpen(true);
        }}
      />

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <DetailContent
              item={detail}
              typeLabels={typeLabels}
              chapterName={chapterNameMap.get(detail.chapter_id)}
              showChapter={memberships.length > 1}
              canDelete={canCreate && detail.chapter_id === active?.chapter_id}
              onEdit={() => {
                setEditItem(detail);
                setDetail(null);
              }}
              onDeleted={() => {
                setDetail(null);
                qc.invalidateQueries({ queryKey: ["calendar"] });
                qc.invalidateQueries({ queryKey: ["calendar-chave-text"] });
                qc.invalidateQueries({ queryKey: ["calendar-next"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        {editItem && (
          <CreateDialog
            key={editItem.id}
            item={editItem}
            chapterId={editItem.chapter_id}
            chapterName={chapterNameMap.get(editItem.chapter_id) ?? ""}
            customCategories={customCategories}
            typeLabels={typeLabels}
            onClose={() => setEditItem(null)}
            onCreated={() => {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["calendar"] });
              qc.invalidateQueries({ queryKey: ["calendar-chave-text"] });
              qc.invalidateQueries({ queryKey: ["calendar-next"] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

export function MandatoryDatesBanner({
  items,
}: {
  items: { id: string; title: string; prazo_label: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="rounded-[10px] border px-3 py-2.5 text-sm"
      style={{
        borderColor: "color-mix(in srgb, var(--chapter-primary) 35%, var(--border))",
        backgroundColor:
          "color-mix(in srgb, var(--chapter-primary) 8%, transparent)",
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: "var(--chapter-primary)" }}
        />
        <div className="min-w-0">
          <div className="font-medium">Datas obrigatórias:</div>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {items.map((it) => (
              <li key={it.id}>
                • {it.title} - {it.prazo_label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function MonthView({
  cursor,
  setCursor,
  items,
  typeLabels,
  mandatoryDates,
  onDayClick,
  selectedDay,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  items: CalendarItem[];
  typeLabels?: CalendarTypeLabels;
  mandatoryDates: { id: string; title: string; prazo_label: string }[];
  onDayClick: (key: string) => void;
  selectedDay?: string | null;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      for (const key of itemDayKeys(it)) {
        const arr = map.get(key) ?? [];
        arr.push(it);
        map.set(key, arr);
      }
    }
    return map;
  }, [items]);

  const monthLabel = cursor.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const todayKey = toLocalDateKey(new Date().toISOString());

  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  };
  const longMonth = (n: number) =>
    new Date(year, month, n).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <Card className="p-3.5 lg:px-5 lg:py-[18px]">
      <div className="mb-2 flex items-center justify-between gap-2 lg:mb-3">
        <Button
          aria-label="Mês anterior"
          size="icon"
          variant="ghost"
          className="rounded-full bg-tv-bg lg:hidden"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-[17px] font-bold first-letter:uppercase lg:font-display lg:text-xl lg:font-extrabold">
          {monthLabel}
        </div>
        <Button
          aria-label="Próximo mês"
          size="icon"
          variant="ghost"
          className="rounded-full bg-tv-bg lg:hidden"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="hidden items-center gap-1.5 lg:flex">
          <Button
            aria-label="Mês anterior"
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToday}>
            Hoje
          </Button>
          <Button
            aria-label="Próximo mês"
            size="icon"
            variant="outline"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {mandatoryDates.length > 0 ? (
        <div className="mb-3">
          <MandatoryDatesBanner items={mandatoryDates} />
        </div>
      ) : null}
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-semibold text-tv-text-2 lg:gap-1.5 lg:text-[13px]">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-1">
            <span className="lg:hidden">{d[0]}</span>
            <span className="hidden lg:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 lg:gap-1.5">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - startWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          if (!inMonth) return <div key={idx} aria-hidden />;
          const date = new Date(year, month, dayNum);
          const key = toLocalDateKey(date.toISOString());
          const dayItems = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSel = key === selectedDay;
          const visible = dayItems.slice(0, 3);
          const extra = dayItems.length - visible.length;
          const dotColor = dayItems[0]
            ? resolveTypeMeta(dayItems[0].event_type, typeLabels).color
            : "transparent";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDayClick(key)}
              aria-pressed={isSel}
              aria-label={`${longMonth(dayNum)}${dayItems.length ? `, ${dayItems.length} compromisso${dayItems.length > 1 ? "s" : ""}` : ""}${isToday ? ", hoje" : ""}`}
              className={`flex h-[46px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] text-left lg:h-auto lg:min-h-[100px] lg:items-stretch lg:justify-start lg:gap-1 lg:border-2 lg:p-1.5 ${
                isSel
                  ? "lg:border-tv-primary lg:bg-tv-soft"
                  : "lg:border-tv-line lg:bg-tv-surface lg:hover:bg-tv-bg"
              }`}
            >
              {/* Celular: número em círculo + ponto */}
              <span
                className={`grid h-[34px] w-[34px] place-items-center rounded-full border-2 text-[15px] lg:hidden ${
                  isSel
                    ? "border-transparent bg-tv-primary font-bold text-white"
                    : isToday
                      ? "border-tv-primary font-bold"
                      : "border-transparent font-medium"
                }`}
              >
                {dayNum}
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full lg:hidden"
                style={{ backgroundColor: dotColor }}
                aria-hidden
              />
              {/* Desktop: número + compromissos */}
              <span
                className={`hidden h-7 w-7 place-items-center rounded-full text-sm font-bold lg:grid ${
                  isToday ? "bg-tv-primary text-white" : ""
                }`}
              >
                {dayNum}
              </span>
              <span className="hidden min-w-0 flex-col gap-1 lg:flex">
                {visible.map((it) => {
                  const meta = resolveTypeMeta(it.event_type, typeLabels);
                  return (
                    <span
                      key={it.id}
                      className="block max-w-full truncate rounded-[6px] px-1.5 py-[3px] text-xs font-semibold"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {formatTimeInAppTz(it.start_at)} {it.title}
                    </span>
                  );
                })}
                {extra > 0 && <span className="text-xs text-tv-text-2">+{extra} mais</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Painel do dia escolhido: ao lado da grade no computador, abaixo no celular. */
function SelectedDayPanel({
  dayKey,
  items,
  typeLabels,
  chapterNameMap,
  showChapter,
  onSelect,
  onCreate,
}: {
  dayKey: string;
  items: CalendarItem[];
  typeLabels?: CalendarTypeLabels;
  chapterNameMap: Map<string, string>;
  showChapter: boolean;
  onSelect: (it: CalendarItem) => void;
  onCreate?: (key: string) => void;
}) {
  const todayKey = toLocalDateKey(new Date().toISOString());
  const date = new Date(`${dayKey}T12:00:00`);
  const label = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const title = dayKey === todayKey ? `Hoje, ${label.split(", ").slice(1).join(", ")}` : label;
  const sorted = [...items].sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:flex-1 lg:rounded-[20px] lg:bg-tv-surface lg:p-5">
      <span className="hidden text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2 lg:block">
        Dia selecionado
      </span>
      <h2 className="text-[15px] font-bold first-letter:uppercase lg:font-display lg:text-xl lg:font-extrabold">
        {title}
      </h2>
      <div key={dayKey} className="fade-enter flex flex-col gap-3">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-2.5 rounded-[20px] bg-tv-surface p-[18px] lg:rounded-[16px] lg:border lg:border-[#ECECE8] lg:p-3.5 dark:lg:border-tv-line">
          <span className="text-[15px] text-tv-text-2">Nada marcado neste dia.</span>
          {onCreate ? (
            <button
              type="button"
              onClick={() => onCreate(dayKey)}
              className="min-h-11 rounded-[12px] border border-dashed border-[#CFCFCA] bg-tv-surface px-3.5 text-sm font-semibold dark:border-tv-border"
            >
              Marcar algo neste dia
            </button>
          ) : null}
        </div>
      ) : (
        sorted.map((it) => {
          const meta = resolveTypeMeta(it.event_type, typeLabels);
          const chapter = showChapter ? chapterNameMap.get(it.chapter_id) : null;
          return (
            <div
              key={it.id}
              className="flex flex-col gap-2.5 rounded-[20px] bg-tv-surface p-4 lg:rounded-[16px] lg:border lg:border-[#ECECE8] lg:p-3.5 dark:lg:border-tv-line"
            >
              <span
                className="self-start rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ backgroundColor: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="text-lg font-bold leading-snug lg:text-base">{it.title}</span>
              <span className="text-[15px] text-[#3F4249] dark:text-tv-text-2 lg:text-sm">
                {[formatTimeInAppTz(it.start_at), it.location, chapter].filter(Boolean).join(" · ")}
              </span>
              <Button className="min-h-12 lg:min-h-11" onClick={() => onSelect(it)}>
                Ver detalhes
              </Button>
            </div>
          );
        })
      )}
      {sorted.length > 0 && onCreate ? (
        <button
          type="button"
          onClick={() => onCreate(dayKey)}
          className="min-h-11 self-start rounded-[12px] border border-dashed border-[#CFCFCA] px-3.5 text-sm font-semibold dark:border-tv-border"
        >
          Marcar mais algo neste dia
        </button>
      ) : null}
      </div>
    </aside>
  );
}

/** Datas obrigatórias do período: card no computador, sanfona no celular. */
function MandatoryDatesCard({
  dates,
  items,
}: {
  dates: { id: string; title: string; prazo_label: string }[];
  items: CalendarItem[];
}) {
  const [open, setOpen] = useState(false);
  if (dates.length === 0) return null;
  const todayKey = toLocalDateKey(new Date().toISOString());
  const rows = dates.map((d) => {
    const linked = items
      .filter((it) => it.org_mandatory_date_id === d.id)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
    if (!linked) return { ...d, ok: false, status: "Falta marcar" };
    const key = toLocalDateKey(linked.start_at);
    const ddmm = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
    return { ...d, ok: true, status: key < todayKey ? `Feita em ${ddmm}` : `Marcado ${ddmm}` };
  });
  const pending = rows.filter((r) => !r.ok).length;
  const done = rows.length - pending;
  const list = (
    <div className="grid gap-x-4 gap-y-2 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2.5 border-t border-tv-line px-4 py-3 md:rounded-[12px] md:border md:bg-[#FAFAF8] md:px-3 md:py-2.5 dark:md:bg-tv-bg"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold md:text-sm">{r.title}</span>
            <span className="block text-[13px] text-tv-text-2">{r.prazo_label}</span>
          </span>
          <span
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
              r.ok ? "bg-tv-in-bg text-tv-in" : "bg-tv-warn-bg text-tv-warn"
            }`}
          >
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <section className="mb-4 overflow-hidden rounded-[20px] bg-tv-surface md:px-5 md:py-[18px]">
      {/* Celular: sanfona */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-left md:hidden"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tv-warn-bg text-tv-warn">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold">Datas obrigatórias</span>
          <span className="block text-[13px] text-tv-text-2">
            {pending > 0 ? `${pending} ainda ${pending === 1 ? "falta" : "faltam"} marcar` : "Todas marcadas"}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 text-tv-text-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <Expand open={open} className="md:hidden">
        {list}
      </Expand>
      {/* Computador: sempre aberto */}
      <div className="hidden md:block">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-bold">
            <AlertTriangle className="h-5 w-5 text-tv-warn" aria-hidden />
            Datas obrigatórias
          </span>
          <span className="text-sm text-tv-text-2">
            {done} de {rows.length} {rows.length === 1 ? "resolvida" : "resolvidas"}
          </span>
        </div>
        {list}
      </div>
    </section>
  );
}

export function AgendaView({
  items,
  typeLabels,
  onSelect,
  chapterNameMap,
  showChapter,
}: {
  items: CalendarItem[];
  typeLabels?: CalendarTypeLabels;
  onSelect: (it: CalendarItem) => void;
  chapterNameMap: Map<string, string>;
  showChapter: boolean;
}) {
  const now = new Date();
  const todayKey = toLocalDateKey(now.toISOString());
  const upcoming = items
    .filter((i) => itemDayKeys(i).some((k) => k >= todayKey))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  if (upcoming.length === 0) {
    return (
      <Card className="p-10 text-center">
        <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <div className="text-sm font-medium">Nada agendado por aqui.</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Os próximos itens do calendário aparecerão nesta lista.
        </div>
      </Card>
    );
  }

  const groups = new Map<string, CalendarItem[]>();
  for (const it of upcoming) {
    for (const key of itemDayKeys(it)) {
      if (key < todayKey) continue;
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(groups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, list]) => {
          const date = new Date(key + "T00:00:00");
          const label = date.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          });
          return (
            <div key={key}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {list.map((it) => (
                    <li key={it.id}>
                      <button
                        className="w-full p-4 text-left hover:bg-muted"
                        onClick={() => onSelect(it)}
                      >
                        <ItemRow
                          item={it}
                          typeLabels={typeLabels}
                          chapterName={chapterNameMap.get(it.chapter_id)}
                          showChapter={showChapter}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          );
        })}
    </div>
  );
}

function ItemRow({
  item,
  typeLabels,
  chapterName,
  showChapter,
}: {
  item: CalendarItem;
  typeLabels?: CalendarTypeLabels;
  chapterName?: string;
  showChapter: boolean;
}) {
  const meta = resolveTypeMeta(item.event_type, typeLabels);
  const time = formatTimeInAppTz(item.start_at);
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-xs font-semibold"
        style={{ backgroundColor: meta.bg, color: meta.color }}
      >
        {time}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.location}
            </span>
          )}
          {showChapter && chapterName && <span>{chapterName}</span>}
        </div>
      </div>
    </div>
  );
}

function DetailContent({
  item,
  typeLabels,
  chapterName,
  showChapter,
  canDelete,
  onDeleted,
  onEdit,
}: {
  item: CalendarItem;
  typeLabels?: CalendarTypeLabels;
  chapterName?: string;
  showChapter: boolean;
  canDelete: boolean;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const meta = resolveTypeMeta(item.event_type, typeLabels);
  const { active: activeChapter } = useActiveChapter();
  const { data: chaveText } = useQuery({
    queryKey: [
      "calendar-chave-text",
      item.id,
      activeChapter?.chapter_id,
      item.dress_code,
      item.location,
      item.address,
      item.title,
      item.description,
      item.start_at,
      item.end_at,
      item.event_type,
    ],
    queryFn: () =>
      resolveCalendarChaveText(item, activeChapter?.chapter),
  });
  const { data: mandatoryDatesForDetail = [] } = useQuery({
    queryKey: ["mandatory-dates-chapter", item.chapter_id],
    queryFn: () =>
      listMandatoryDatesForChapter({ data: { chapterId: item.chapter_id } }),
    enabled: Boolean(item.org_mandatory_date_id && item.chapter_id),
  });
  const linkedMandatory = item.org_mandatory_date_id
    ? mandatoryDatesForDetail.find((d) => d.id === item.org_mandatory_date_id)
    : undefined;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const del = useMutation({
    mutationFn: () => deleteCalendarItem({ data: { id: item.id } }),
    onSuccess: () => {
      toast.success("Item excluído");
      onDeleted();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const startKey = todayYmd(item.start_at);
  const endKey = item.end_at ? todayYmd(item.end_at) : startKey;
  const multiDay = endKey !== startKey;
  const longDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: APP_TIMEZONE,
    });
  const hasAttendanceLink =
    canDelete &&
    (supportsAttendance(item.event_type) || supportsMinutes(item.event_type));

  function copyChave() {
    try {
      if (!chaveText) throw new Error("Aguarde o carregamento da chave.");
      const isSindicancia = item.event_type === "sindicancia";
      void navigator.clipboard.writeText(chaveText).then(
        () =>
          toast.success(
            isSindicancia
              ? "Chave de sindicância copiada!"
              : "Chave do dia copiada!",
          ),
        (e: unknown) =>
          toast.error(
            e instanceof Error ? e.message : "Não foi possível copiar.",
          ),
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível copiar.");
    }
  }

  return (
    <>
      <DialogHeader className="space-y-3 pr-6 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={
              item.mandatory
                ? { backgroundColor: "#FEE2E2", color: "#B91C1C" }
                : {
                    backgroundColor: "var(--muted)",
                    color: "var(--muted-foreground)",
                  }
            }
          >
            {item.mandatory ? "Obrigatório" : "Facultativo"}
          </span>
          {item.public_open && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
            >
              Aberto ao público
            </span>
          )}
        </div>
        <div className="flex items-stretch gap-3">
          <span
            aria-hidden
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <DialogTitle className="text-xl leading-snug">
            {item.title}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-muted/30 p-3">
          <CalendarDays
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--chapter-primary)" }}
          />
          <div className="min-w-0">
            {multiDay ? (
              <>
                <div className="font-medium">
                  {capitalizeFirst(longDate(item.start_at))} ·{" "}
                  {formatTimeInAppTz(item.start_at)}
                </div>
                <div className="text-muted-foreground">
                  até {longDate(item.end_at!)} · {formatTimeInAppTz(item.end_at!)}
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">
                  {capitalizeFirst(longDate(item.start_at))}
                </div>
                <div className="text-muted-foreground">
                  {formatTimeInAppTz(item.start_at)}
                  {item.end_at && ` – ${formatTimeInAppTz(item.end_at)}`}
                </div>
              </>
            )}
          </div>
        </div>

        {(item.location ||
          item.dress_code ||
          item.address ||
          (showChapter && chapterName)) && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {item.location && (
              <InfoRow icon={MapPin} label="Local" value={item.location} />
            )}
            {item.dress_code && (
              <InfoRow icon={Shirt} label="Traje" value={item.dress_code} />
            )}
            {item.address && (
              <InfoRow
                icon={MapPin}
                label="Endereço"
                value={item.address}
                className="sm:col-span-2"
              />
            )}
            {showChapter && chapterName && (
              <InfoRow icon={Users} label="Capítulo" value={chapterName} />
            )}
          </dl>
        )}

        {linkedMandatory && (
          <div className="rounded-[10px] border border-border p-3">
            <div className="text-xs text-muted-foreground">
              Data Obrigatória vinculada
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {linkedMandatory.title}
                {" · "}
                {linkedMandatory.prazo_label}
              </span>
              <Link
                to="/regional/datas-obrigatorias"
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: "var(--chapter-primary)" }}
              >
                <LinkIcon className="h-3.5 w-3.5" /> Ver datas
              </Link>
            </div>
          </div>
        )}

        {item.description && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Descrição
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">
              {item.description}
            </div>
          </div>
        )}

        {(item.related_event_id || hasAttendanceLink) && (
          <div className="flex flex-col gap-2">
            {hasAttendanceLink && (
              <Link
                to="/ongoing/$id"
                params={{ id: item.id }}
                search={{
                  tab: supportsAttendance(item.event_type) ? "chamada" : "ata",
                }}
                className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                style={{ color: "var(--chapter-primary)" }}
              >
                <span className="inline-flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  {supportsAttendance(item.event_type)
                    ? supportsMinutes(item.event_type)
                      ? "Abrir chamada e ata"
                      : "Abrir chamada"
                    : "Abrir ata"}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
            {item.related_event_id && (
              <Link
                to="/eventos/$id"
                params={{ id: item.related_event_id }}
                className="flex items-center justify-between rounded-[10px] border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                style={{ color: "var(--chapter-primary)" }}
              >
                <span className="inline-flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" /> Ver evento
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-4">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!chaveText}
            onClick={copyChave}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            {item.event_type === "sindicancia"
              ? "Copiar chave de sindicância"
              : "Copiar chave do dia"}
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" asChild>
              <a
                href={googleCalendarUrl(item)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Google
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={outlookCalendarUrl(item)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Outlook
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadIcs([item], item.title)}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> .ics
            </Button>
          </div>
        </div>
      </div>
      {canDelete && (
        <DialogFooter className="border-t border-border pt-4 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Excluir este item do calendário?",
                description:
                  supportsAttendance(item.event_type) ||
                  supportsMinutes(item.event_type)
                    ? `"${item.title}" será removido. Itens que já têm chamada de presença ou ata registrada não podem ser excluídos.`
                    : `"${item.title}" será removido do calendário.`,
                confirmLabel: "Excluir item",
              });
              if (ok) del.mutate();
            }}
            disabled={del.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
          <Button
            style={{ backgroundColor: "var(--chapter-primary)" }}
            onClick={onEdit}
          >
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
        </DialogFooter>
      )}
      {confirmDialog}
    </>
  );
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words font-medium">{value}</dd>
      </div>
    </div>
  );
}

function toLocalDateTimeInput(d: Date): string {
  return toAppTzDateTimeLocal(d);
}

/** Defaults de criação (13:30 / 17:00) no fuso do app, a partir de YYYY-MM-DD. */
function appTzDateAt(ymd: string, hour: number, minute: number): Date {
  return fromAppTzDateTimeLocal(
    `${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  );
}

const DRESS_CODES = ["Informal", "Formal"] as const;

/** Duração legível entre dois valores de datetime-local; null se inválida. */
function durationLabel(startAt: string, endAt: string): string | null {
  if (!startAt || !endAt) return null;
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
  if (hours) parts.push(`${hours}h`);
  if (min) parts.push(`${min}min`);
  return parts.join(" ");
}

function FormSection({
  icon: Icon,
  title,
  className = "",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`space-y-3 rounded-[12px] border border-border bg-muted/20 p-4 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-[6px]"
          style={{
            color: "var(--chapter-primary)",
            backgroundColor:
              "color-mix(in srgb, var(--chapter-primary) 12%, transparent)",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <SectionTitle>{title}</SectionTitle>
      </div>
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function FieldError({ msg }: { msg?: string | null }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] font-medium text-destructive">{msg}</p>;
}

function ManageCategoriesDialog({
  open,
  onOpenChange,
  chapterId,
  canManage,
  typeLabels,
  onLabelsSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chapterId: string;
  canManage: boolean;
  typeLabels: CalendarTypeLabels;
  onLabelsSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["calendar-categories", chapterId, "manage"],
    queryFn: () =>
      listChapterCalendarCategories({
        data: { chapterId, includeInactive: true },
      }),
    enabled: open && Boolean(chapterId),
  });

  const [draftLabels, setDraftLabels] = useState<Record<CalendarType, string>>(
    () => {
      const init = {} as Record<CalendarType, string>;
      for (const t of CALENDAR_TYPES) {
        init[t] = resolveTypeMeta(t, typeLabels).label;
      }
      return init;
    },
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState("#9E1B32");
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editingCustomName, setEditingCustomName] = useState("");

  useEffect(() => {
    if (!open) return;
    const init = {} as Record<CalendarType, string>;
    for (const t of CALENDAR_TYPES) {
      init[t] = resolveTypeMeta(t, typeLabels).label;
    }
    setDraftLabels(init);
  }, [open, typeLabels]);

  const saveDefaults = useMutation({
    mutationFn: () =>
      updateCalendarTypeLabels({
        data: { chapterId, labels: draftLabels },
      }),
    onSuccess: () => {
      toast.success("Nomes das categorias padrão salvos");
      onLabelsSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const save = useMutation({
    mutationFn: () =>
      upsertChapterCalendarCategory({
        data: { chapterId, name: name.trim(), color },
      }),
    onSuccess: () => {
      toast.success("Categoria criada");
      setName("");
      setColor("#9E1B32");
      qc.invalidateQueries({ queryKey: ["calendar-categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const renameCustom = useMutation({
    mutationFn: (payload: { id: string; name: string; color: string }) =>
      upsertChapterCalendarCategory({
        data: {
          chapterId,
          id: payload.id,
          name: payload.name.trim(),
          color: payload.color,
        },
      }),
    onSuccess: () => {
      toast.success("Categoria atualizada");
      setEditingCustomId(null);
      setEditingCustomName("");
      qc.invalidateQueries({ queryKey: ["calendar-categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      deleteChapterCalendarCategory({ data: { id, chapterId } }),
    onSuccess: () => {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["calendar-categories"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const labelsDirty = CALENDAR_TYPES.some(
    (t) => draftLabels[t].trim() !== resolveTypeMeta(t, typeLabels).label,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorias do calendário</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Renomeie as categorias padrão deste capítulo ou adicione categorias
          extras. Os tipos internos permanecem os mesmos.
        </p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias padrão
          </p>
          <ul className="space-y-2">
            {CALENDAR_TYPES.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_META[t].color }}
                />
                {canManage ? (
                  <Input
                    value={draftLabels[t]}
                    onChange={(e) =>
                      setDraftLabels((prev) => ({
                        ...prev,
                        [t]: e.target.value,
                      }))
                    }
                    className="h-9 flex-1"
                    aria-label={`Nome de ${TYPE_META[t].label}`}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {draftLabels[t]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <Button
              type="button"
              size="sm"
              className="w-full"
              style={{ backgroundColor: "var(--chapter-primary)" }}
              disabled={
                saveDefaults.isPending ||
                !labelsDirty ||
                CALENDAR_TYPES.some((t) => !draftLabels[t].trim())
              }
              onClick={() => saveDefaults.mutate()}
            >
              {saveDefaults.isPending
                ? "Salvando…"
                : "Salvar nomes das categorias padrão"}
            </Button>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categorias personalizadas
          </p>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {cats.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhuma categoria extra ainda.
                </li>
              )}
              {cats.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {editingCustomId === c.id ? (
                    <Input
                      value={editingCustomName}
                      onChange={(e) => setEditingCustomName(e.target.value)}
                      className="h-9 flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingCustomName.trim()) {
                          renameCustom.mutate({
                            id: c.id,
                            name: editingCustomName,
                            color: c.color,
                          });
                        }
                        if (e.key === "Escape") {
                          setEditingCustomId(null);
                          setEditingCustomName("");
                        }
                      }}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.name}
                    </span>
                  )}
                  {canManage &&
                    (editingCustomId === c.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={
                          renameCustom.isPending || !editingCustomName.trim()
                        }
                        onClick={() =>
                          renameCustom.mutate({
                            id: c.id,
                            name: editingCustomName,
                            color: c.color,
                          })
                        }
                      >
                        OK
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingCustomId(c.id);
                            setEditingCustomName(c.name);
                          }}
                          aria-label={`Editar ${c.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(c.id)}
                          aria-label={`Remover ${c.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ))}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <Label className="mb-1 block text-xs">Nova categoria</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ensaio, Visita…"
                  className="h-10"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Cor</Label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value.toUpperCase())}
                  className="h-10 w-16 cursor-pointer rounded-[8px] border border-border bg-transparent p-1"
                />
              </div>
              <DialogFooter>
                <Button
                  style={{ backgroundColor: "var(--chapter-primary)" }}
                  disabled={save.isPending || !name.trim()}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({
  chapterId,
  chapterName,
  defaultDate,
  onClose,
  onCreated,
  item,
  customCategories = [],
  typeLabels,
}: {
  chapterId: string;
  chapterName: string;
  defaultDate?: string | null;
  onClose: () => void;
  onCreated: () => void;
  item?: CalendarItem | null;
  customCategories?: ChapterCalendarCategory[];
  typeLabels?: CalendarTypeLabels;
}) {
  const isEdit = Boolean(item);
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<CalendarType>(
    item?.event_type ?? "sessao_ritualistica",
  );
  const [customCategoryId, setCustomCategoryId] = useState<string>(
    item?.custom_category_id ?? "",
  );
  const [mandatory, setMandatory] = useState(item?.mandatory ?? true);
  const [publicOpen, setPublicOpen] = useState(item?.public_open ?? false);
  const [touched, setTouched] = useState(false);

  const [startAt, setStartAt] = useState<string>(() => {
    if (item) return toLocalDateTimeInput(new Date(item.start_at));
    const ymd = defaultDate ?? todayYmd();
    return toLocalDateTimeInput(appTzDateAt(ymd, 13, 30));
  });
  const [endAt, setEndAt] = useState<string>(() => {
    if (item)
      return item.end_at ? toLocalDateTimeInput(new Date(item.end_at)) : "";
    const ymd = defaultDate ?? todayYmd();
    return toLocalDateTimeInput(appTzDateAt(ymd, 17, 0));
  });

  const [location, setLocation] = useState(item?.location ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [lodgeId, setLodgeId] = useState<string>(item?.lodge_id ?? "");
  const [dressCode, setDressCode] = useState(item?.dress_code ?? "Formal");
  const [description, setDescription] = useState(item?.description ?? "");
  const [orgMandatoryDateId, setOrgMandatoryDateId] = useState<string>(
    item?.org_mandatory_date_id ?? "",
  );

  /** Sessões e eventos usam a loja patrocinadora para preencher local/endereço. */
  const usesLodge = isSessionType(type) || type === "evento";

  const lodges = useQuery({
    queryKey: ["chapter-lodges", chapterId],
    queryFn: () => listLodges({ data: { chapterId } }) as Promise<any[]>,
    enabled: Boolean(chapterId) && usesLodge,
  });

  const mandatoryDatesQ = useQuery({
    queryKey: ["mandatory-dates-chapter", chapterId],
    queryFn: () => listMandatoryDatesForChapter({ data: { chapterId } }),
    enabled: Boolean(chapterId),
  });

  function pickLodge(id: string) {
    if (id === "none") {
      setLodgeId("");
      return;
    }
    setLodgeId(id);
    const l = (lodges.data ?? []).find((x) => x.id === id);
    if (!l) return;
    setLocation(l.name ?? "");
    setAddress(l.address ?? "");
  }

  // Validação em tempo real
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Informe o título da atividade.";
    if (!startAt) e.startAt = "Informe a data e hora de início.";
    if (endAt && startAt && endAt <= startAt)
      e.endAt = "O término deve ser após o início.";
    return e;
  }, [title, startAt, endAt]);
  const showErr = (k: string) => (touched ? errors[k] : undefined);
  const isValid = Object.keys(errors).length === 0;

  const dateLabel = useMemo(() => {
    if (!startAt) return undefined;
    const d = fromAppTzDateTimeLocal(startAt);
    if (Number.isNaN(d.getTime())) return undefined;
    return (
      d.toLocaleDateString("pt-BR", {
        timeZone: APP_TIMEZONE,
        weekday: "long",
        day: "2-digit",
        month: "long",
      }) + `, às ${formatTimeInAppTz(d)}`
    );
  }, [startAt]);

  /** Gera ou complementa a descrição com IA. */
  const ai = useMutation({
    mutationFn: () =>
      composeEventDescription({
        data: {
          title: title.trim(),
          eventType: resolveTypeMeta(type, typeLabels).label,
          dressCode: dressCode || undefined,
          location: location.trim() || undefined,
          dateLabel,
          mandatory,
          publicOpen,
          current: description.trim() || undefined,
        },
      }),
    onSuccess: (r: { text: string }) => {
      setDescription(r.text);
      toast.success(
        description.trim()
          ? "Descrição complementada pela IA"
          : "Descrição gerada pela IA",
      );
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Não foi possível gerar a descrição"),
  });

  const payload = () => ({
    title: title.trim(),
    event_type: type,
    mandatory,
    public_open: publicOpen,
    start_at: fromAppTzDateTimeLocal(startAt).toISOString(),
    end_at: endAt ? fromAppTzDateTimeLocal(endAt).toISOString() : null,
    location: location.trim() || null,
    address: address.trim() || null,
    lodge_id: usesLodge ? lodgeId || null : null,
    dress_code: dressCode.trim() || null,
    description: description.trim() || null,
    custom_category_id: customCategoryId || null,
    org_mandatory_date_id: orgMandatoryDateId || null,
  });

  const m = useMutation({
    mutationFn: () =>
      isEdit
        ? updateCalendarItem({ data: { id: item!.id, ...payload() } })
        : createCalendarItem({ data: payload() }),
    onSuccess: () => {
      toast.success(isEdit ? "Item atualizado" : "Item criado");
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  function submit() {
    setTouched(true);
    const first = Object.values(errors)[0];
    if (first) {
      toast.error(first);
      return;
    }
    m.mutate();
  }

  const mandatoryDateOptions = useMemo(() => {

    const rows = mandatoryDatesQ.data ?? [];

    return [

      { value: "none", label: "Sem vínculo" },

      ...rows.map((r) => ({

        value: r.id,

        label: `${r.prazo_label} — ${r.title}`,

      })),

    ];

  }, [mandatoryDatesQ.data]);



  const identificacao = (

    <div className="space-y-3">

      {!isEdit && (

        <div>

          <Label className="mb-1 block text-xs">Capítulo</Label>

          <div className="flex h-11 items-center rounded-[8px] border border-border bg-muted px-3 text-sm font-medium text-muted-foreground">

            {chapterName}

          </div>

          <p className="mt-1 text-[11px] text-muted-foreground">

            O evento será criado no capítulo ativo do usuário. Altere o capítulo

            pelo menu lateral.

          </p>

        </div>

      )}

      <div>

        <Label className="mb-1 block text-xs">Título *</Label>

        <Input

          className="h-11"

          value={title}

          onChange={(e) => setTitle(e.target.value)}

          onBlur={() => setTouched(true)}

          placeholder="Ex: Sessão ordinária"

          aria-invalid={Boolean(showErr("title"))}

        />

        <FieldError msg={showErr("title")} />

      </div>

      <div className="grid gap-3 sm:grid-cols-2">

        <div>

          <Label className="mb-1.5 block text-xs">Tipo</Label>

          <Select

            value={type}

            onValueChange={(v) => setType(v as CalendarType)}

            disabled={type === "sindicancia"}

          >

            <SelectTrigger className="h-11">

              <SelectValue placeholder="Selecione o tipo" />

            </SelectTrigger>

            <SelectContent>

              {CALENDAR_TYPES.filter(

                (t) => t !== "sindicancia" || type === "sindicancia",

              ).map((t) => (

                <SelectItem key={t} value={t}>

                  {resolveTypeMeta(t, typeLabels).label}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>

        {customCategories.length > 0 ? (

          <div>

            <Label className="mb-1.5 block text-xs">

              Categoria personalizada

            </Label>

            <Select

              value={customCategoryId || "none"}

              onValueChange={(v) => setCustomCategoryId(v === "none" ? "" : v)}

            >

              <SelectTrigger className="h-11">

                <SelectValue placeholder="Nenhuma" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="none">Nenhuma</SelectItem>

                {customCategories.map((c) => (

                  <SelectItem key={c.id} value={c.id}>

                    {c.name}

                  </SelectItem>

                ))}

              </SelectContent>

            </Select>

          </div>

        ) : null}

      </div>

    </div>

  );



  const quandoBloco = (

    <div className="space-y-3">

      <div className="grid gap-3 sm:grid-cols-2">

        <div>

          <Label className="mb-1 block text-xs">Início *</Label>

          <Input

            type="datetime-local"

            className="h-11 w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70"

            value={startAt}

            onChange={(e) => setStartAt(e.target.value)}

            onBlur={() => setTouched(true)}

            onClick={(e) =>

              (

                e.currentTarget as HTMLInputElement & {

                  showPicker?: () => void;

                }

              ).showPicker?.()

            }

            aria-invalid={Boolean(showErr("startAt"))}

          />

          <FieldError msg={showErr("startAt")} />

        </div>

        <div>

          <Label className="mb-1 block text-xs">Término</Label>

          <Input

            type="datetime-local"

            className="h-11 w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70"

            value={endAt}

            min={startAt || undefined}

            onChange={(e) => setEndAt(e.target.value)}

            onBlur={() => setTouched(true)}

            onClick={(e) =>

              (

                e.currentTarget as HTMLInputElement & {

                  showPicker?: () => void;

                }

              ).showPicker?.()

            }

            aria-invalid={Boolean(showErr("endAt"))}

          />

          <FieldError msg={showErr("endAt")} />

        </div>

      </div>

      {durationLabel(startAt, endAt) && (
        <p className="flex items-center gap-1.5 rounded-[8px] bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Duração: {durationLabel(startAt, endAt)}
        </p>
      )}

    </div>

  );



  const ondeTraje = (

    <div className="space-y-3">

      {usesLodge && (

        <div>

          <Label className="mb-1 block text-xs">Loja patrocinadora</Label>

          <SearchableSelect

            value={lodgeId || "none"}

            onChange={pickLodge}

            placeholder={

              (lodges.data ?? []).length

                ? "Selecione a loja…"

                : "Nenhuma loja cadastrada"

            }

            searchPlaceholder="Buscar loja…"

            emptyText="Nenhuma loja encontrada."

            className="h-11"

            options={[

              { value: "none", label: "Sem loja vinculada" },

              ...(lodges.data ?? []).map((l) => ({

                value: l.id,

                label: l.is_primary ? `${l.name} · principal` : l.name,

              })),

            ]}

          />

          <p className="mt-1 text-[11px] text-muted-foreground">

            Local e endereço são preenchidos automaticamente e podem ser

            editados.

          </p>

        </div>

      )}

      <div className="grid gap-3 sm:grid-cols-2">

        <div>

          <Label className="mb-1 block text-xs">Local</Label>

          <Input

            className="h-11"

            list="cal-local-sugestoes"

            value={location}

            onChange={(e) => setLocation(e.target.value)}

            placeholder="Templo, salão…"

          />

          <datalist id="cal-local-sugestoes">

            {(lodges.data ?? []).map((l) => (

              <option key={l.id} value={l.name} />

            ))}

          </datalist>

        </div>

        <div>

          <Label className="mb-1 block text-xs">Traje</Label>

          <Select

            value={

              DRESS_CODES.includes(dressCode as (typeof DRESS_CODES)[number])

                ? dressCode

                : "Formal"

            }

            onValueChange={setDressCode}

          >

            <SelectTrigger className="h-11">

              <SelectValue placeholder="Selecione o traje" />

            </SelectTrigger>

            <SelectContent>

              {DRESS_CODES.map((d) => (

                <SelectItem key={d} value={d}>

                  {d}

                </SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>

      </div>

      <div>

        <Label className="mb-1 block text-xs">Endereço</Label>

        <Input

          className="h-11"

          value={address}

          onChange={(e) => setAddress(e.target.value)}

          placeholder="Rua, número, bairro, cidade"

        />

      </div>

    </div>

  );



  const vinculosFlags = (

    <div className="space-y-3">

      <div>

        <Label className="mb-1 block text-xs">

          Vincular à Data Obrigatória

        </Label>

        <SearchableSelect

          value={orgMandatoryDateId || "none"}

          onChange={(v) => setOrgMandatoryDateId(v === "none" ? "" : v)}

          placeholder="Opcional…"

          searchPlaceholder="Buscar data obrigatória…"

          emptyText="Nenhuma data encontrada."

          className="h-11"

          options={mandatoryDateOptions}

        />

        <p className="mt-1 text-[11px] text-muted-foreground">

          Campo opcional. Remova o vínculo escolhendo “Sem vínculo”.

        </p>

      </div>

      <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-[10px] border border-border p-3">

        <span>

          <span className="block text-xs font-medium">Obrigatório</span>

          <span className="block text-[11px] text-muted-foreground">

            Conta na frequência dos membros. Desligado, a data é facultativa.

          </span>

        </span>

        <Switch

          checked={mandatory}

          onCheckedChange={setMandatory}

          className="scale-110"

        />

      </label>

      <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-[10px] border border-border p-3">

        <span>

          <span className="block text-xs font-medium">Aberto ao público</span>

          <span className="block text-[11px] text-muted-foreground">

            Convidados e familiares podem participar.

          </span>

        </span>

        <Switch

          checked={publicOpen}

          onCheckedChange={setPublicOpen}

          className="scale-110"

        />

      </label>

    </div>

  );



  const descricaoBloco = (

    <div className="space-y-2">

      <Button

        type="button"

        size="sm"

        variant="outline"

        className="h-9 w-full text-xs sm:w-auto"

        disabled={ai.isPending || !title.trim()}

        onClick={() => ai.mutate()}

      >

        {ai.isPending ? (

          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />

        ) : (

          <Sparkles className="mr-1.5 h-3.5 w-3.5" />

        )}

        {ai.isPending

          ? "Gerando…"

          : description.trim()

            ? "Complementar com IA"

            : "Gerar com IA"}

      </Button>

      <Textarea

        value={description}

        onChange={(e) => setDescription(e.target.value)}

        rows={5}

      />

      <p className="text-[11px] text-muted-foreground">

        Com texto escrito, a IA complementa mantendo o seu conteúdo; vazio, ela

        gera a partir do título e dos dados da atividade.

      </p>

    </div>

  );



  const headerTitle = isEdit

    ? "Editar item de calendário"

    : defaultDate

      ? `Novo item · ${new Date(defaultDate + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}`

      : "Novo item de calendário";



  return (

    <DialogContent className="flex max-h-[95dvh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">

      <DialogHeader className="border-b border-border px-4 py-3 sm:px-5 sm:py-4">

        <DialogTitle className="text-left text-base">{headerTitle}</DialogTitle>

      </DialogHeader>



      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">

        {isMobile ? (

          <Accordion

            type="multiple"

            defaultValue={["ident", "quando"]}

            className="w-full"

          >

            <AccordionItem value="ident">

              <AccordionTrigger className="py-3 text-sm">

                Identificação

              </AccordionTrigger>

              <AccordionContent className="pb-4">

                {identificacao}

              </AccordionContent>

            </AccordionItem>

            <AccordionItem value="quando">

              <AccordionTrigger className="py-3 text-sm">

                Quando

              </AccordionTrigger>

              <AccordionContent className="pb-4">

                {quandoBloco}

              </AccordionContent>

            </AccordionItem>

            <AccordionItem value="onde">

              <AccordionTrigger className="py-3 text-sm">

                Onde e traje

              </AccordionTrigger>

              <AccordionContent className="pb-4">{ondeTraje}</AccordionContent>

            </AccordionItem>

            <AccordionItem value="vinculos">

              <AccordionTrigger className="py-3 text-sm">

                Vínculos e flags

              </AccordionTrigger>

              <AccordionContent className="pb-4">

                {vinculosFlags}

              </AccordionContent>

            </AccordionItem>

            <AccordionItem value="desc">

              <AccordionTrigger className="py-3 text-sm">

                Detalhes

              </AccordionTrigger>

              <AccordionContent className="pb-4">

                {descricaoBloco}

              </AccordionContent>

            </AccordionItem>

          </Accordion>

        ) : (

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              <FormSection icon={Tags} title="Identificação">
                {identificacao}
              </FormSection>
              <FormSection icon={MapPin} title="Onde e traje">
                {ondeTraje}
              </FormSection>
            </div>
            <div className="space-y-4">
              <FormSection icon={CalendarDays} title="Quando">
                {quandoBloco}
              </FormSection>
              <FormSection icon={LinkIcon} title="Vínculos e flags">
                {vinculosFlags}
              </FormSection>
            </div>
            <FormSection
              icon={Sparkles}
              title="Detalhes"
              className="md:col-span-2"
            >
              {descricaoBloco}
            </FormSection>
          </div>

        )}

      </div>



      <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-end sm:px-5">

        <Button variant="outline" className="h-11 sm:h-9" onClick={onClose}>

          Cancelar

        </Button>

        <Button

          className="h-11 sm:h-9"

          style={{ backgroundColor: "var(--chapter-primary)" }}

          disabled={m.isPending || (touched && !isValid)}

          onClick={submit}

        >

          {m.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar"}

        </Button>

      </DialogFooter>

    </DialogContent>

  );

}


