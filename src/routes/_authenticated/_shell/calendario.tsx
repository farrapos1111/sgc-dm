import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  listCalendarItems,
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from "@/lib/calendar.functions";
import { listLodges } from "@/lib/chapter.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CalendarDays,
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
  Loader2,
} from "lucide-react";
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
import { resolveCalendarChaveText } from "@/lib/resolve-calendar-chave";
import {
  TYPE_META,
  CALENDAR_TYPES,
  isSessionType,
  type CalendarType,
} from "@/lib/calendar-types";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/_shell/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — SG-CDM" },
      {
        name: "description",
        content:
          "Calendário unificado de sessões, eventos e filantropia do capítulo.",
      },
    ],
  }),
  component: CalendarioPage,
});

type CalendarItem = {
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
  created_by: string | null;
  created_at: string;
};

const ADMIN_ROLES = new Set([
  "mestre_conselheiro",
  "escrivao",
  "admin_total",
  "consultor",
  "presidente_conselho",
]);

const itemsQO = (chapterIds: string[]) =>
  queryOptions({
    queryKey: ["calendar", chapterIds.join(",")],
    queryFn: () =>
      listCalendarItems({ data: { chapterIds } }) as Promise<CalendarItem[]>,
    enabled: chapterIds.length > 0,
  });

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

function occursOnDay(
  it: { start_at: string; end_at: string | null },
  key: string,
) {
  return itemDayKeys(it).includes(key);
}

