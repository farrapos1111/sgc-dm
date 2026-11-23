import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Download, Plus, QrCode, Receipt, Ticket, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { brl, type DemoOrg, type Guest, type SocialEvent } from "./demo-data";
import {
  Avatar,
  Chip,
  FilterChips,
  Panel,
  PrimaryButton,
  ScreenHeader,
  SearchBox,
  Segmented,
  SoftButton,
} from "./demo-ui";
import { fieldClass, notInDemo } from "./demo-helpers";

type Tab = "participantes" | "comandas" | "produtos";
const GUEST_FILTERS = ["Todos", "Presentes", "Pagamento pendente"] as const;

export function EventsScreen({
  org,
  event,
  setEvent,
}: {
  org: DemoOrg;
  event: SocialEvent;
  setEvent: (fn: (e: SocialEvent) => SocialEvent) => void;
}) {
  const [tab, setTab] = useState<Tab>("participantes");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof GUEST_FILTERS)[number]>("Todos");
  const [openTab, setOpenTab] = useState<string | null>(null);
  const [selling, setSelling] = useState(false);

  const ticket = (id: string) => event.tickets.find((t) => t.id === id)!;
  const product = (id: string) => event.products.find((p) => p.id === id)!;

  const stats = useMemo(() => {
    let ticketsPaid = 0;
    let ticketsOpen = 0;
    let itemsPaid = 0;
    let itemsOpen = 0;
    for (const g of event.guests) {
      const price = event.tickets.find((t) => t.id === g.ticket)?.price ?? 0;
      if (g.ticketPaid) ticketsPaid += price;
      else ticketsOpen += price;
      for (const it of g.items) {
        const v = (event.products.find((p) => p.id === it.productId)?.price ?? 0) * it.qty;
        if (it.paid) itemsPaid += v;
        else itemsOpen += v;
      }
    }
    return {
      sold: event.guests.length,
      checkins: event.guests.filter((g) => g.checkedIn).length,
      open: ticketsOpen + itemsOpen,
      collected: ticketsPaid + itemsPaid,
    };
  }, [event]);

  function updateGuest(id: string, fn: (g: Guest) => Guest) {
    setEvent((e) => ({ ...e, guests: e.guests.map((g) => (g.id === id ? fn(g) : g)) }));
  }

  const guests = event.guests.filter(
    (g) =>
      g.name.toLowerCase().includes(q.trim().toLowerCase()) &&
      (filter === "Todos" ||
        (filter === "Presentes" ? g.checkedIn : !g.ticketPaid || g.items.some((i) => !i.paid))),
  );
  const current = event.guests.find((g) => g.id === openTab) ?? null;

  return (
    <div className="flex flex-col gap-[18px]">
      <ScreenHeader
        eyebrow="Comissão de eventos"
        title={event.title}
        subtitle={`${event.date} · ${event.place}`}
        actions={
          <>
            <SoftButton onClick={notInDemo}>
              <Download className="h-[18px] w-[18px]" aria-hidden />
              Relatório
            </SoftButton>
            <PrimaryButton onClick={() => setSelling((v) => !v)}>
              <Ticket className="h-[18px] w-[18px]" aria-hidden />
              Vender ingresso
            </PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <span className="text-sm text-tv-text-2">Ingressos vendidos</span>
          <span className="mt-1 block font-display text-[26px] font-extrabold">{stats.sold}</span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">Check-ins</span>
          <span className="mt-1 block font-display text-[26px] font-extrabold">
            {stats.checkins}
            <span className="text-base font-semibold text-tv-text-2"> de {stats.sold}</span>
          </span>
        </Panel>
        <Panel>
          <span className="text-sm text-tv-text-2">A receber</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold text-[#7E3F00] dark:text-tv-warn">
            {brl(stats.open)}
          </span>
        </Panel>
        <Panel className="bg-tv-primary text-white">
          <span className="text-sm opacity-85">Arrecadado</span>
          <span className="mt-1 block font-display text-[22px] font-extrabold">
            {brl(stats.collected)}
          </span>
          <span className="text-[13px] opacity-80">Entra no caixa ao fechar o evento</span>
        </Panel>
      </div>

      {selling ? (
        <SellTicketForm
          org={org}
          event={event}
          onCancel={() => setSelling(false)}
          onSave={(g) => {
            setEvent((e) => ({ ...e, guests: [g, ...e.guests] }));
            setSelling(false);
            toast.success("Ingresso vendido", {
              description: `${g.name}: ${ticket(g.ticket).label} (${brl(ticket(g.ticket).price)})`,
            });
          }}
        />
      ) : null}

      <Segmented
        label="Seções do evento"
        value={tab}
        onChange={setTab}
        options={[
          { id: "participantes", label: "Participantes" },
          { id: "comandas", label: "Comandas" },
          { id: "produtos", label: "Produtos" },
        ]}
      />

      {tab === "participantes" ? (
        <>
          <div className="flex flex-wrap gap-2.5">
            <SearchBox value={q} onChange={setQ} label="Buscar participante" />
            <FilterChips options={GUEST_FILTERS} value={filter} onChange={setFilter} />
          </div>
          <ul className="overflow-hidden rounded-[20px] bg-tv-surface">
            {guests.length === 0 ? (
              <li className="px-5 py-8 text-center text-tv-text-2">
                Ninguém encontrado com esse filtro.
              </li>
            ) : null}
            {guests.map((g) => {
              const t = ticket(g.ticket);
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center gap-3 border-t border-tv-line px-4 py-3 first:border-0 sm:flex-nowrap"
                >
                  <Avatar name={g.name} size={40} />
                  <span className="min-w-0 flex-1 basis-[160px]">
                    <span className="block truncate text-[15px] font-semibold">{g.name}</span>
                    <span className="block text-[13px] text-tv-text-2">
                      {t.label} · {brl(t.price)}
                    </span>
                  </span>
                  {g.ticketPaid ? (
                    <Chip tone="in">Pago</Chip>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        updateGuest(g.id, (x) => ({ ...x, ticketPaid: true }));
                        toast.success("Pagamento recebido", {
                          description: `${g.name}: ${brl(t.price)}`,
                        });
                      }}
                      className="min-h-10 rounded-[10px] bg-tv-warn-bg px-3 text-sm font-semibold text-tv-warn"
                    >
                      Receber {brl(t.price)}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={g.checkedIn}
                    onClick={() => updateGuest(g.id, (x) => ({ ...x, checkedIn: !x.checkedIn }))}
                    className={cn(
                      "flex min-h-10 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-semibold",
                      g.checkedIn
                        ? "border-[#1F7A4D] bg-[#1F7A4D] text-white"
                        : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text",
                    )}
                  >
                    {g.checkedIn ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <QrCode className="h-4 w-4" aria-hidden />
                    )}
                    {g.checkedIn ? "Presente" : "Check-in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenTab(g.id)}
                    className="flex min-h-10 items-center gap-1.5 rounded-[10px] bg-tv-soft px-3 text-sm font-semibold text-tv-ink"
                  >
                    <Receipt className="h-4 w-4" aria-hidden />
                    Comanda
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {tab === "comandas" ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {event.guests
            .filter((g) => g.checkedIn || g.items.length > 0)
            .map((g) => {
              const total = g.items.reduce((s, i) => s + product(i.productId).price * i.qty, 0);
              const open = g.items
                .filter((i) => !i.paid)
                .reduce((s, i) => s + product(i.productId).price * i.qty, 0);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setOpenTab(g.id)}
                  className="flex flex-col gap-2 rounded-[18px] bg-tv-surface p-4 text-left transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)]"
                >
                  <span className="flex items-center gap-3">
                    <Avatar name={g.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{g.name}</span>
                      <span className="block text-[13px] text-tv-text-2">
                        {g.items.length} {g.items.length === 1 ? "item" : "itens"} · consumo{" "}
                        {brl(total)}
                      </span>
                    </span>
                  </span>
                  {open ? (
                    <Chip tone="warn">{brl(open)} em aberto</Chip>
                  ) : (
                    <Chip tone="in">Comanda quitada</Chip>
                  )}
                </button>
              );
            })}
        </div>
      ) : null}

      {tab === "produtos" ? (
        <div className="overflow-hidden rounded-[20px] bg-tv-surface">
          <div className="grid grid-cols-[1fr_90px_90px_90px] gap-3 px-5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-tv-text-2">
            <span>Produto</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Vendidos</span>
            <span className="text-right">Estoque</span>
          </div>
          {event.products.map((p) => {
            const sold = event.guests.reduce(
              (s, g) =>
                s + g.items.filter((i) => i.productId === p.id).reduce((a, i) => a + i.qty, 0),
              0,
            );
            const left = p.stock - sold;
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_90px_90px_90px] items-center gap-3 border-t border-tv-line px-5 py-3"
              >
                <span className="text-[15px] font-semibold">{p.label}</span>
                <span className="text-right">{brl(p.price)}</span>
                <span className="text-right">{sold}</span>
                <span className={cn("text-right font-semibold", left < 10 && "text-tv-out")}>
                  {left}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog open={current !== null} onOpenChange={(o) => !o && setOpenTab(null)}>
        {current ? (
          <TabDialog event={event} guest={current} onChange={(fn) => updateGuest(current.id, fn)} />
        ) : null}
      </Dialog>
    </div>
  );
}

function TabDialog({
  event,
  guest,
  onChange,
}: {
  event: SocialEvent;
  guest: Guest;
  onChange: (fn: (g: Guest) => Guest) => void;
}) {
  const [productId, setProductId] = useState(event.products[0].id);
  const [qty, setQty] = useState(1);
  const product = (id: string) => event.products.find((p) => p.id === id)!;
  const t = event.tickets.find((x) => x.id === guest.ticket)!;
  const open = guest.items
    .filter((i) => !i.paid)
    .reduce((s, i) => s + product(i.productId).price * i.qty, 0);
  const total = guest.items.reduce((s, i) => s + product(i.productId).price * i.qty, 0);

  function add(e: FormEvent) {
    e.preventDefault();
    if (qty < 1) return;
    onChange((g) => ({
      ...g,
      items: [...g.items, { id: `i${Date.now()}`, productId, qty, paid: false }],
    }));
    setQty(1);
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[22px] border-0 bg-tv-surface p-5 text-tv-text sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle className="font-display text-xl font-bold">
          Comanda · {guest.name.split(" ")[0]}
        </DialogTitle>
        <DialogDescription className="text-tv-text-2">{guest.name}</DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-2 rounded-[14px] bg-tv-bg px-4 py-3">
        <span className="text-[15px]">
          Ingresso {t.label} <span className="text-tv-text-2">({brl(t.price)})</span>
        </span>
        {guest.ticketPaid ? <Chip tone="in">Pago</Chip> : <Chip tone="warn">Pendente</Chip>}
      </div>

      <div>
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Consumo</span>
          <span>
            {brl(open)} em aberto{" "}
            <span className="font-medium text-tv-text-2">de {brl(total)}</span>
          </span>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {guest.items.length === 0 ? (
            <li className="rounded-[12px] border border-dashed border-tv-border px-4 py-4 text-center text-sm text-tv-text-2">
              Nenhum item na comanda. Adicione abaixo.
            </li>
          ) : null}
          {guest.items.map((it) => {
            const p = product(it.productId);
            return (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-[12px] border border-tv-border px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.label}</span>
                  <span className="block text-[13px] text-tv-text-2">
                    {it.qty} × {brl(p.price)} = {brl(it.qty * p.price)}
                  </span>
                </span>
                {it.paid ? (
                  <Chip tone="in">Pago</Chip>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onChange((g) => ({
                        ...g,
                        items: g.items.map((x) => (x.id === it.id ? { ...x, paid: true } : x)),
                      }))
                    }
                    className="min-h-9 rounded-[10px] bg-tv-soft px-3 text-sm font-semibold text-tv-ink"
                  >
                    Baixar
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remover ${p.label}`}
                  onClick={() =>
                    onChange((g) => ({ ...g, items: g.items.filter((x) => x.id !== it.id) }))
                  }
                  className="grid h-9 w-9 place-items-center rounded-[10px] text-tv-text-2 hover:bg-tv-bg"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={add} className="flex flex-col gap-2">
        <span className="text-sm font-bold">Adicionar item</span>
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Produto</span>
            <select
              className={fieldClass}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {event.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {brl(p.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="w-20">
            <span className="sr-only">Quantidade</span>
            <input
              type="number"
              min={1}
              max={20}
              className={fieldClass}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button
            type="submit"
            aria-label="Adicionar à comanda"
            className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px] bg-tv-primary text-white"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="text-[13px] text-tv-text-2">
          Os itens ficam em aberto até a baixa. Só então entram no caixa do evento.
        </p>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row">
        <SoftButton
          className="flex-1"
          onClick={() =>
            toast("Recibo gerado", {
              description:
                "Na versão completa, o recibo sai em PDF com QR Code Pix para pagamento.",
            })
          }
        >
          <Receipt className="h-[18px] w-[18px]" aria-hidden />
          Recibo / Pix
        </SoftButton>
        <PrimaryButton
          className="flex-1"
          disabled={open === 0 && guest.ticketPaid}
          onClick={() => {
            onChange((g) => ({
              ...g,
              ticketPaid: true,
              items: g.items.map((x) => ({ ...x, paid: true })),
            }));
            toast.success("Comanda quitada", {
              description: `${guest.name} não tem mais valores em aberto.`,
            });
          }}
        >
          Receber tudo
        </PrimaryButton>
      </div>
    </DialogContent>
  );
}

function SellTicketForm({
  org,
  event,
  onSave,
  onCancel,
}: {
  org: DemoOrg;
  event: SocialEvent;
  onSave: (g: Guest) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [ticket, setTicket] = useState(event.tickets[0].id);
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().split(/\s+/).length < 2)
      return setError("Escreva nome e sobrenome do participante.");
    onSave({
      id: `g${Date.now()}`,
      name: name.trim(),
      ticket,
      ticketPaid: paid,
      checkedIn: false,
      items: [],
    });
  }

  return (
    <form onSubmit={submit} className="rounded-[20px] bg-tv-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold">Vender ingresso</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-[10px] hover:bg-tv-bg"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Participante
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={org.kind === "loja" ? "Ex.: Maria Souza (cunhada)" : "Ex.: Maria Souza"}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Tipo de ingresso
          <select className={fieldClass} value={ticket} onChange={(e) => setTicket(e.target.value)}>
            {event.tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} · {brl(t.price)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-2.5 text-[15px]">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          className="h-5 w-5 accent-[var(--chapter-primary)]"
        />
        Pagamento já recebido
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-tv-out">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton type="submit">Confirmar venda</PrimaryButton>
        <SoftButton onClick={onCancel}>Cancelar</SoftButton>
      </div>
    </form>
  );
}
