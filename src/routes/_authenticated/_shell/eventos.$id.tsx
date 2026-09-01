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
  sendTicketEmail,
  createTable,
  updateTable,
  deleteTable,
  deleteEvent,
  updateEvent,
  updateEventArtwork,
  assignSeat,
} from "@/lib/events.functions";
import {
  deleteEventTicket,
  getEventFinanceTotals,
  listEventTicketItems,
} from "@/lib/event-finance.functions";
import { listChargeMembers } from "@/lib/finance.functions";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  buildComandaReportRows,
  exportEventComandasPdf,
  formatEventFinanceHint,
} from "@/lib/event-finance-export";
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
  DialogFooter,
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
  FileText,
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
import { isOrgLeader } from "@/lib/permissions";
import { matchesLooseSearch } from "@/lib/utils";
import {
  eventDisplayStatusLabel,
  isEventFinanceOpen,
} from "@/lib/event-lifecycle";
import { fromAppTzDateTimeLocal, toAppTzDateTimeLocal } from "@/lib/timezone";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TicketPass } from "@/components/events/TicketPass";
import { EventFinancePanel } from "@/components/events/EventFinancePanel";
import { EventComandaAuditPanel } from "@/components/events/EventComandaAuditPanel";
import { TicketSellerRanking } from "@/components/events/TicketSellerRanking";
import { TicketComandaButton } from "@/components/events/TicketComandaDialog";
import { EditSoldTicketDialog } from "@/components/events/EditSoldTicketDialog";
import {
  EVENT_ARTWORK_BUCKET,
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
  const {
    can: canPerm,
    canDo,
    canScreen,
    isAdminTotal,
    realCtx,
  } = useChapterAccess();
  const { data } = useSuspenseQuery(eventQO(id));
  const artworkUrl = useEventArtwork(data.event.ticket_artwork_url);

  const financeTotalsQ = useQuery({
    queryKey: ["event-finance-totals", id, "", ""],
    queryFn: () =>
      getEventFinanceTotals({
        data: { eventId: id, from: null, until: null },
      }),
  });

  // Barra/resumo: só valores pagos (sem fallback para preço vendido em aberto).
  const raised = financeTotalsQ.data?.paid ?? 0;
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
    canDo("eventos.manage") || canPerm("admin") || canScreen("eventos", "edit");
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
  const canViewComandaAudit = isAdminTotal || isOrgLeader(realCtx);
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
          <TabsTrigger value="ranking" className="shrink-0">
            <span className="sm:hidden">Ranking</span>
            <span className="hidden sm:inline">Ranking vendedores</span>
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="shrink-0">
            Financeiro
          </TabsTrigger>
          {canViewComandaAudit ? (
            <TabsTrigger value="audit-log" className="shrink-0">
              Audit Log
            </TabsTrigger>
          ) : null}
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
              chapterId={data.event.chapter_id}
              tickets={data.tickets}
              types={data.ticketTypes}
              event={eventMeta}
              artworkUrl={artworkUrl}
              primary={active?.chapter.primary_color}
              canEditComanda={canEditFinance}
              canManageTickets={canManageTickets}
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
              spent={
                financeTotalsQ.data?.spent ??
                financeTotalsQ.data?.totalExpense ??
                0
              }
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

        {canViewComandaAudit ? (
          <TabsContent value="audit-log">
            <EventComandaAuditPanel
              eventId={id}
              eventName={data.event.name}
              chapterId={data.event.chapter_id}
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
            />
          </TabsContent>
        ) : null}

        <TabsContent value="mesas">
          <TablesMap
            eventId={id}
            tables={data.tables}
            seats={data.seats}
            tickets={data.tickets}
            primary={active?.chapter.primary_color}
            onChanged={() => qc.invalidateQueries({ queryKey: ["event", id] })}
          />
        </TabsContent>

        <TabsContent value="ranking">
          <TicketSellerRanking
            tickets={data.tickets}
            ticketTypes={data.ticketTypes}
            eventName={data.event.name}
            eventStartsAt={data.event.starts_at}
            primary={active?.chapter.primary_color}
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
          Recomendado: 1200×600 px. Aparece no topo do ingresso (estilo Sympla).
        </p>
      </div>
    </Card>
  );
}

