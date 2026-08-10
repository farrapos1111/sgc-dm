import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  getEvent,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  sellTicket,
  createTable,
  deleteTable,
  deleteEvent,
  updateEvent,
  updateEventArtwork,
  updateSoldTicketType,
} from "@/lib/events.functions";
import {
  deleteEventTicket,
  getEventFinanceTotals,
} from "@/lib/event-finance.functions";
import { listChargeMembers } from "@/lib/finance.functions";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatEventFinanceHint } from "@/lib/event-finance-export";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ChevronDown,
  ImagePlus,
  Pencil,
  PlusCircle,
  Search,
  ShoppingBag,
  Ticket,
  Trash2,
} from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { matchesLooseSearch } from "@/lib/utils";
import {
  eventDisplayStatusLabel,
  isEventFinanceOpen,
} from "@/lib/event-lifecycle";
import {
  fromAppTzDateTimeLocal,
  toAppTzDateTimeLocal,
} from "@/lib/timezone";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TicketPass } from "@/components/events/TicketPass";
import { EventFinancePanel } from "@/components/events/EventFinancePanel";
import { TicketComandaButton } from "@/components/events/TicketComandaDialog";
import {
  EVENT_ARTWORK_BUCKET,
  buildTicketEmailPayload,
  buildTicketPassData,
  ticketQrDataUrl,
  useEventArtwork,
  type TicketPassData,
} from "@/lib/ticket-pass";

export const Route = createFileRoute("/_authenticated/_shell/eventos/$id")({
  head: () => ({ meta: [{ title: "Evento — Templo Virtual" }] }),
  component: EventoDetalhe,
});

const eventQO = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: () => getEvent({ data: { id } }),
  });

