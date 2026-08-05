import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  LayoutGrid,
  List,
  PlusCircle,
  MapPin,
} from "lucide-react";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { listScopeChapters } from "@/lib/org.functions";
import {
  createCalendarItem,
  listCalendarItems,
} from "@/lib/calendar.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTimeBR } from "@/lib/format";
import {
  fromAppTzDateTimeLocal,
  toAppTzDateTimeLocal,
} from "@/lib/timezone";
import { downloadIcs } from "@/lib/ics";
import { TYPE_META, CALENDAR_TYPES, type CalendarType } from "@/lib/calendar-types";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CalendarAgendaView,
  CalendarMonthView,
  occursOnDay,
  type SharedCalendarItem,
} from "@/components/calendar/CalendarViews";

export const Route = createFileRoute(
  "/_authenticated/_shell/regional/calendario",
)({
  component: RegionalCalendar,
  head: () => ({
    meta: [
      { title: "Calendário unificado | SG-CDM" },
      {
        name: "description",
        content:
          "Agenda e calendário unificados das instituições da região ou do estado.",
      },
    ],
  }),
});

function RegionalCalendar() {
  return (
    <ScopeGuard>
      <CalendarContent />
    </ScopeGuard>
  );
}

function CalendarContent() {
  const { activeScope, canManageChapters } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const canCreate = canManageChapters;

  const [view, setView] = useState<"mes" | "agenda">(
    isMobile ? "agenda" : "mes",
  );
  const [typeFilters, setTypeFilters] = useState<Set<CalendarType>>(
    () => new Set(CALENDAR_TYPES),
  );
  const [chapterFilter, setChapterFilter] = useState<Set<string> | null>(
    null,
  );
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<SharedCalendarItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);

  const { data: chapters } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () =>
      listScopeChapters({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
  });
  const chapterList = chapters ?? [];
  const chapterIds = useMemo(
    () => chapterList.map((c) => c.id),
    [chapterList],
  );

  useEffect(() => {
    setChapterFilter(null);
  }, [scope.key]);

  const selectedChapters = useMemo(() => {
    if (chapterFilter) return chapterFilter;
    return new Set(chapterIds);
  }, [chapterFilter, chapterIds]);
  const allChaptersSelected =
    chapterIds.length > 0 &&
    chapterIds.every((id) => selectedChapters.has(id));
  const chapterFilterLabel = (() => {
    if (allChaptersSelected || selectedChapters.size === 0) {
      return "Todas as instituições";
    }
    if (selectedChapters.size === 1) {
      const id = [...selectedChapters][0];
      const c = chapterList.find((ch) => ch.id === id);
      return c ? `${c.name} · Nº ${c.number}` : "1 instituição";
    }
    return `${selectedChapters.size} instituições`;
  })();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["scope-calendar", scope.key, chapterIds.join(",")],
    queryFn: () =>
      listCalendarItems({
        data: { chapterIds },
      }) as Promise<SharedCalendarItem[]>,
    enabled: chapterIds.length > 0,
  });

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (!typeFilters.has(it.event_type)) return false;
      if (!selectedChapters.has(it.chapter_id)) return false;
      return true;
    });
  }, [items, typeFilters, selectedChapters]);

  const chapterNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of chapterList)
      m.set(c.id, `${c.name} · Nº ${c.number}`);
    return m;
  }, [chapterList]);

  function toggleType(t: CalendarType) {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleChapter(id: string) {
    setChapterFilter((prev) => {
      const base = prev ?? new Set(chapterIds);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Calendário"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label}`}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="inline-flex rounded-[8px] border border-border p-0.5">
              <button
                onClick={() => setView("mes")}
                className="flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium"
                style={
                  view === "mes"
                    ? {
                        backgroundColor: "var(--chapter-primary)",
                        color: "#fff",
                      }
                    : { color: "var(--muted-foreground)" }
                }
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Mês
              </button>
              <button
                onClick={() => setView("agenda")}
                className="flex items-center gap-1 rounded-[6px] px-2.5 py-1.5 text-xs font-medium"
                style={
                  view === "agenda"
                    ? {
                        backgroundColor: "var(--chapter-primary)",
                        color: "#fff",
                      }
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
              onClick={() =>
                downloadIcs(
                  filtered,
                  `calendario-regional`,
                  `SG-CDM · ${scope.label}`,
                )
              }
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            {canCreate && (
              <Dialog
                open={createOpen}
                onOpenChange={(o) => {
                  setCreateOpen(o);
                  if (!o) setCreateDate(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="h-9"
                    style={{ backgroundColor: "var(--chapter-primary)" }}
                    onClick={() => setCreateDate(null)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Novo
                  </Button>
                </DialogTrigger>
                <RegionalActivityDialog
                  key={createDate ?? "novo"}
                  chapters={chapterList}
                  defaultChapterId={
                    selectedChapters.size === 1
                      ? [...selectedChapters][0]
                      : (chapterList[0]?.id ?? "")
                  }
                  defaultDate={createDate}
                  onClose={() => {
                    setCreateOpen(false);
                    setCreateDate(null);
                  }}
                  onSaved={() => {
                    setCreateOpen(false);
                    setCreateDate(null);
                    qc.invalidateQueries({ queryKey: ["scope-calendar"] });
                  }}
                />
              </Dialog>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CALENDAR_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const on = typeFilters.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: on ? meta.bg : "transparent",
                color: on ? meta.color : "var(--muted-foreground)",
                borderColor: on ? meta.color : "var(--border)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
        {chapterList.length > 1 && (
          <div className="w-full sm:ml-auto sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-between text-xs sm:w-[240px]"
                >
                  <span className="truncate">{chapterFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(100vw-2rem,280px)] max-h-72 overflow-y-auto"
              >
                <DropdownMenuLabel>Filtrar instituições</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {chapterList.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={selectedChapters.has(c.id)}
                    onCheckedChange={() => toggleChapter(c.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.name} · Nº {c.number}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setChapterFilter(new Set(chapterIds))}
                >
                  Selecionar todas
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setChapterFilter(new Set())}
                  disabled={selectedChapters.size === 0}
                >
                  Limpar seleção
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : view === "mes" ? (
        <CalendarMonthView
          cursor={cursor}
          setCursor={setCursor}
          items={filtered}
          onDayClick={(key) => {
            const hasItems = filtered.some((it) => occursOnDay(it, key));
            if (canCreate && !hasItems) {
              setCreateDate(key);
              setCreateOpen(true);
              return;
            }
            setSelectedDay(key);
          }}
        />
      ) : (
        <CalendarAgendaView
          items={filtered}
          onSelect={setDetail}
          chapterNameMap={chapterNameMap}
          showChapter
        />
      )}

      <Dialog
        open={!!selectedDay}
        onOpenChange={(o) => !o && setSelectedDay(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDay &&
                new Date(selectedDay + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  },
                )}
            </DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {filtered
              .filter((it) => selectedDay && occursOnDay(it, selectedDay))
              .map((it) => (
                <li key={it.id}>
                  <button
                    className="w-full py-3 text-left hover:bg-muted"
                    onClick={() => {
                      setDetail(it);
                      setSelectedDay(null);
                    }}
                  >
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {chapterNameMap.get(it.chapter_id)}
                      {it.location ? ` · ${it.location}` : ""}
                    </div>
                  </button>
                </li>
              ))}
          </ul>
          {canCreate && selectedDay && (
            <DialogFooter>
              <Button
                className="w-full sm:w-auto"
                style={{ backgroundColor: "var(--chapter-primary)" }}
                onClick={() => {
                  setCreateDate(selectedDay);
                  setSelectedDay(null);
                  setCreateOpen(true);
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar neste dia
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <RegionalDetail
              item={detail}
              chapterName={chapterNameMap.get(detail.chapter_id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegionalDetail({
  item,
  chapterName,
}: {
  item: SharedCalendarItem;
  chapterName?: string;
}) {
  const meta = TYPE_META[item.event_type];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span>{item.title}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        {chapterName && (
          <div>
            <div className="text-xs text-muted-foreground">Instituição</div>
            <div>{chapterName}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-muted-foreground">Início</div>
          <div>{formatDateTimeBR(item.start_at)}</div>
        </div>
        {item.end_at && (
          <div>
            <div className="text-xs text-muted-foreground">Término</div>
            <div>{formatDateTimeBR(item.end_at)}</div>
          </div>
        )}
        {item.location && (
          <div>
            <div className="text-xs text-muted-foreground">Local</div>
            <div className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {item.location}
            </div>
          </div>
        )}
        {item.description && (
          <div>
            <div className="text-xs text-muted-foreground">Descrição</div>
            <div className="whitespace-pre-wrap">{item.description}</div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Edição e exclusão são feitas no calendário da própria instituição.
        </p>
      </div>
    </>
  );
}

function RegionalActivityDialog({
  chapters,
  defaultChapterId,
  defaultDate,
  onClose,
  onSaved,
}: {
  chapters: { id: string; name: string; number: string }[];
  defaultChapterId: string;
  defaultDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [chapterId, setChapterId] = useState(defaultChapterId);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarType>("sessao_ordinaria");
  const [startLocal, setStartLocal] = useState(() => {
    if (defaultDate) return `${defaultDate}T19:00`;
    return toAppTzDateTimeLocal(new Date().toISOString()).slice(0, 11) + "19:00";
  });
  const [endLocal, setEndLocal] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [publicOpen, setPublicOpen] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const start_at = fromAppTzDateTimeLocal(startLocal).toISOString();
      const end_at = endLocal
        ? fromAppTzDateTimeLocal(endLocal).toISOString()
        : null;
      return createCalendarItem({
        data: {
          chapter_id: chapterId,
          title,
          event_type: eventType,
          start_at,
          end_at,
          location: location || null,
          description: description || null,
          mandatory,
          public_open: publicOpen,
        },
      });
    },
    onSuccess: () => {
      toast.success("Atividade criada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nova atividade</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        <div>
          <Label>Instituição</Label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} Nº {c.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Tipo</Label>
          <Select
            value={eventType}
            onValueChange={(v) => setEventType(v as CalendarType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CALENDAR_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Início</Label>
          <Input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </div>
        <div>
          <Label>Término (opcional)</Label>
          <Input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
          />
        </div>
        <div>
          <Label>Local</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Obrigatório</Label>
          <Switch checked={mandatory} onCheckedChange={setMandatory} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Aberto ao público</Label>
          <Switch checked={publicOpen} onCheckedChange={setPublicOpen} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!title.trim() || !chapterId || save.isPending}
          style={{ backgroundColor: "var(--chapter-primary)" }}
          onClick={() => save.mutate()}
        >
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
