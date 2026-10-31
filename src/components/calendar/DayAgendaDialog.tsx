import { useMemo } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatTimeInAppTz, todayYmd } from "@/lib/timezone";
import {
  resolveTypeMeta,
  type CalendarType,
  type CalendarTypeLabels,
} from "@/lib/calendar-types";

export type DayAgendaItem = {
  id: string;
  chapter_id: string;
  title: string;
  event_type: CalendarType;
  mandatory: boolean;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

/** Soma `delta` dias a uma chave YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function shiftDayKey(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function dateFromKey(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type TimeState = "past" | "now" | "upcoming";

function timeState(it: DayAgendaItem, now: Date): TimeState {
  const start = new Date(it.start_at);
  const end = it.end_at ? new Date(it.end_at) : null;
  if (start > now) return "upcoming";
  if (end && end >= now) return "now";
  // Sem horário de término: considera "agora" nas 3h seguintes ao início.
  if (!end && now.getTime() - start.getTime() < 3 * 60 * 60 * 1000) return "now";
  return "past";
}

export function DayAgendaDialog({
  dayKey,
  items,
  typeLabels,
  chapterNameMap,
  showChapter,
  canCreate,
  onOpenChange,
  onNavigate,
  onSelect,
  onCreate,
  now = new Date(),
}: {
  /** YYYY-MM-DD no fuso do app; null fecha o modal. */
  dayKey: string | null;
  /** Itens que ocorrem neste dia (já filtrados). */
  items: DayAgendaItem[];
  typeLabels?: CalendarTypeLabels;
  chapterNameMap: Map<string, string>;
  showChapter: boolean;
  canCreate: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (dayKey: string) => void;
  onSelect: (item: DayAgendaItem) => void;
  onCreate: (dayKey: string) => void;
  now?: Date;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [items],
  );

  const todayKey = todayYmd(now);
  const date = dayKey ? dateFromKey(dayKey) : null;
  const weekday = date
    ? capitalize(date.toLocaleDateString("pt-BR", { weekday: "long" }))
    : "";
  const monthYear = date
    ? date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";
  const monthShort = date
    ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
    : "";
  const dayNum = dayKey ? Number(dayKey.slice(8, 10)) : 0;
  const isToday = dayKey === todayKey;
  const mandatoryCount = sorted.filter((i) => i.mandatory).length;

  const summary =
    sorted.length === 0
      ? "Nada agendado"
      : `${sorted.length} ${sorted.length === 1 ? "item" : "itens"}${
          mandatoryCount > 0
            ? `, ${mandatoryCount} ${mandatoryCount === 1 ? "obrigatório" : "obrigatórios"}`
            : ""
        }`;

  return (
    <Dialog open={!!dayKey} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 focus:outline-none sm:max-w-xl sm:rounded-[14px]
          max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-t-[18px] max-sm:border-x-0 max-sm:border-b-0
          max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100"
      >
        {dayKey && (
          <>
            <div
              aria-hidden
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden"
            />
            <DialogHeader className="shrink-0 space-y-0 border-b border-border px-5 pb-4 pt-4 text-left sm:px-6 sm:pt-6">
              <div className="flex items-center gap-4 pr-8">
                <div
                  className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[12px] leading-none text-white"
                  style={{ backgroundColor: "var(--chapter-primary)" }}
                >
                  <span className="text-[22px] font-bold tabular-nums">
                    {dayNum}
                  </span>
                  <span className="mt-1 text-[11px] font-medium opacity-85">
                    {monthShort}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    {weekday}
                    {isToday && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold dark:!bg-white/10 dark:!text-foreground"
                        style={{
                          color: "var(--chapter-primary)",
                          backgroundColor:
                            "color-mix(in srgb, var(--chapter-primary) 12%, transparent)",
                        }}
                      >
                        Hoje
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm">
                    {monthYear}
                  </DialogDescription>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {summary}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 sm:flex-none"
                  onClick={() => onNavigate(shiftDayKey(dayKey, -1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Dia anterior
                </Button>
                {!isToday && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => onNavigate(todayKey)}
                  >
                    Hoje
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 sm:ml-auto sm:flex-none"
                  onClick={() => onNavigate(shiftDayKey(dayKey, 1))}
                >
                  Próximo dia
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              {sorted.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm font-medium">
                    Nenhuma sessão ou evento neste dia.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {canCreate
                      ? "Use o botão abaixo para agendar algo."
                      : "Use as setas para ver outros dias."}
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {sorted.map((it) => (
                    <li key={it.id}>
                      <DayAgendaRow
                        item={it}
                        dayKey={dayKey}
                        typeLabels={typeLabels}
                        chapterName={
                          showChapter
                            ? chapterNameMap.get(it.chapter_id)
                            : undefined
                        }
                        state={timeState(it, now)}
                        onSelect={() => onSelect(it)}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {canCreate && (
              <div className="shrink-0 border-t border-border bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:px-6">
                <Button
                  className="w-full sm:w-auto"
                  style={{ backgroundColor: "var(--chapter-primary)" }}
                  onClick={() => onCreate(dayKey)}
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Agendar em {shortDate(dayKey)}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DayAgendaRow({
  item,
  dayKey,
  typeLabels,
  chapterName,
  state,
  onSelect,
}: {
  item: DayAgendaItem;
  dayKey: string;
  typeLabels?: CalendarTypeLabels;
  chapterName?: string;
  state: TimeState;
  onSelect: () => void;
}) {
  const meta = resolveTypeMeta(item.event_type, typeLabels);
  const startKey = todayYmd(item.start_at);
  const endKey = item.end_at ? todayYmd(item.end_at) : startKey;
  const startsBefore = startKey < dayKey;
  const endsAfter = endKey > dayKey;

  const endLabel =
    item.end_at && !endsAfter ? formatTimeInAppTz(item.end_at) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-stretch gap-3 rounded-[10px] border border-border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        state === "past" ? "opacity-70" : ""
      }`}
    >
      <div className="flex w-12 shrink-0 flex-col items-end pt-0.5 tabular-nums">
        {startsBefore ? (
          <>
            <span className="text-[11px] text-muted-foreground">desde</span>
            <span className="text-sm font-semibold">{shortDate(startKey)}</span>
          </>
        ) : (
          <span className="text-sm font-semibold">
            {formatTimeInAppTz(item.start_at)}
          </span>
        )}
        {endLabel && (
          <span className="text-xs text-muted-foreground">{endLabel}</span>
        )}
      </div>
      <span
        aria-hidden
        className="w-1 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="line-clamp-2 flex-1 text-[15px] font-medium leading-snug">
            {item.title}
          </span>
          {state === "now" && (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 motion-safe:animate-pulse" />
              Agora
            </span>
          )}
          {state === "past" && (
            <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">
              Encerrado
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              item.mandatory
                ? "border-transparent bg-foreground/[0.07] text-foreground"
                : "border-dashed border-border text-muted-foreground"
            }`}
          >
            {item.mandatory ? "Obrigatório" : "Facultativo"}
          </span>
          {endsAfter && (
            <span className="text-[11px] text-muted-foreground">
              Vai até {shortDate(endKey)}
            </span>
          )}
        </div>
        {(item.location || chapterName) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {item.location && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.location}</span>
              </span>
            )}
            {chapterName && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 shrink-0" />
                {chapterName}
              </span>
            )}
          </div>
        )}
      </div>
      <ChevronRight
        aria-hidden
        className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