type EventDetail = Awaited<ReturnType<typeof getEvent>>;
type EventTicket = EventDetail["tickets"][number];
type EventTicketType = EventDetail["ticketTypes"][number];
type EventTable = EventDetail["tables"][number];
type EventSeat = EventDetail["seats"][number];

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function EventoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const { can: canPerm, canDo, canScreen } = useChapterAccess();
  const { data } = useSuspenseQuery(eventQO(id));
  const artworkUrl = useEventArtwork(data.event.ticket_artwork_url);

  const financeTotalsQ = useQuery({
    queryKey: ["event-finance-totals", id, "", ""],
    queryFn: () =>
      getEventFinanceTotals({
        data: { eventId: id, from: null, until: null },
      }),
  });

  const ticketsRaised = useMemo(
    () =>
      data.tickets
        .filter((t) => t.status !== "cancelado")
        .reduce((s, t) => s + Number(t.price_paid ?? 0), 0),
    [data.tickets],
  );
  const raised = financeTotalsQ.data?.totalIncome ?? ticketsRaised;
  const raisedHint =
    financeTotalsQ.data != null
      ? formatEventFinanceHint(financeTotalsQ.data)
      : null;
  const pct =
    data.event.goal_amount > 0
      ? Math.min(100, (raised / Number(data.event.goal_amount)) * 100)
      : 0;
  const [tab, setTab] = useState("resumo");
  const canDelete = canDo("eventos.manage");
  const canManageTickets = canDo("eventos.manage");
  const canEditEvent =
    canDo("eventos.manage") ||
    canPerm("admin") ||
    canScreen("eventos", "edit");
  const financeWindowOpen = isEventFinanceOpen(
    data.event.starts_at,
    data.event.status,
  );
  const canEditFinance =
    financeWindowOpen &&
    (canPerm("admin") ||
      canPerm("tesouraria") ||
      canPerm("comissoes") ||
      canDo("eventos.orcamento"));
  const statusLabel = eventDisplayStatusLabel(
    data.event.starts_at,
    data.event.status,
  );

  const remove = useMutation({
    mutationFn: () => deleteEvent({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Evento “${r.name}” excluído`);
      void qc.invalidateQueries({ queryKey: ["events"] });
      navigate({ to: "/eventos" });
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  const eventMeta = {
    name: data.event.name,
    starts_at: data.event.starts_at,
    location: data.event.location,
  };

  return (
    <div>
      <PageHeader
        title={data.event.name}
        subtitle={`${formatDateTimeBR(data.event.starts_at)}${data.event.location ? ` · ${data.event.location}` : ""} · ${statusLabel}${financeWindowOpen ? "" : " · caixa encerrado"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={remove.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {remove.isPending ? "Excluindo…" : "Excluir"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso remove o evento “{data.event.name}”, ingressos, mesas
                      e check-ins. Não dá para desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        remove.mutate();
                      }}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/eventos" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1">
          <TabsTrigger value="resumo" className="shrink-0">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="ingressos" className="shrink-0">
            Ingressos
          </TabsTrigger>
          <TabsTrigger value="mesas" className="shrink-0">
            <span className="sm:hidden">Mesas</span>
            <span className="hidden sm:inline">Mapa de mesas</span>
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="shrink-0">
            Financeiro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              className="text-left"
              onClick={() => setTab("financeiro")}
            >
              <Card className="rounded-[12px] p-5 transition-colors hover:bg-muted/40">
                <div className="text-sm text-muted-foreground">Arrecadação</div>
                <div className="mt-1 text-2xl font-bold">
                  {formatBRL(raised)}
                </div>
                {raisedHint && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {raisedHint}
                  </div>
                )}
                {data.event.goal_amount > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% da meta</span>
                      <span>
                        Meta: {formatBRL(Number(data.event.goal_amount))}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline">
                  Ver financeiro →
                </div>
              </Card>
            </button>
            <Card className="rounded-[12px] p-5">
              <div className="text-sm text-muted-foreground">Ingressos</div>
              <div className="mt-1 text-2xl font-bold">
                {data.tickets.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.checkins.length} check-ins realizados
              </div>
            </Card>
            <TicketArtworkCard
              eventId={id}
              chapterId={data.event.chapter_id}
              artworkPath={data.event.ticket_artwork_url}
              artworkUrl={artworkUrl}
              primary={active?.chapter.primary_color}
              onChanged={() =>
                qc.invalidateQueries({ queryKey: ["event", id] })
              }
            />
            <EventDetailsCard
              event={data.event}
              canEdit={canEditEvent}
              primary={active?.chapter.primary_color}
              displayStatusLabel={statusLabel}
              onSaved={() => {
                void qc.invalidateQueries({ queryKey: ["event", id] });
                void qc.invalidateQueries({ queryKey: ["events"] });
                void qc.invalidateQueries({ queryKey: ["cash-categories"] });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="ingressos">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
            <TicketsList
              eventId={id}
              tickets={data.tickets}
              types={data.ticketTypes}
              event={eventMeta}
              artworkUrl={artworkUrl}
              primary={active?.chapter.primary_color}
              canEditComanda={canEditFinance}
              canManageTickets={canManageTickets}
            />
            <div className="space-y-4">
              <TicketTypesCard
                eventId={id}
                types={data.ticketTypes}
                tickets={data.tickets}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["event", id] });
                  qc.invalidateQueries({
                    queryKey: ["event-finance", id],
                  });
                  qc.invalidateQueries({
                    queryKey: ["event-finance-totals", id],
                  });
                }}
              />
              <SellTicketCard
                eventId={id}
                chapterId={data.event.chapter_id}
                event={eventMeta}
                types={data.ticketTypes}
                artworkUrl={artworkUrl}
                primary={active?.chapter.primary_color}
                onSold={() => {
                  qc.invalidateQueries({ queryKey: ["event", id] });
                  qc.invalidateQueries({
                    queryKey: ["event-finance", id],
                  });
                  qc.invalidateQueries({
                    queryKey: ["event-finance-totals", id],
                  });
                  qc.invalidateQueries({ queryKey: ["member-charges"] });
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financeiro">
          <EventFinancePanel
            eventId={id}
            chapterId={data.event.chapter_id}
            eventName={data.event.name}
            eventStartsAt={data.event.starts_at}
            primary={active?.chapter.primary_color}
            canEdit={canEditFinance}
            chapterName={
              active
                ? `${active.chapter.name} nº ${active.chapter.number}`
                : undefined
            }
            chapterCity={active?.chapter.city}
            logoPath={
              (active?.chapter as { logo_url?: string | null } | undefined)
                ?.logo_url ?? null
            }
            tickets={data.tickets}
            ticketTypes={data.ticketTypes}
          />
        </TabsContent>

        <TabsContent value="mesas">
          <TablesMap
            eventId={id}
            tables={data.tables}
            seats={data.seats}
            primary={active?.chapter.primary_color}
            onChanged={() => qc.invalidateQueries({ queryKey: ["event", id] })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const ARTWORK_MAX_BYTES = 5 * 1024 * 1024;

type EventEditFields = {
  id: string;
  chapter_id: string;
  name: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  goal_amount: number;
  status: string;
};

function EventDetailsCard({
  event,
  canEdit,
  primary,
  displayStatusLabel,
  onSaved,
}: {
  event: EventEditFields;
  canEdit: boolean;
  primary?: string;
  displayStatusLabel: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: event.name,
    description: event.description ?? "",
    location: event.location ?? "",
    starts_at: toAppTzDateTimeLocal(event.starts_at),
    ends_at: event.ends_at ? toAppTzDateTimeLocal(event.ends_at) : "",
    goal_amount: Number(event.goal_amount) || 0,
    status: (["rascunho", "publicado", "encerrado"].includes(event.status)
      ? event.status
      : "rascunho") as "rascunho" | "publicado" | "encerrado",
  });

  useEffect(() => {
    if (editing) return;
    setForm({
      name: event.name,
      description: event.description ?? "",
      location: event.location ?? "",
      starts_at: toAppTzDateTimeLocal(event.starts_at),
      ends_at: event.ends_at ? toAppTzDateTimeLocal(event.ends_at) : "",
      goal_amount: Number(event.goal_amount) || 0,
      status: (["rascunho", "publicado", "encerrado"].includes(event.status)
        ? event.status
        : "rascunho") as "rascunho" | "publicado" | "encerrado",
    });
  }, [event, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.starts_at) {
        throw new Error("Preencha nome e data de início");
      }
      const starts = fromAppTzDateTimeLocal(form.starts_at);
      if (Number.isNaN(starts.getTime())) {
        throw new Error("Data de início inválida");
      }
      let endsIso: string | null = null;
      if (form.ends_at) {
        const ends = fromAppTzDateTimeLocal(form.ends_at);
        if (Number.isNaN(ends.getTime())) {
          throw new Error("Data de término inválida");
        }
        endsIso = ends.toISOString();
      }
      return updateEvent({
        data: {
          id: event.id,
          chapterId: event.chapter_id,
          name: form.name.trim(),
          description: form.description,
          location: form.location,
          starts_at: starts.toISOString(),
          ends_at: endsIso,
          goal_amount: Number(form.goal_amount) || 0,
          status: form.status,
        },
      });
    },
    onSuccess: () => {
      toast.success("Evento atualizado");
      setEditing(false);
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao salvar")),
  });

  const statusDbLabel =
    event.status === "publicado"
      ? "Publicado"
      : event.status === "encerrado"
        ? "Encerrado"
        : "Rascunho";

  if (!editing) {
    return (
      <Card className="rounded-[12px] p-5 space-y-3 md:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Informações</div>
            <div className="mt-1 text-lg font-semibold">{event.name}</div>
          </div>
          {canEdit ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Status: </span>
            {displayStatusLabel}
            <span className="text-muted-foreground">
              {" "}
              (cadastro: {statusDbLabel})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Meta: </span>
            {formatBRL(Number(event.goal_amount) || 0)}
          </div>
          <div>
            <span className="text-muted-foreground">Início: </span>
            {formatDateTimeBR(event.starts_at)}
          </div>
          <div>
            <span className="text-muted-foreground">Término: </span>
            {event.ends_at ? formatDateTimeBR(event.ends_at) : "—"}
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Local: </span>
            {event.location?.trim() || "—"}
          </div>
        </div>
        {event.description?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {event.description}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="rounded-[12px] p-5 space-y-4 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">Editar evento</div>
        <Button
          size="sm"
          variant="ghost"
          disabled={save.isPending}
          onClick={() => setEditing(false)}
        >
          Cancelar
        </Button>
      </div>
      <div>
        <Label className="mb-1.5 block text-sm">Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-sm">Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-sm">Local</Label>
          <Input
            value={form.location}
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Meta (R$)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.goal_amount}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                goal_amount: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Início *</Label>
          <Input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, starts_at: e.target.value }))
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Término</Label>
          <Input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) =>
              setForm((f) => ({ ...f, ends_at: e.target.value }))
            }
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) =>
              setForm((f) => ({
                ...f,
                status: v as "rascunho" | "publicado" | "encerrado",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="publicado">Publicado</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            “Fechado” na lista aparece automaticamente 30 dias após o início,
            mesmo com status Publicado.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          style={primary ? { backgroundColor: primary } : undefined}
        >
          {save.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}

function TicketArtworkCard({
  eventId,
  chapterId,
  artworkPath,
  artworkUrl,
  primary,
  onChanged,
}: {
  eventId: string;
  chapterId: string;
  artworkPath: string | null;
  artworkUrl: string | null;
  primary?: string;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > ARTWORK_MAX_BYTES) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${chapterId}/${eventId}/artwork-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from(EVENT_ARTWORK_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;

      await updateEventArtwork({
        data: { event_id: eventId, ticket_artwork_url: path },
      });
      if (artworkPath) {
        await supabase.storage.from(EVENT_ARTWORK_BUCKET).remove([artworkPath]);
      }
      toast.success("Arte do ingresso atualizada");
      onChanged();
    } catch (e: unknown) {
      toast.error(mutationErrorMessage(e, "Erro ao enviar a arte"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeArtwork() {
    setBusy(true);
    try {
      await updateEventArtwork({
        data: { event_id: eventId, ticket_artwork_url: null },
      });
      if (artworkPath) {
        await supabase.storage.from(EVENT_ARTWORK_BUCKET).remove([artworkPath]);
      }
      toast.success("Arte removida");
      onChanged();
    } catch (e: unknown) {
      toast.error(mutationErrorMessage(e, "Erro ao remover"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-[12px] overflow-hidden md:col-span-2">
      <div
        className="relative h-36 bg-cover bg-center"
        style={{
          backgroundImage: artworkUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.55)), url(${artworkUrl})`
            : `linear-gradient(145deg, ${primary || "hsl(var(--primary))"} 0%, color-mix(in srgb, ${primary || "hsl(var(--primary))"} 50%, #111) 100%)`,
        }}
      >
        <div className="absolute inset-0 flex items-end p-4">
          <div className="text-white">
            <div className="text-xs uppercase tracking-wide text-white/80">
              Arte do ingresso
            </div>
            <div className="text-sm font-medium">
              {artworkUrl
                ? "Imagem de fundo personalizada"
                : "Sem imagem — usando a cor do capítulo"}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          {busy ? "Enviando…" : artworkUrl ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {artworkUrl ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void removeArtwork()}
          >
            Remover
          </Button>
        ) : null}
        <p className="w-full text-xs text-muted-foreground">
          Recomendado: 1200×600 px. Aparece no topo do ingresso (estilo
          Sympla).
        </p>
      </div>
    </Card>
  );
}

function notifyTicketEmailSoon(pass: TicketPassData) {
  const payload = buildTicketEmailPayload(pass);
  if (!payload) {
    toast.error("Este ingresso não tem e-mail do comprador");
    return;
  }
  toast.info(
    `Envio por e-mail em breve — destino: ${payload.to}`,
  );
}

function TicketsList({
  eventId,
  tickets,
  types,
  event,
  artworkUrl,
  primary,
  canEditComanda,
  canManageTickets,
}: {
  eventId: string;
  tickets: EventTicket[];
  types: EventTicketType[];
  event: { name: string; starts_at: string; location: string | null };
  artworkUrl: string | null;
  primary?: string;
  canEditComanda?: boolean;
  /** MC ou presidente da Com. Eventos: trocar tipo / excluir ingresso. */
  canManageTickets?: boolean;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const typeMap = useMemo(
    () => new Map(types.map((t) => [t.id, t.name])),
    [types],
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "presente" | "ausente" | "pago" | "parcial" | "aberto"
  >("all");
  const [preview, setPreview] = useState<{
    pass: TicketPassData;
    qrDataUrl: string;
  } | null>(null);

  const statusCounts = useMemo(() => {
    let presente = 0;
    let ausente = 0;
    let pago = 0;
    let parcial = 0;
    let aberto = 0;
    for (const t of tickets) {
      if (t.status === "cancelado") continue;
      if (t.checked_in) presente += 1;
      else ausente += 1;
      if (t.settlement === "paid") pago += 1;
      else if (t.settlement === "partial") parcial += 1;
      else aberto += 1;
    }
    return { presente, ausente, pago, parcial, aberto };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter === "presente" && !t.checked_in) return false;
      if (statusFilter === "ausente" && t.checked_in) return false;
      if (statusFilter === "pago" && t.settlement !== "paid") return false;
      if (statusFilter === "parcial" && t.settlement !== "partial") return false;
      if (
        statusFilter === "aberto" &&
        (t.settlement === "paid" || t.settlement === "partial")
      )
        return false;
      const typeName =
        (t.ticket_type_id ? typeMap.get(t.ticket_type_id) : undefined) ??
        "Avulso";
      const statusParts = [
        t.status,
        t.checked_in ? "checkin presente" : "sem checkin",
        t.settlement === "paid"
          ? "paga pago quitado"
          : t.settlement === "partial"
            ? "parcial parcialmente pago"
            : "em aberto pendente",
      ];
      const haystack = [
        t.buyer_name,
        t.seller_name ?? "",
        typeName,
        ...statusParts,
      ].join(" ");
      return matchesLooseSearch(haystack, search);
    });
  }, [tickets, search, typeMap, statusFilter]);

  const removeTicket = useMutation({
    mutationFn: (ticketId: string) =>
      deleteEventTicket({ data: { ticketId } }),
    onSuccess: (res) => {
      toast.success(
        res.comanda_items_removed > 0
          ? `Ingresso excluído · ${res.comanda_items_removed} item(ns) da comanda removido(s)`
          : "Ingresso excluído",
      );
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["event-ticket-items", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance-totals", eventId] });
      qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao excluir ingresso")),
  });

  const changeType = useMutation({
    mutationFn: (input: {
      ticketId: string;
      ticketTypeId: string | null;
      pricePaid?: number;
    }) =>
      updateSoldTicketType({
        data: {
          ticketId: input.ticketId,
          ticketTypeId: input.ticketTypeId,
          pricePaid: input.pricePaid,
        },
      }),
    onSuccess: () => {
      toast.success("Tipo de ingresso atualizado");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance-totals", eventId] });
      qc.invalidateQueries({ queryKey: ["member-charges"] });
      qc.invalidateQueries({ queryKey: ["comanda-checkout", eventId] });
      qc.invalidateQueries({ queryKey: ["checkin-tickets"] });
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao alterar tipo")),
  });

  async function showQr(ticket: EventTicket) {
    if (!ticket.qr_code) {
      toast.error("Ingresso sem QR code");
      return;
    }
    const typeName = ticket.ticket_type_id
      ? typeMap.get(ticket.ticket_type_id)
      : null;
    const pass = buildTicketPassData({
      event,
      ticket,
      ticketTypeName: typeName,
      artworkUrl,
      primaryColor: primary,
    });
    const url = await ticketQrDataUrl(ticket.qr_code, ticket.buyer_name);
    setPreview({ pass, qrDataUrl: url });
  }

  return (
    <>
    <Card className="rounded-[12px] p-0">
      <div className="border-b border-border p-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, vendedor, tipo ou status…"
            className="pl-9"
            aria-label="Buscar ingressos"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["presente", `Presentes (${statusCounts.presente})`],
              ["ausente", `Ausentes (${statusCounts.ausente})`],
              ["pago", `Pagos (${statusCounts.pago})`],
              ["parcial", `Parciais (${statusCounts.parcial})`],
              ["aberto", `Em aberto (${statusCounts.aberto})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className="cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={
                statusFilter === key
                  ? {
                      backgroundColor: primary || "var(--chapter-primary)",
                      borderColor: primary || "var(--chapter-primary)",
                      color: "#fff",
                    }
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {statusCounts.presente} presentes · {statusCounts.ausente} ausentes ·{" "}
          {statusCounts.pago} pagos · {statusCounts.parcial} parciais ·{" "}
          {statusCounts.aberto} em aberto
        </p>
      </div>
      {tickets.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Nenhum ingresso vendido ainda.
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Nenhum ingresso encontrado para “{search.trim()}”.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filteredTickets.map((t) => (
            <li
              key={t.id}
              className={
                t.settlement === "paid"
                  ? "flex flex-col gap-2 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  : t.settlement === "partial"
                    ? "flex flex-col gap-2 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    : "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              }
            >
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium leading-snug">
                  {t.buyer_name}
                </div>
                {t.seller_name ? (
                  <div className="break-words text-xs text-muted-foreground">
                    Vend. {t.seller_name}
                  </div>
                ) : null}
                <div className="mt-0.5 break-words text-xs text-muted-foreground">
                  {canManageTickets && t.status !== "cancelado" ? (
                    <Select
                      value={t.ticket_type_id ?? "__avulso__"}
                      disabled={changeType.isPending}
                      onValueChange={async (v) => {
                        const ticketTypeId = v === "__avulso__" ? null : v;
                        if (ticketTypeId === (t.ticket_type_id ?? null)) return;
                        const type = ticketTypeId
                          ? types.find((x) => x.id === ticketTypeId)
                          : null;
                        const pricePaid = type
                          ? Number(type.price) || 0
                          : Number(t.price_paid) || 0;
                        const currentPrice = Number(t.price_paid) || 0;
                        const typeLabel =
                          type?.name ??
                          (ticketTypeId ? "Tipo" : "Avulso");
                        const ok = await confirm({
                          title: "Alterar tipo de ingresso?",
                          description: `De ${formatBRL(currentPrice)} para ${typeLabel} · ${formatBRL(pricePaid)}. A cobrança do vendedor será sincronizada com o novo valor.`,
                          confirmLabel: "Alterar",
                        });
                        if (!ok) return;
                        changeType.mutate({
                          ticketId: t.id,
                          ticketTypeId,
                          pricePaid,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 w-[min(100%,14rem)] text-xs">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__avulso__">Avulso</SelectItem>
                        {types.map((ty) => (
                          <SelectItem key={ty.id} value={ty.id}>
                            {ty.name} · {formatBRL(Number(ty.price))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      {(t.ticket_type_id
                        ? typeMap.get(t.ticket_type_id)
                        : undefined) ?? "Avulso"}{" "}
                      · {formatBRL(Number(t.price_paid))}
                    </>
                  )}
                  {canManageTickets && t.status !== "cancelado" ? (
                    <span className="ml-1">
                      · {formatBRL(Number(t.price_paid))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {t.settlement === "paid" ? (
                  <Badge className="border-transparent bg-emerald-500/20 text-emerald-800 capitalize dark:text-emerald-300">
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                      aria-hidden
                    />
                    Paga
                  </Badge>
                ) : t.settlement === "partial" ? (
                  <Badge className="border-transparent bg-amber-500/20 text-amber-900 capitalize dark:text-amber-200">
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400"
                      aria-hidden
                    />
                    Parcialmente pago
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/70"
                      aria-hidden
                    />
                    {t.status}
                  </Badge>
                )}
                {canEditComanda && t.status !== "cancelado" && t.checked_in && (
                  <TicketComandaButton
                    eventId={eventId}
                    ticketId={t.id}
                    buyerName={t.buyer_name}
                    primary={primary}
                    paid={t.settlement === "paid"}
                  />
                )}
                {canEditComanda &&
                  t.status !== "cancelado" &&
                  !t.checked_in && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Comanda disponível após o check-in"
                    >
                      <ShoppingBag className="mr-1 h-4 w-4" /> Comanda
                    </Button>
                  )}
                <Button size="sm" variant="ghost" onClick={() => showQr(t)}>
                  <Ticket className="mr-1 h-4 w-4" /> QR
                </Button>
                {canManageTickets && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={removeTicket.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Excluir ingresso?",
                        description: `Excluir o ingresso de “${t.buyer_name}”? Isso remove comanda, cobrança do vendedor, check-in, assento e lançamentos de caixa vinculados.`,
                        confirmLabel: "Excluir",
                      });
                      if (ok) removeTicket.mutate(t.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Ingresso</DialogTitle>
          </DialogHeader>
          {preview && (
            <TicketPass
              pass={preview.pass}
              qrDataUrl={preview.qrDataUrl}
              className="rounded-none border-0 shadow-none"
              onSendEmail={() => notifyTicketEmailSoon(preview.pass)}
              sendEmailLabel="Enviar por e-mail (em breve)"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
    {dialog}
    </>
  );
}

function TicketTypesCard({
  eventId,
  types,
  tickets,
  onChanged,
}: {
  eventId: string;
  types: EventTicketType[];
  tickets: EventTicket[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(0);
  const [editing, setEditing] = useState<EventTicketType | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editQty, setEditQty] = useState(0);

  const soldByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tickets) {
      if (t.status === "cancelado" || !t.ticket_type_id) continue;
      map.set(t.ticket_type_id, (map.get(t.ticket_type_id) ?? 0) + 1);
    }
    return map;
  }, [tickets]);

  const createM = useMutation({
    mutationFn: () =>
      createTicketType({
        data: {
          event_id: eventId,
          name,
          price: Number(price),
          quantity_total: Number(qty),
        },
      }),
    onSuccess: () => {
      toast.success("Tipo de ingresso criado");
      setName("");
      setPrice(0);
      setQty(0);
      onChanged();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  const updateM = useMutation({
    mutationFn: () =>
      updateTicketType({
        data: {
          id: editing!.id,
          name: editName,
          price: Number(editPrice),
          quantity_total: Number(editQty),
        },
      }),
    onSuccess: () => {
      toast.success("Tipo atualizado");
      setEditing(null);
      onChanged();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteTicketType({ data: { id } }),
    onSuccess: () => {
      toast.success("Tipo excluído");
      onChanged();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  function openEdit(t: EventTicketType) {
    setEditing(t);
    setEditName(t.name);
    setEditPrice(Number(t.price));
    setEditQty(t.quantity_total);
  }

  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
    <Card className="rounded-[12px] p-0">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Tipos de ingresso</h3>
            <p className="text-xs text-muted-foreground">
              {types.length === 0
                ? "Nenhum tipo"
                : `${types.length} tipo${types.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
      <div className="space-y-4 border-t border-border px-5 pb-5 pt-3">
      <ul className="space-y-2">
        {types.length === 0 && (
          <li className="text-sm text-muted-foreground">
            Nenhum tipo cadastrado.
          </li>
        )}
        {types.map((t) => {
          const sold = soldByType.get(t.id) ?? 0;
          return (
            <li
              key={t.id}
              className="rounded-[8px] border border-border px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium leading-snug">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(Number(t.price))} · {sold}
                    {t.quantity_total > 0
                      ? ` / ${t.quantity_total}`
                      : ""}{" "}
                    vendidos
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(t)}
                    aria-label={`Editar ${t.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={deleteM.isPending}
                        aria-label={`Excluir ${t.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tipo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Remove “{t.name}”. Ingressos já vendidos deste tipo
                          passam a figurar como avulsos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            deleteM.mutate(t.id);
                          }}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground">Novo tipo</p>
        <div>
          <Label htmlFor="ticket-type-name" className="mb-1 block text-xs">
            Nome
          </Label>
          <Input
            id="ticket-type-name"
            placeholder="Ex: Pista"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="ticket-type-price" className="mb-1 block text-xs">
              Preço
            </Label>
            <Input
              id="ticket-type-price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="ticket-type-qty" className="mb-1 block text-xs">
              Quantidade
            </Label>
            <Input
              id="ticket-type-qty"
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (!name.trim()) {
              toast.error("Informe o nome");
              return;
            }
            createM.mutate();
          }}
          disabled={createM.isPending}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar tipo
        </Button>
      </div>
      </div>
      </CollapsibleContent>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tipo de ingresso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs">Preço</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  value={editQty}
                  onChange={(e) => setEditQty(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              onClick={() => {
                if (!editName.trim()) {
                  toast.error("Informe o nome");
                  return;
                }
                updateM.mutate();
              }}
              disabled={updateM.isPending}
            >
              {updateM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
    </Collapsible>
  );
}

function SellTicketCard({
  eventId,
  chapterId,
  event,
  types,
  artworkUrl,
  primary,
  onSold,
}: {
  eventId: string;
  chapterId: string;
  event: { name: string; starts_at: string; location: string | null };
  types: EventTicketType[];
  artworkUrl: string | null;
  primary?: string;
  onSold: () => void;
}) {
  const [buyer, setBuyer] = useState("");
  const [email, setEmail] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [typeId, setTypeId] = useState<string>("");
  const [price, setPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [sellOpen, setSellOpen] = useState(true);
  const [soldPasses, setSoldPasses] = useState<
    Array<{ id: string; pass: TicketPassData; qrDataUrl: string }>
  >([]);

  const sellersQ = useQuery({
    queryKey: ["charge-members", chapterId],
    queryFn: () => listChargeMembers({ data: { chapterId } }),
  });
  const sellerOptions = useMemo(
    () =>
      (sellersQ.data ?? []).map((s) => ({
        value: s.id,
        label: s.full_name,
      })),
    [sellersQ.data],
  );

  useEffect(() => {
    if (typeId) {
      const t = types.find((x) => x.id === typeId);
      if (t) setPrice(Number(t.price));
    }
  }, [typeId, types]);

  const total = Number(price) * Number(quantity || 0);
  const typeName = typeId
    ? (types.find((t) => t.id === typeId)?.name ?? "Avulso")
    : "Avulso";

  const m = useMutation({
    mutationFn: () =>
      sellTicket({
        data: {
          event_id: eventId,
          seller_member_id: sellerId,
          ticket_type_id: typeId || null,
          buyer_name: buyer,
          buyer_email: email,
          price_paid: Number(price),
          quantity: Number(quantity),
        },
      }),
    onSuccess: async (rows) => {
      toast.success(
        rows.length === 1
          ? "Ingresso vendido · cobrança criada no vendedor"
          : `${rows.length} ingressos vendidos · cobranças criadas no vendedor`,
      );
      const buyerEmail = email.trim() || null;
      const buyerName = buyer;
      const unitPrice = Number(price);
      setBuyer("");
      setEmail("");
      setQuantity(1);
      onSold();
      const passes = await Promise.all(
        rows.map(async (r) => {
          const pass = buildTicketPassData({
            event,
            ticket: {
              buyer_name: r.buyer_name || buyerName,
              buyer_email: buyerEmail,
              qr_code: r.qr_code,
              price_paid: unitPrice,
            },
            ticketTypeName: typeName,
            artworkUrl,
            primaryColor: primary,
          });
          return {
            id: r.id,
            pass,
            qrDataUrl: await ticketQrDataUrl(r.qr_code, pass.buyerName),
          };
        }),
      );
      setSoldPasses(passes);
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  return (
    <>
      <Collapsible open={sellOpen} onOpenChange={setSellOpen}>
        <Card className="rounded-[12px] p-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Vender ingresso</h3>
                <p className="text-xs text-muted-foreground">
                  Registrar venda e cobrança do vendedor
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  sellOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t border-border px-5 pb-5 pt-3">
        <div>
          <Label className="mb-1 block text-xs">Comprador *</Label>
          <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Para enviar o ingresso depois"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Vendedor *</Label>
          <SearchableSelect
            value={sellerId}
            options={sellerOptions}
            onChange={setSellerId}
            placeholder="Buscar membro…"
            searchPlaceholder="Digite o nome…"
            emptyText="Nenhum membro encontrado."
            disabled={sellersQ.isLoading}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Tipo</Label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Avulso" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="mb-1 block text-xs">Valor unitário</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Quantidade</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>
        {quantity > 1 && (
          <div className="text-xs text-muted-foreground">
            Total: {formatBRL(total)} ({quantity} × {formatBRL(Number(price))})
          </div>
        )}
        <Button
          style={{ backgroundColor: primary }}
          disabled={m.isPending}
          onClick={() => {
            if (!buyer.trim()) {
              toast.error("Informe o comprador");
              return;
            }
            if (!sellerId) {
              toast.error("Selecione o vendedor");
              return;
            }
            m.mutate();
          }}
        >
          {m.isPending ? "Vendendo…" : "Registrar venda"}
        </Button>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog
        open={soldPasses.length > 0}
        onOpenChange={(o) => {
          if (!o) setSoldPasses([]);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {soldPasses.length === 1
                ? "Ingresso"
                : `Ingressos (${soldPasses.length})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4 bg-muted/30">
            {soldPasses.map((t) => (
              <TicketPass
                key={t.id}
                pass={t.pass}
                qrDataUrl={t.qrDataUrl}
                onSendEmail={() => notifyTicketEmailSoon(t.pass)}
                sendEmailLabel="Enviar por e-mail (em breve)"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TablesMap({
  eventId,
  tables,
  seats,
  primary,
  onChanged,
}: {
  eventId: string;
  tables: EventTable[];
  seats: EventSeat[];
  primary?: string;
  onChanged: () => void;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const [label, setLabel] = useState("");
  const [cap, setCap] = useState(8);

  const createM = useMutation({
    mutationFn: () =>
      createTable({
        data: { event_id: eventId, label, capacity: Number(cap) },
      }),
    onSuccess: () => {
      toast.success("Mesa criada");
      setLabel("");
      onChanged();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  const deleteM = useMutation({
    mutationFn: (tableId: string) =>
      deleteTable({ data: { table_id: tableId } }),
    onSuccess: () => {
      toast.success("Mesa excluída");
      onChanged();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  const seatsByTable = new Map<string, EventSeat[]>();
  for (const s of seats) {
    const arr = seatsByTable.get(s.table_id) ?? [];
    arr.push(s);
    seatsByTable.set(s.table_id, arr);
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {tables.length === 0 && (
          <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
            Nenhuma mesa criada. Adicione a primeira ao lado.
          </Card>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tables.map((t) => {
            const ts = (seatsByTable.get(t.id) ?? []).sort(
              (a, b) => a.seat_number - b.seat_number,
            );
            return (
              <Card key={t.id} className="rounded-[12px] p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="font-semibold">{t.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t.capacity} lugares
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive"
                      aria-label={`Excluir mesa ${t.label}`}
                      disabled={deleteM.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Excluir mesa?",
                          description: `Excluir a mesa “${t.label}”? Os assentos serão removidos.`,
                          confirmLabel: "Excluir",
                        });
                        if (ok) deleteM.mutate(t.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ts.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--muted)",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {s.seat_number}
                      </div>
                      <div className="w-full text-center text-[10px] text-muted-foreground">
                        Assento
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <Card className="rounded-[12px] p-5 space-y-3">
        <h3 className="text-sm font-semibold">Nova mesa</h3>
        <div>
          <Label className="mb-1 block text-xs">Nome</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Mesa 1"
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Capacidade</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
          />
        </div>
        <Button
          style={{ backgroundColor: primary }}
          onClick={() => {
            if (!label.trim()) {
              toast.error("Informe o nome");
              return;
            }
            createM.mutate();
          }}
          disabled={createM.isPending}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Criar mesa
        </Button>
      </Card>
    </div>
    {dialog}
    </>
  );
}
