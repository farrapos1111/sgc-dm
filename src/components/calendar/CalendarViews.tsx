import { useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTimeInAppTz, todayYmd } from "@/lib/timezone";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";

export type SharedCalendarItem = {
  id: string;
  chapter_id: string;
  title: string;
  event_type: CalendarType;
  mandatory: boolean;
  public_open: boolean;
  start_at: string;
  end_at: string | null;
  location: string | null;
  address?: string | null;
  dress_code?: string | null;
  description: string | null;
};

export function toLocalDateKey(iso: string): string {
  return todayYmd(iso);
}

export function addOneDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function itemDayKeys(it: {
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

export function CalendarMonthView({
  cursor,
  setCursor,
  items,
  onDayClick,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  items: SharedCalendarItem[];
  onDayClick: (key: string) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const byDay = useMemo(() => {
    const map = new Map<string, SharedCalendarItem[]>();
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

export function CalendarAgendaView({
  items,
  onSelect,
  chapterNameMap,
  showChapter,
}: {
  items: SharedCalendarItem[];
  onSelect: (it: SharedCalendarItem) => void;
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

  const groups = new Map<string, SharedCalendarItem[]>();
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
                  {list.map((it) => {
                    const meta = TYPE_META[it.event_type];
                    const time = formatTimeInAppTz(it.start_at);
                    return (
                      <li key={it.id}>
                        <button
                          className="w-full p-4 text-left hover:bg-muted"
                          onClick={() => onSelect(it)}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-xs font-semibold"
                              style={{
                                backgroundColor: meta.bg,
                                color: meta.color,
                              }}
                            >
                              {time}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {it.title}
                                </span>
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                                  style={{
                                    backgroundColor: meta.bg,
                                    color: meta.color,
                                  }}
                                >
                                  {meta.label}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {it.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {it.location}
                                  </span>
                                )}
                                {showChapter &&
                                  chapterNameMap.get(it.chapter_id) && (
                                    <span>
                                      {chapterNameMap.get(it.chapter_id)}
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          );
        })}
    </div>
  );
}
