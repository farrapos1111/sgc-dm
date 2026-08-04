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
  updateEventArtwork,
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
  Ticket,
  Trash2,
} from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { matchesLooseSearch } from "@/lib/utils";
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
  head: () => ({ meta: [{ title: "Evento — SG-CDM" }] }),
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
  const canDelete =
    can(active?.role.name, "admin") ||
    can(active?.role.name, "comissoes") ||
    can(active?.role.name, "secretaria");
  const canEditFinance =
    can(active?.role.name, "admin") ||
    can(active?.role.name, "tesouraria") ||
    can(active?.role.name, "comissoes");

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
        subtitle={`${formatDateTimeBR(data.event.starts_at)}${data.event.location ? ` · ${data.event.location}` : ""}`}
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
            {data.event.description && (
              <Card className="rounded-[12px] p-5 md:col-span-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {data.event.description}
              </Card>
            )}
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
}: {
  eventId: string;
  tickets: EventTicket[];
  types: EventTicketType[];
  event: { name: string; starts_at: string; location: string | null };
  artworkUrl: string | null;
  primary?: string;
  canEditComanda?: boolean;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const typeMap = new Map(types.map((t) => [t.id, t.name]));
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{
    pass: TicketPassData;
    qrDataUrl: string;
  } | null>(null);

  const filteredTickets = useMemo(() => {
    const typesById = new Map(types.map((t) => [t.id, t.name]));
    return tickets.filter((t) => {
      const typeName =
        (t.ticket_type_id ? typesById.get(t.ticket_type_id) : undefined) ??
        "Avulso";
      const statusParts = [
        t.status,
        t.seller_charge_paid ? "paga pago" : "em aberto pendente",
      ];
      const haystack = [
        t.buyer_name,
        t.seller_name ?? "",
        typeName,
        ...statusParts,
      ].join(" ");
      return matchesLooseSearch(haystack, search);
    });
  }, [tickets, search, types]);

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
      <div className="border-b border-border p-3">
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
                t.seller_charge_paid
                  ? "flex items-center justify-between gap-3 bg-emerald-500/10 p-4"
                  : "flex items-center justify-between gap-3 p-4"
              }
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {t.buyer_name}
                  {t.seller_name ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {t.seller_name}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {(t.ticket_type_id
                    ? typeMap.get(t.ticket_type_id)
                    : undefined) ?? "Avulso"}{" "}
                  · {formatBRL(Number(t.price_paid))}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {t.seller_charge_paid ? (
                  <Badge className="border-transparent bg-emerald-500/20 text-emerald-800 capitalize dark:text-emerald-300">
                    Paga
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {t.status}
                  </Badge>
                )}
                {canEditComanda && t.status !== "cancelado" && (
                  <TicketComandaButton
                    eventId={eventId}
                    ticketId={t.id}
                    buyerName={t.buyer_name}
                    primary={primary}
                    paid={t.seller_charge_paid}
                  />
                )}
                <Button size="sm" variant="ghost" onClick={() => showQr(t)}>
                  <Ticket className="mr-1 h-4 w-4" /> QR
                </Button>
                {canEditComanda && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={removeTicket.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Excluir ingresso?",
                        description: `Excluir o ingresso de “${t.buyer_name}”? Isso remove comanda, check-in, assento e lançamentos de caixa vinculados.`,
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
                  <div className="truncate text-sm font-medium">{t.name}</div>
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