function toastTicketEmailResult(status: "sent" | "skipped" | "failed" | "none", error?: string | null) {
  if (status === "sent") {
    toast.success("Ingresso enviado por e-mail");
  } else if (status === "skipped") {
    toast.message(error || "E-mail não enviado (Resend não configurado).");
  } else if (status === "failed") {
    toast.error(error || "Não foi possível enviar o ingresso por e-mail");
  }
}

function TicketsList({
  eventId,
  chapterId,
  tickets,
  types,
  event,
  artworkUrl,
  primary,
  canEditComanda,
  canManageTickets,
  chapterName,
  chapterCity,
  logoPath,
  spent = 0,
}: {
  eventId: string;
  chapterId: string;
  tickets: EventTicket[];
  types: EventTicketType[];
  event: { name: string; starts_at: string; location: string | null };
  artworkUrl: string | null;
  primary?: string;
  canEditComanda?: boolean;
  /** MC ou presidente da Com. Eventos: editar / excluir ingresso. */
  canManageTickets?: boolean;
  chapterName?: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  spent?: number;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const typeMap = useMemo(
    () => new Map(types.map((t) => [t.id, t.name])),
    [types],
  );
  const [search, setSearch] = useState("");
  const [exportingComandas, setExportingComandas] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "presente" | "ausente" | "pago" | "parcial" | "aberto"
  >("all");
  const [preview, setPreview] = useState<{
    ticketId: string;
    pass: TicketPassData;
    qrDataUrl: string;
  } | null>(null);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);
  const [editingTicket, setEditingTicket] = useState<EventTicket | null>(null);

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
      if (statusFilter === "parcial" && t.settlement !== "partial")
        return false;
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
    mutationFn: (ticketId: string) => deleteEventTicket({ data: { ticketId } }),
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

  const sendEmailMut = useMutation({
    mutationFn: (ticketId: string) => sendTicketEmail({ data: { ticketId } }),
    onMutate: (ticketId) => setSendingTicketId(ticketId),
    onSettled: () => setSendingTicketId(null),
    onSuccess: (res) => toastTicketEmailResult(res.status, res.error),
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Falha ao enviar o ingresso")),
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
    setPreview({ ticketId: ticket.id, pass, qrDataUrl: url });
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {statusCounts.presente} presentes · {statusCounts.ausente}{" "}
              ausentes · {statusCounts.pago} pagos · {statusCounts.parcial}{" "}
              parciais · {statusCounts.aberto} em aberto
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={exportingComandas || tickets.length === 0}
              onClick={async () => {
                setExportingComandas(true);
                try {
                  const items = await listEventTicketItems({
                    data: { eventId },
                  });
                  const rows = buildComandaReportRows({
                    tickets,
                    ticketTypes: types,
                    items,
                  });
                  await exportEventComandasPdf({
                    chapterName: chapterName || "Capítulo",
                    chapterCity: chapterCity ?? null,
                    logoPath: logoPath ?? null,
                    eventName: event.name,
                    rows,
                    spent,
                  });
                  toast.success("Relatório de comandas gerado");
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : "Erro ao gerar relatório de comandas",
                  );
                } finally {
                  setExportingComandas(false);
                }
              }}
            >
              <FileText className="mr-1 h-4 w-4" />
              {exportingComandas ? "Gerando…" : "Comandas PDF"}
            </Button>
          </div>
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
                    {(t.ticket_type_id
                      ? typeMap.get(t.ticket_type_id)
                      : undefined) ?? "Avulso"}{" "}
                    · {formatBRL(Number(t.price_paid))}
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
                  {canEditComanda &&
                    t.status !== "cancelado" &&
                    t.checked_in && (
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
                  {canManageTickets && t.status !== "cancelado" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingTicket(t)}
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Editar
                    </Button>
                  ) : null}
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
                onSendEmail={() => sendEmailMut.mutate(preview.ticketId)}
                sendEmailPending={sendingTicketId === preview.ticketId}
                sendEmailLabel={
                  sendingTicketId === preview.ticketId
                    ? "Enviando…"
                    : "Enviar por e-mail"
                }
              />
            )}
          </DialogContent>
        </Dialog>
        <EditSoldTicketDialog
          open={!!editingTicket}
          onOpenChange={(o) => {
            if (!o) setEditingTicket(null);
          }}
          ticket={editingTicket}
          types={types}
          chapterId={chapterId}
          eventId={eventId}
          primary={primary}
        />
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
                        <div className="break-words text-sm font-medium leading-snug">
                          {t.name}
                        </div>
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
                                Remove “{t.name}”. Ingressos já vendidos deste
                                tipo passam a figurar como avulsos.
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
              <p className="text-xs font-medium text-muted-foreground">
                Novo tipo
              </p>
              <div>
                <Label
                  htmlFor="ticket-type-name"
                  className="mb-1 block text-xs"
                >
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
                  <Label
                    htmlFor="ticket-type-price"
                    className="mb-1 block text-xs"
                  >
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
                  <Label
                    htmlFor="ticket-type-qty"
                    className="mb-1 block text-xs"
                  >
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
  const [priceOverride, setPriceOverride] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [sellOpen, setSellOpen] = useState(true);
  const [soldPasses, setSoldPasses] = useState<
    Array<{ id: string; pass: TicketPassData; qrDataUrl: string }>
  >([]);
  const [sendingTicketId, setSendingTicketId] = useState<string | null>(null);

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
    if (!typeId || priceOverride) return;
    const t = types.find((x) => x.id === typeId);
    if (t) setPrice(Number(t.price));
  }, [typeId, types, priceOverride]);

  const total = Number(price) * Number(quantity || 0);
  const selectedType = typeId ? types.find((t) => t.id === typeId) : undefined;
  const typeName = selectedType?.name ?? "Avulso";
  const catalogUnit = selectedType ? Number(selectedType.price) : null;

  function handleTypeChange(v: string) {
    setTypeId(v);
    setPriceOverride(false);
    setAdvancedOpen(false);
    const t = types.find((x) => x.id === v);
    if (t) setPrice(Number(t.price));
  }

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
    onSuccess: async (res) => {
      const rows = res.tickets;
      toast.success(
        rows.length === 1
          ? "Ingresso vendido · cobrança criada no vendedor"
          : `${rows.length} ingressos vendidos · cobranças criadas no vendedor`,
      );
      toastTicketEmailResult(res.emailStatus, res.emailError);
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

  const sendEmailMut = useMutation({
    mutationFn: (ticketId: string) => sendTicketEmail({ data: { ticketId } }),
    onMutate: (ticketId) => setSendingTicketId(ticketId),
    onSettled: () => setSendingTicketId(null),
    onSuccess: (res) => toastTicketEmailResult(res.status, res.error),
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Falha ao enviar o ingresso")),
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
                <Input
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Envia o QR automaticamente na venda"
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
                <Select value={typeId} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Avulso" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {formatBRL(Number(t.price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Valor unitário:{" "}
                  <span className="font-medium text-foreground">
                    {formatBRL(Number(price))}
                  </span>
                  {priceOverride ? " (personalizado)" : " (preço do tipo)"}
                </p>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/40"
                  >
                    <span>Detalhes avançados</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        advancedOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                    <div>
                      <Label className="mb-1 block text-xs">
                        Valor unitário
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => {
                          setPriceOverride(true);
                          setPrice(Number(e.target.value));
                        }}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Por padrão usa o preço do tipo
                        {catalogUnit != null
                          ? ` (${formatBRL(catalogUnit)})`
                          : ""}
                        . Altere só se a venda for diferente.
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {quantity > 1 && (
                <div className="text-xs text-muted-foreground">
                  Total: {formatBRL(total)} ({quantity} ×{" "}
                  {formatBRL(Number(price))})
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
                onSendEmail={() => sendEmailMut.mutate(t.id)}
                sendEmailPending={sendingTicketId === t.id}
                sendEmailLabel={
                  sendingTicketId === t.id
                    ? "Enviando…"
                    : "Enviar por e-mail"
                }
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
  tickets,
  primary,
  onChanged,
}: {
  eventId: string;
  tables: EventTable[];
  seats: EventSeat[];
  tickets: EventDetail["tickets"];
  primary?: string;
  onChanged: () => void;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const [label, setLabel] = useState("");
  const [cap, setCap] = useState(8);
  const [editing, setEditing] = useState<EventTable | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCap, setEditCap] = useState(8);
  const [assigning, setAssigning] = useState<EventSeat | null>(null);
  const [pickedTicketId, setPickedTicketId] = useState<string>("");

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

  const updateM = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("Mesa não selecionada");
      return updateTable({
        data: {
          table_id: editing.id,
          label: editLabel.trim(),
          capacity: Number(editCap),
        },
      });
    },
    onSuccess: () => {
      toast.success("Mesa atualizada");
      setEditing(null);
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

  const assignM = useMutation({
    mutationFn: (payload: { seatId: string; ticketId: string | null }) =>
      assignSeat({
        data: { seat_id: payload.seatId, ticket_id: payload.ticketId },
      }),
    onSuccess: () => {
      toast.success(
        pickedTicketId ? "Convidado alocado no assento" : "Assento liberado",
      );
      setAssigning(null);
      setPickedTicketId("");
      onChanged();
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao alocar assento")),
  });

  const ticketById = useMemo(() => {
    const map = new Map<string, EventDetail["tickets"][number]>();
    for (const t of tickets) {
      if (t.status === "cancelado") continue;
      map.set(t.id, t);
    }
    return map;
  }, [tickets]);

  const seatByTicketId = useMemo(() => {
    const map = new Map<string, EventSeat>();
    for (const s of seats) {
      if (s.ticket_id) map.set(s.ticket_id, s);
    }
    return map;
  }, [seats]);

  const ticketOptions = useMemo(() => {
    return [...ticketById.values()]
      .filter((t) => t.checked_in)
      .map((t) => {
        const occupied = seatByTicketId.get(t.id);
        const sameSeat = assigning && occupied?.id === assigning.id;
        const suffix =
          occupied && !sameSeat ? ` (mesa/assento já alocado)` : "";
        return {
          value: t.id,
          label: `${t.buyer_name}${suffix}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [ticketById, seatByTicketId, assigning]);

  const seatsByTable = new Map<string, EventSeat[]>();
  for (const s of seats) {
    const arr = seatsByTable.get(s.table_id) ?? [];
    arr.push(s);
    seatsByTable.set(s.table_id, arr);
  }

  const assigningTable = assigning
    ? tables.find((t) => t.id === assigning.table_id)
    : null;
  const assigningGuest = assigning?.ticket_id
    ? ticketById.get(assigning.ticket_id)
    : null;

  function openAssign(seat: EventSeat) {
    setAssigning(seat);
    const guest = seat.ticket_id ? ticketById.get(seat.ticket_id) : null;
    setPickedTicketId(guest?.checked_in ? (seat.ticket_id ?? "") : "");
  }

  function openEdit(t: EventTable) {
    setEditing(t);
    setEditLabel(t.label);
    setEditCap(t.capacity);
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
          {tables.length > 0 &&
          tickets.filter((t) => t.status !== "cancelado").length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Ainda não há ingressos vendidos. Venda ingressos na aba Ingressos
              para alocar convidados nos assentos.
            </p>
          ) : tables.length > 0 &&
            tickets.some((t) => t.status !== "cancelado") &&
            !tickets.some((t) => t.status !== "cancelado" && t.checked_in) ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Só dá para alocar quem já fez check-in. Libere a entrada na tela
              de Check-ins e volte aqui.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tables.map((t) => {
              const ts = (seatsByTable.get(t.id) ?? []).sort(
                (a, b) => a.seat_number - b.seat_number,
              );
              const occupiedCount = ts.filter((s) => s.ticket_id).length;
              return (
                <Card key={t.id} className="rounded-[12px] p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{t.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {occupiedCount}/{t.capacity} ocupados
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        aria-label={`Editar mesa ${t.label}`}
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                    {ts.map((s) => {
                      const guest = s.ticket_id
                        ? ticketById.get(s.ticket_id)
                        : null;
                      const taken = Boolean(guest);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => openAssign(s)}
                          className="flex flex-col items-center gap-1 rounded-[10px] p-1 text-left transition-colors hover:bg-muted/50"
                          title={
                            guest
                              ? `${guest.buyer_name} — toque para alterar`
                              : "Toque para alocar convidado"
                          }
                        >
                          <div
                            className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold"
                            style={
                              taken
                                ? {
                                    backgroundColor:
                                      primary || "var(--chapter-primary)",
                                    color: "#fff",
                                  }
                                : {
                                    backgroundColor: "var(--muted)",
                                    color: "var(--muted-foreground)",
                                  }
                            }
                          >
                            {s.seat_number}
                          </div>
                          <div
                            className={`w-full truncate text-center text-[10px] ${
                              taken
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {guest?.buyer_name?.trim() || "Livre"}
                          </div>
                        </button>
                      );
                    })}
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
          <p className="text-[11px] text-muted-foreground">
            Toque em um assento para alocar quem já fez check-in, ou liberar o
            lugar.
          </p>
        </Card>
      </div>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Editar mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Nome</Label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Ex: Mesa 1"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Capacidade (lugares)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={editCap}
                onChange={(e) => setEditCap(Number(e.target.value))}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Ao reduzir, só remove assentos livres no final. Libere
                convidados dos assentos extras antes de diminuir.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={updateM.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              style={{ backgroundColor: primary }}
              disabled={updateM.isPending}
              onClick={() => {
                if (!editLabel.trim()) {
                  toast.error("Informe o nome");
                  return;
                }
                const n = Number(editCap);
                if (!Number.isFinite(n) || n < 1 || n > 30) {
                  toast.error("Capacidade entre 1 e 30");
                  return;
                }
                updateM.mutate();
              }}
            >
              {updateM.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assigning}
        onOpenChange={(o) => {
          if (!o) {
            setAssigning(null);
            setPickedTicketId("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              Assento {assigning?.seat_number}
              {assigningTable ? ` · ${assigningTable.label}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {assigningGuest ? (
              <p className="text-sm text-muted-foreground">
                Atual:{" "}
                <span className="font-medium text-foreground">
                  {assigningGuest.buyer_name}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Assento livre.</p>
            )}
            {ticketOptions.length === 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Nenhum convidado com check-in disponível para alocar.
              </p>
            ) : (
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Convidado com check-in
                </Label>
                <SearchableSelect
                  value={pickedTicketId}
                  options={ticketOptions}
                  onChange={setPickedTicketId}
                  placeholder="Buscar por nome…"
                  searchPlaceholder="Nome do convidado…"
                  emptyText="Nenhum convidado encontrado."
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            {assigning?.ticket_id ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={assignM.isPending}
                onClick={() => {
                  if (!assigning) return;
                  setPickedTicketId("");
                  assignM.mutate({ seatId: assigning.id, ticketId: null });
                }}
              >
                Liberar assento
              </Button>
            ) : null}
            <Button
              type="button"
              className="w-full sm:w-auto"
              style={{ backgroundColor: primary }}
              disabled={
                assignM.isPending ||
                !pickedTicketId ||
                pickedTicketId === (assigning?.ticket_id ?? "")
              }
              onClick={() => {
                if (!assigning || !pickedTicketId) return;
                assignM.mutate({
                  seatId: assigning.id,
                  ticketId: pickedTicketId,
                });
              }}
            >
              {assignM.isPending ? "Salvando…" : "Alocar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
