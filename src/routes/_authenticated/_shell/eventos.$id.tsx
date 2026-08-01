import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  getEvent,
  createTicketType,
  sellTicket,
  createTable,
  assignSeat,
  checkinTicket,
  deleteEvent,
} from "@/lib/events.functions";
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
  DialogTrigger,
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
  PlusCircle,
  ScanLine,
  Search,
  Ticket,
  Trash2,
} from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { QrScanner } from "@/components/QrScanner";
import { can } from "@/lib/permissions";

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
type EventCheckin = EventDetail["checkins"][number];

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function EventoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const { data } = useSuspenseQuery(eventQO(id));

  const raised = useMemo(
    () =>
      data.tickets
        .filter((t) => t.status !== "cancelado")
        .reduce((s, t) => s + Number(t.price_paid ?? 0), 0),
    [data.tickets],
  );
  const pct =
    data.event.goal_amount > 0
      ? Math.min(100, (raised / Number(data.event.goal_amount)) * 100)
      : 0;
  const [tab, setTab] = useState("resumo");
  const canDelete =
    can(active?.role.name, "admin") ||
    can(active?.role.name, "comissoes") ||
    can(active?.role.name, "secretaria");

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
        <TabsList className="mb-4">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="ingressos">Ingressos</TabsTrigger>
          <TabsTrigger value="mesas">Mapa de mesas</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="rounded-[12px] p-5">
              <div className="text-sm text-muted-foreground">Arrecadação</div>
              <div className="mt-1 text-2xl font-bold">{formatBRL(raised)}</div>
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
            </Card>
            <Card className="rounded-[12px] p-5">
              <div className="text-sm text-muted-foreground">Ingressos</div>
              <div className="mt-1 text-2xl font-bold">
                {data.tickets.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.checkins.length} check-ins realizados
              </div>
            </Card>
            {data.event.description && (
              <Card className="rounded-[12px] p-5 md:col-span-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {data.event.description}
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ingressos">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
            <TicketsList tickets={data.tickets} types={data.ticketTypes} />
            <div className="space-y-4">
              <TicketTypesCard
                eventId={id}
                types={data.ticketTypes}
                onChanged={() =>
                  qc.invalidateQueries({ queryKey: ["event", id] })
                }
              />
              <SellTicketCard
                eventId={id}
                types={data.ticketTypes}
                primary={active?.chapter.primary_color}
                onSold={() => qc.invalidateQueries({ queryKey: ["event", id] })}
              />
            </div>
          </div>
        </TabsContent>

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

        <TabsContent value="checkin">
          {tab === "checkin" && (
            <CheckinPanel
              eventId={id}
              tickets={data.tickets}
              checkins={data.checkins}
              primary={active?.chapter.primary_color}
              onChanged={() =>
                qc.invalidateQueries({ queryKey: ["event", id] })
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TicketsList({
  tickets,
  types,
}: {
  tickets: EventTicket[];
  types: EventTicketType[];
}) {
  const typeMap = new Map(types.map((t) => [t.id, t.name]));
  const [qrImg, setQrImg] = useState<{ ticketId: string; url: string } | null>(
    null,
  );
  async function showQr(ticket: EventTicket) {
    if (!ticket.qr_code) {
      toast.error("Ingresso sem QR code");
      return;
    }
    const QRCode = await import("qrcode");
    const url = await QRCode.default.toDataURL(ticket.qr_code, {
      width: 260,
      margin: 1,
    });
    setQrImg({ ticketId: ticket.id, url });
  }
  return (
    <Card className="rounded-[12px] p-0">
      {tickets.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Nenhum ingresso vendido ainda.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{t.buyer_name}</div>
                <div className="text-xs text-muted-foreground">
                  {(t.ticket_type_id
                    ? typeMap.get(t.ticket_type_id)
                    : undefined) ?? "Avulso"}{" "}
                  · {formatBRL(Number(t.price_paid))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {t.status}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => showQr(t)}>
                  <Ticket className="mr-1 h-4 w-4" /> QR
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!qrImg} onOpenChange={(o) => !o && setQrImg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code do ingresso</DialogTitle>
          </DialogHeader>
          {qrImg && <img src={qrImg.url} alt="QR" className="mx-auto" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TicketTypesCard({
  eventId,
  types,
  onChanged,
}: {
  eventId: string;
  types: EventTicketType[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(0);
  const m = useMutation({
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
  return (
    <Card className="rounded-[12px] p-5">
      <h3 className="mb-3 text-sm font-semibold">Tipos de ingresso</h3>
      <ul className="mb-3 space-y-1 text-sm">
        {types.length === 0 && (
          <li className="text-muted-foreground">Nenhum tipo cadastrado.</li>
        )}
        {types.map((t) => (
          <li key={t.id} className="flex items-center justify-between">
            <span>{t.name}</span>
            <span className="text-muted-foreground">
              {formatBRL(Number(t.price))}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <div>
          <Label htmlFor="ticket-type-name" className="mb-1 block text-xs">
            Nome
          </Label>
          <Input
            id="ticket-type-name"
            placeholder="Nome (ex: Pista)"
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
              placeholder="Preço"
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
              placeholder="Qtde"
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
            m.mutate();
          }}
          disabled={m.isPending}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar tipo
        </Button>
      </div>
    </Card>
  );
}

function SellTicketCard({
  eventId,
  types,
  primary,
  onSold,
}: {
  eventId: string;
  types: EventTicketType[];
  primary?: string;
  onSold: () => void;
}) {
  const [buyer, setBuyer] = useState("");
  const [email, setEmail] = useState("");
  const [typeId, setTypeId] = useState<string>("");
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (typeId) {
      const t = types.find((x) => x.id === typeId);
      if (t) setPrice(Number(t.price));
    }
  }, [typeId, types]);

  const m = useMutation({
    mutationFn: () =>
      sellTicket({
        data: {
          event_id: eventId,
          ticket_type_id: typeId || null,
          buyer_name: buyer,
          buyer_email: email,
          price_paid: Number(price),
        },
      }),
    onSuccess: () => {
      toast.success("Ingresso vendido");
      setBuyer("");
      setEmail("");
      onSold();
    },
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  return (
    <Card className="rounded-[12px] p-5 space-y-3">
      <h3 className="text-sm font-semibold">Vender ingresso</h3>
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
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
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
        <div>
          <Label className="mb-1 block text-xs">Valor pago</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
      </div>
      <Button
        style={{ backgroundColor: primary }}
        disabled={m.isPending}
        onClick={() => {
          if (!buyer.trim()) {
            toast.error("Informe o comprador");
            return;
          }
          m.mutate();
        }}
      >
        {m.isPending ? "Vendendo…" : "Registrar venda"}
      </Button>
    </Card>
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
  tickets: EventTicket[];
  primary?: string;
  onChanged: () => void;
}) {
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

  const assignM = useMutation({
    mutationFn: (v: { seat_id: string; ticket_id: string | null }) =>
      assignSeat({ data: v }),
    onSuccess: () => onChanged(),
    onError: (e: unknown) => toast.error(mutationErrorMessage(e, "Erro")),
  });

  const seatsByTable = new Map<string, EventSeat[]>();
  for (const s of seats) {
    const arr = seatsByTable.get(s.table_id) ?? [];
    arr.push(s);
    seatsByTable.set(s.table_id, arr);
  }
  const assignedTicketIds = new Set(
    seats.filter((s) => s.ticket_id).map((s) => s.ticket_id),
  );
  const freeTickets = tickets.filter(
    (t) => t.status !== "cancelado" && !assignedTicketIds.has(t.id),
  );

  return (
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
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold">{t.label}</div>
                  <span className="text-xs text-muted-foreground">
                    {ts.filter((s) => s.ticket_id).length}/{t.capacity} ocupados
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {ts.map((s) => {
                    const ticket = tickets.find((tk) => tk.id === s.ticket_id);
                    return (
                      <div
                        key={s.id}
                        className="flex flex-col items-center gap-1"
                      >
                        <div
                          className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: s.ticket_id
                              ? primary
                              : "var(--muted)",
                            color: s.ticket_id
                              ? "#fff"
                              : "var(--muted-foreground)",
                          }}
                        >
                          {s.seat_number}
                        </div>
                        <div className="w-full text-center text-[10px] text-muted-foreground truncate">
                          {ticket?.buyer_name ?? "Livre"}
                        </div>
                        {s.ticket_id ? (
                          <button
                            className="text-[10px] underline text-muted-foreground"
                            onClick={() =>
                              assignM.mutate({ seat_id: s.id, ticket_id: null })
                            }
                          >
                            Liberar
                          </button>
                        ) : (
                          <Select
                            onValueChange={(v) =>
                              assignM.mutate({ seat_id: s.id, ticket_id: v })
                            }
                          >
                            <SelectTrigger className="h-6 px-2 text-[10px]">
                              <SelectValue placeholder="Atribuir" />
                            </SelectTrigger>
                            <SelectContent>
                              {freeTickets.length === 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  Sem ingressos livres
                                </div>
                              )}
                              {freeTickets.map((tk) => (
                                <SelectItem key={tk.id} value={tk.id}>
                                  {tk.buyer_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
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
      </Card>
    </div>
  );
}

function CheckinPanel({
  eventId,
  tickets,
  checkins,
  primary,
  onChanged,
}: {
  eventId: string;
  tickets: EventTicket[];
  checkins: EventCheckin[];
  primary?: string;
  onChanged: () => void;
}) {
  const [useCamera, setUseCamera] = useState(false);
  const [search, setSearch] = useState("");
  const [liveCount, setLiveCount] = useState(checkins.length);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    setLiveCount(checkins.length);
  }, [checkins.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`checkins-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "checkins",
          filter: `event_id=eq.${eventId}`,
        },
        () => setLiveCount((c) => c + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const m = useMutation({
    mutationFn: (v: {
      qr?: string;
      ticket_id?: string;
      method: "qr" | "nome";
    }) => checkinTicket({ data: { event_id: eventId, ...v } }),
    onSuccess: (res) => {
      if (res.alreadyCheckedIn) toast.info("Ingresso já havia entrado");
      else toast.success("Check-in realizado");
      onChanged();
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro no check-in")),
  });

  const filtered = tickets.filter((t) =>
    t.buyer_name.toLowerCase().includes(search.toLowerCase()),
  );
  const checkedTicketIds = new Set(checkins.map((c) => c.ticket_id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">
              Check-ins realizados
            </div>
            <div className="text-3xl font-bold" style={{ color: primary }}>
              {liveCount}
            </div>
            <div className="text-xs text-muted-foreground">
              de {tickets.length} ingressos
            </div>
          </div>
          <Button
            variant={useCamera ? "default" : "outline"}
            onClick={() => setUseCamera((v) => !v)}
            style={useCamera ? { backgroundColor: primary } : undefined}
          >
            <ScanLine className="mr-2 h-4 w-4" />{" "}
            {useCamera ? "Parar câmera" : "Ler QR"}
          </Button>
        </div>
        {useCamera && (
          <QrScanner
            onScan={(text) => {
              if (text === lastScanned) return;
              setLastScanned(text);
              m.mutate({ qr: text, method: "qr" });
              setTimeout(() => setLastScanned(null), 2000);
            }}
          />
        )}
      </Card>
      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold">Buscar por nome</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nome do participante"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {filtered.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum resultado.</li>
          )}
          {filtered.map((t) => {
            const already = checkedTicketIds.has(t.id);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-[8px] border border-border px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm">{t.buyer_name}</span>
                {already ? (
                  <Badge variant="secondary">Presente</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      m.mutate({ ticket_id: t.id, method: "nome" })
                    }
                    disabled={m.isPending}
                  >
                    Registrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