function CalendarioPage() {
  const { active, memberships } = useActiveChapter();
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const [view, setView] = useState<"mes" | "agenda">(
    isMobile ? "agenda" : "mes",
  );
  const [typeFilters, setTypeFilters] = useState<Set<CalendarType>>(
    new Set(CALENDAR_TYPES),
  );
  const [chapterFilter, setChapterFilter] = useState<string>("all");
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

  const chapterIds = useMemo(
    () => memberships.map((m) => m.chapter_id),
    [memberships],
  );
  const { data: items } = useSuspenseQuery(itemsQO(chapterIds));

  const canCreate = active ? ADMIN_ROLES.has(active.role.name) : false;

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (!typeFilters.has(it.event_type)) return false;
      if (chapterFilter !== "all" && it.chapter_id !== chapterFilter)
        return false;
      return true;
    });
  }, [items, typeFilters, chapterFilter]);

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

  return (
    <div>
      <PageHeader
        title="Calendário"
        subtitle="Sessões, eventos e ações de filantropia em uma visão única."
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
                downloadIcs(filtered, `calendario-sgcdm`, "SG-CDM · Calendário")
              }
              title="Baixar .ics para Google Agenda, Apple, Outlook ou Teams"
            >
              <Download className="h-4 w-4 sm:mr-2" />{" "}
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
                <CreateDialog
                  key={createDate ?? "novo"}
                  chapterId={active?.chapter_id ?? ""}
                  chapterName={
                    active
                      ? `${active.chapter.name} · Nº ${active.chapter.number}`
                      : ""
                  }
                  defaultDate={createDate}
                  onClose={() => setCreateOpen(false)}
                  onCreated={() => {
                    setCreateOpen(false);
                    setCreateDate(null);
                    qc.invalidateQueries({ queryKey: ["calendar"] });
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
        {memberships.length > 1 && (
          <div className="w-full sm:ml-auto sm:w-auto">
            <Select value={chapterFilter} onValueChange={setChapterFilter}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[220px]">
                <SelectValue placeholder="Capítulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os capítulos</SelectItem>
                {memberships.map((m) => (
                  <SelectItem key={m.chapter_id} value={m.chapter_id}>
                    {m.chapter.name} · Nº {m.chapter.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {view === "mes" ? (
        <MonthView
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
        <AgendaView
          items={filtered}
          onSelect={setDetail}
          chapterNameMap={chapterNameMap}
          showChapter={memberships.length > 1}
        />
      )}

      {/* Day list dialog (month view) */}
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
          <ul className="space-y-2">
            {selectedDay &&
              filtered.filter((it) => occursOnDay(it, selectedDay)).length ===
                0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhum item neste dia.
                </li>
              )}
            {selectedDay &&
              filtered
                .filter((it) => occursOnDay(it, selectedDay))
                .sort((a, b) => a.start_at.localeCompare(b.start_at))
                .map((it) => (
                  <li key={it.id}>
                    <button
                      className="w-full rounded-[8px] border border-border p-3 text-left hover:bg-muted"
                      onClick={() => {
                        setDetail(it);
                        setSelectedDay(null);
                      }}
                    >
                      <ItemRow
                        item={it}
                        chapterName={chapterNameMap.get(it.chapter_id)}
                        showChapter={memberships.length > 1}
                      />
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <DetailContent
              item={detail}
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
            onClose={() => setEditItem(null)}
            onCreated={() => {
              setEditItem(null);
              qc.invalidateQueries({ queryKey: ["calendar"] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function MonthView({
  cursor,
  setCursor,
  items,
  onDayClick,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  items: CalendarItem[];
  onDayClick: (key: string) => void;
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

  return (
    <Card className="rounded-[12px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold capitalize">{monthLabel}</div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Hoje
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - startWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
          if (!inMonth)
            return (
              <div
                key={idx}
                className="min-h-[64px] rounded-[6px] bg-transparent lg:min-h-[96px]"
              />
            );
          const date = new Date(year, month, dayNum);
          const key = toLocalDateKey(date.toISOString());
          const dayItems = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const visible = dayItems.slice(0, 3);
          const extra = dayItems.length - visible.length;
          return (
            <button
              key={idx}
              onClick={() => onDayClick(key)}
              className="flex min-h-[64px] flex-col rounded-[6px] border border-border p-1 text-left transition-colors hover:bg-muted lg:min-h-[96px]"
              style={
                isToday ? { borderColor: "var(--chapter-primary)" } : undefined
              }
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-xs font-semibold"
                  style={
                    isToday ? { color: "var(--chapter-primary)" } : undefined
                  }
                >
                  {dayNum}
                </span>
                <div className="flex gap-0.5 lg:hidden">
                  {Array.from(new Set(dayItems.map((i) => i.event_type))).map(
                    (t) => (
                      <span
                        key={t}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: TYPE_META[t].color }}
                      />
                    ),
                  )}
                </div>
              </div>
              <div className="hidden flex-col gap-0.5 lg:flex">
                {visible.map((it) => (
                  <span
                    key={it.id}
                    className="truncate rounded px-1 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: TYPE_META[it.event_type].bg,
                      color: TYPE_META[it.event_type].color,
                    }}
                  >
                    {formatTimeInAppTz(it.start_at)} {it.title}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{extra} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function AgendaView({
  items,
  onSelect,
  chapterNameMap,
  showChapter,
}: {
  items: CalendarItem[];
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
      <Card className="rounded-[12px] p-10 text-center">
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
              <Card className="rounded-[12px] p-0">
                <ul className="divide-y divide-border">
                  {list.map((it) => (
                    <li key={it.id}>
                      <button
                        className="w-full p-4 text-left hover:bg-muted"
                        onClick={() => onSelect(it)}
                      >
                        <ItemRow
                          item={it}
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
  chapterName,
  showChapter,
}: {
  item: CalendarItem;
  chapterName?: string;
  showChapter: boolean;
}) {
  const meta = TYPE_META[item.event_type];
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
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
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
  chapterName,
  showChapter,
  canDelete,
  onDeleted,
  onEdit,
}: {
  item: CalendarItem;
  chapterName?: string;
  showChapter: boolean;
  canDelete: boolean;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const meta = TYPE_META[item.event_type];
  const { active: activeChapter } = useActiveChapter();
  const del = useMutation({
    mutationFn: () => deleteCalendarItem({ data: { id: item.id } }),
    onSuccess: () => {
      toast.success("Item excluído");
      onDeleted();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
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
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}
            >
              Aberto ao público
            </span>
          )}
          <span>{item.title}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
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
            <div>{item.location}</div>
          </div>
        )}
        {item.dress_code && (
          <div>
            <div className="text-xs text-muted-foreground">Traje</div>
            <div>{item.dress_code}</div>
          </div>
        )}
        {item.address && (
          <div>
            <div className="text-xs text-muted-foreground">Endereço</div>
            <div>{item.address}</div>
          </div>
        )}
        {showChapter && chapterName && (
          <div>
            <div className="text-xs text-muted-foreground">Capítulo</div>
            <div>{chapterName}</div>
          </div>
        )}
        {item.description && (
          <div>
            <div className="text-xs text-muted-foreground">Descrição</div>
            <div className="whitespace-pre-wrap">{item.description}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const isSindicancia = item.event_type === "sindicancia";
                const text = await resolveCalendarChaveText(
                  item,
                  activeChapter?.chapter,
                );
                await navigator.clipboard.writeText(text);
                toast.success(
                  isSindicancia
                    ? "Chave de sindicância copiada!"
                    : "Chave do dia copiada!",
                );
              } catch (e: unknown) {
                toast.error(
                  e instanceof Error ? e.message : "Não foi possível copiar.",
                );
              }
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />{" "}
            {item.event_type === "sindicancia"
              ? "Chave de sindicância"
              : "Chave do dia"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={googleCalendarUrl(item)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Google Agenda
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={outlookCalendarUrl(item)} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Outlook / Teams
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadIcs([item], item.title)}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> .ics (Apple)
          </Button>
        </div>
        {item.related_event_id && (
          <Link
            to="/eventos/$id"
            params={{ id: item.related_event_id }}
            className="inline-flex items-center gap-1 text-sm font-medium"
            style={{ color: "var(--chapter-primary)" }}
          >
            <LinkIcon className="h-4 w-4" /> Ver evento
          </Link>
        )}
        {canDelete && (
          <div>
            <Link
              to="/ongoing/$id"
              params={{ id: item.id }}
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: "var(--chapter-primary)" }}
            >
              <LinkIcon className="h-4 w-4" /> Abrir chamada e ata
            </Link>
          </div>
        )}
      </div>
      {canDelete && (
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => del.mutate()}
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
    </>
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

function CreateDialog({
  chapterId,
  chapterName,
  defaultDate,
  onClose,
  onCreated,
  item,
}: {
  chapterId: string;
  chapterName: string;
  defaultDate?: string | null;
  onClose: () => void;
  onCreated: () => void;
  item?: CalendarItem | null;
}) {
  const isEdit = Boolean(item);
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(item?.title ?? "");
  const [type, setType] = useState<CalendarType>(
    item?.event_type ?? "sessao_ritualistica",
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

  /** Sessões e eventos usam a loja patrocinadora para preencher local/endereço. */
  const usesLodge = isSessionType(type) || type === "evento";

  const lodges = useQuery({
    queryKey: ["chapter-lodges", chapterId],
    queryFn: () => listLodges({ data: { chapterId } }) as Promise<any[]>,
    enabled: Boolean(chapterId) && usesLodge,
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
          eventType: TYPE_META[type].label,
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

  const identificacao = (
    <div className="space-y-3">
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
      <div>
        <Label className="mb-1.5 block text-xs">Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as CalendarType)}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {CALENDAR_TYPES.filter((t) => t !== "sindicancia").map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs">Traje</Label>
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
  );

  const dataControle = (
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
      <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-[10px] border border-border p-3">
        <span>
          <span className="block text-xs font-medium">Obrigatório</span>
          <span className="block text-[11px] text-muted-foreground">
            Conta na frequência dos membros.
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

  const localBloco = (
    <div className="space-y-3">
      {usesLodge && (
        <div>
          <Label className="mb-1 block text-xs">Loja patrocinadora</Label>
          <Select value={lodgeId || "none"} onValueChange={pickLodge}>
            <SelectTrigger className="h-11">
              <SelectValue
                placeholder={
                  (lodges.data ?? []).length
                    ? "Selecione a loja…"
                    : "Nenhuma loja cadastrada"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem loja vinculada</SelectItem>
              {(lodges.data ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                  {l.is_primary ? " · principal" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Local e endereço são preenchidos automaticamente e podem ser
            editados.
          </p>
        </div>
      )}
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
            defaultValue={["ident", "data"]}
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
            <AccordionItem value="data">
              <AccordionTrigger className="py-3 text-sm">
                Data e controle
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {dataControle}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="local">
              <AccordionTrigger className="py-3 text-sm">
                Local
              </AccordionTrigger>
              <AccordionContent className="pb-4">{localBloco}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="desc">
              <AccordionTrigger className="py-3 text-sm">
                Descrição
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {descricaoBloco}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : (
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <section className="space-y-3">
              <SectionTitle>Identificação</SectionTitle>
              {identificacao}
            </section>
            <section className="space-y-3">
              <SectionTitle>Data e controle</SectionTitle>
              {dataControle}
            </section>
            <section className="space-y-3">
              <SectionTitle>Local</SectionTitle>
              {localBloco}
            </section>
            <section className="space-y-3">
              <SectionTitle>Descrição</SectionTitle>
              {descricaoBloco}
            </section>
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
