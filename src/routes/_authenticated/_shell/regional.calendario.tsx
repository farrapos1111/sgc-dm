import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { listScopeChapters } from "@/lib/org.functions";
import { createCalendarItem, listCalendarItems } from "@/lib/calendar.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeBR } from "@/lib/format";
import { TYPE_META, CALENDAR_TYPES, type CalendarType } from "@/lib/calendar-types";

type NewActivityPayload = {
  chapter_id: string;
  title: string;
  event_type: CalendarType;
  start_at: string;
  end_at: string | null;
  location: string | null;
  description: string | null;
  mandatory: boolean;
  public_open: boolean;
};

export const Route = createFileRoute("/_authenticated/_shell/regional/calendario")({
  component: RegionalCalendar,
  head: () => ({
    meta: [
      { title: "Calendário unificado | SG-CDM" },
      {
        name: "description",
        content: "Agenda unificada das instituições da região ou do estado, com filtro por capítulo e tipo.",
      },
      { property: "og:title", content: "Calendário unificado | SG-CDM" },
      {
        property: "og:description",
        content: "Veja sessões, eventos e filantropias de todas as instituições do escopo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { activeScope } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [types, setTypes] = useState<CalendarType[]>([...CALENDAR_TYPES]);

  const { data: chapters } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () => listScopeChapters({ data: { scopeType: scope.type, scopeId: scope.id } }),
  });

  const chapterList = chapters ?? [];
  const chapterIds = selected ?? chapterList.map((c) => c.id);

  const { data: items, isLoading } = useQuery({
    queryKey: ["scope-calendar", scope.key, chapterIds.join(",")],
    queryFn: () =>
      listCalendarItems({
        data: { chapterIds, from: new Date().toISOString() },
      }) as Promise<any[]>,
    enabled: chapterIds.length > 0,
  });

  const filtered = useMemo(
    () => (items ?? []).filter((i) => types.includes(i.event_type as CalendarType)),
    [items, types],
  );

  function toggleChapter(id: string) {
    const base = selected ?? chapterList.map((c) => c.id);
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    setSelected(next);
  }

  const create = useMutation({
    mutationFn: (payload: NewActivityPayload) => createCalendarItem({ data: payload }),
    onSuccess: () => {
      toast.success("Atividade criada");
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["scope-calendar"] });
      qc.invalidateQueries({ queryKey: ["scope-chapters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleType(t: CalendarType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendário unificado"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label}`}
        actions={
          <Button size="sm" disabled={chapterList.length === 0} onClick={() => setOpenNew(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova atividade
          </Button>
        }
      />

      <NewActivityDialog
        open={openNew}
        onOpenChange={setOpenNew}
        chapters={chapterList.map((c) => ({ id: c.id, name: c.name }))}
        saving={create.isPending}
        onSubmit={(payload) => create.mutate(payload)}
      />

      <Card className="space-y-3 rounded-[12px] p-4">
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Instituições</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selected === null ? "default" : "outline"}
              className="h-8 rounded-full text-xs"
              onClick={() => setSelected(null)}
            >
              Todas
            </Button>
            {chapterList.map((c) => {
              const on = chapterIds.includes(c.id);
              return (
                <Button
                  key={c.id}
                  size="sm"
                  variant={on ? "default" : "outline"}
                  className="h-8 rounded-full text-xs"
                  style={on ? { backgroundColor: c.primary_color || undefined } : undefined}
                  onClick={() => toggleChapter(c.id)}
                >
                  {c.name}
                </Button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Tipos</div>
          <div className="flex flex-wrap gap-2">
            {CALENDAR_TYPES.map((t) => {
              const on = types.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className="min-h-[32px] rounded-full px-3 text-xs font-medium transition-opacity"
                  style={{
                    backgroundColor: TYPE_META[t].bg,
                    color: TYPE_META[t].color,
                    opacity: on ? 1 : 0.4,
                  }}
                >
                  {TYPE_META[t].label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando agenda…</div>}

      {!isLoading && filtered.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma atividade futura nas instituições selecionadas.
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((item) => {
          const chapter = chapterList.find((c) => c.id === item.chapter_id);
          const meta = TYPE_META[item.event_type as CalendarType];
          return (
            <Card key={item.id} className="rounded-[12px] p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chapter?.primary_color || meta.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTimeBR(item.start_at)}
                    {chapter ? ` · ${chapter.name}` : ""}
                    {item.location ? ` · ${item.location}` : ""}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewActivityDialog({
  open,
  onOpenChange,
  chapters,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chapters: { id: string; name: string }[];
  saving: boolean;
  onSubmit: (payload: NewActivityPayload) => void;
}) {
  const [chapterId, setChapterId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarType>("evento");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("13:30");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [publicOpen, setPublicOpen] = useState(false);

  const valid = chapterId && title.trim().length > 0 && date;

  function submit() {
    if (!valid) return;
    onSubmit({
      chapter_id: chapterId,
      title: title.trim(),
      event_type: type,
      start_at: new Date(`${date}T${startTime}:00`).toISOString(),
      end_at: endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null,
      location: location.trim() || null,
      description: description.trim() || null,
      mandatory,
      public_open: publicOpen,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova atividade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Instituição</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instituição" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ev-title">Título</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as CalendarType)}>
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="ev-date">Data</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ev-start">Início</Label>
              <Input
                id="ev-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ev-end">Término</Label>
              <Input
                id="ev-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ev-loc">Local</Label>
            <Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ev-desc">Descrição</Label>
            <Input
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={mandatory} onCheckedChange={setMandatory} /> Obrigatório
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={publicOpen} onCheckedChange={setPublicOpen} /> Aberto ao público
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valid || saving} onClick={submit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
