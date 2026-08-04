import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Receipt, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatBRL } from "@/lib/format";
import { useChapterLogo } from "@/lib/chapter-logo";
import {
  INGRESSOS_CATEGORY_ID,
  addEventTicketItem,
  checkoutEventTicketComanda,
  deleteEventTicketItem,
  getComandaCheckout,
  listEventFinance,
  listEventTicketItems,
  updateEventTicketItem,
  type EventTicketItemRow,
} from "@/lib/event-finance.functions";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function parsePrice(value: string) {
  return Number(String(value).replace(",", "."));
}

/** Aceita só dígitos inteiros positivos (sem decimal). */
function sanitizeIntegerQty(raw: string) {
  return raw.replace(/\D/g, "");
}

function invalidateComanda(
  qc: ReturnType<typeof useQueryClient>,
  eventId: string,
) {
  qc.invalidateQueries({ queryKey: ["event-ticket-items", eventId] });
  qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
  qc.invalidateQueries({ queryKey: ["event-finance-totals", eventId] });
  qc.invalidateQueries({ queryKey: ["cash-entries"] });
  qc.invalidateQueries({ queryKey: ["cash-categories"] });
  qc.invalidateQueries({ queryKey: ["member-charges"] });
  qc.invalidateQueries({ queryKey: ["event", eventId] });
  qc.invalidateQueries({ queryKey: ["comanda-checkout", eventId] });
  qc.invalidateQueries({ queryKey: ["checkin-tickets"] });
}

type CheckoutData = Awaited<ReturnType<typeof getComandaCheckout>>;

function ComandaReceiptBody({
  data,
  pixQrUrl,
  showPix,
}: {
  data: CheckoutData;
  pixQrUrl: string | null;
  showPix: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 font-mono text-sm">
        <div className="text-center text-xs uppercase tracking-wide text-muted-foreground">
          {data.chapterName ?? "Capítulo"}
        </div>
        <div className="mt-1 text-center font-sans text-base font-semibold">
          {data.event.name}
        </div>
        <div className="mt-1 text-center text-xs text-muted-foreground">
          Comprador: {data.ticket.buyer_name}
          {data.ticket.seller_name
            ? ` · Vendedor: ${data.ticket.seller_name}`
            : ""}
        </div>
        <div className="my-3 border-t border-border border-dashed" />
        <div className="flex justify-between gap-2">
          <span>Ingresso</span>
          <span>{formatBRL(data.ticketAmount)}</span>
        </div>
        {data.lines.map((l) => (
          <div key={l.id} className="mt-1.5 flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {l.item_name ?? "Item"} × {l.qty}
            </span>
            <span className="shrink-0">{formatBRL(l.amount)}</span>
          </div>
        ))}
        <div className="my-3 border-t border-border border-dashed" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Consumo (comanda)</span>
          <span>{formatBRL(data.comandaTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between font-sans text-base font-semibold">
          <span>Total</span>
          <span>{formatBRL(data.grandTotal)}</span>
        </div>
        {data.charge ? (
          <div className="mt-2 text-center text-[11px] text-muted-foreground">
            Cobrança do ingresso:{" "}
            {data.charge.status === "pago" ? "paga" : "em aberto"}{" "}
            ({formatBRL(data.charge.amount)})
          </div>
        ) : (
          <div className="mt-2 text-center text-[11px] text-muted-foreground">
            Sem cobrança de vendedor vinculada a este ingresso.
          </div>
        )}
      </div>

      {showPix ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <div className="text-sm font-medium">Pagamento Pix</div>
          {data.pixKey || pixQrUrl ? (
            <>
              {data.pixKey ? (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                    {data.pixKey}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    aria-label="Copiar chave Pix"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(data.pixKey!);
                        toast.success("Chave Pix copiada");
                      } catch {
                        toast.error("Não foi possível copiar");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              {pixQrUrl ? (
                <div className="flex justify-center pt-2">
                  <img
                    src={pixQrUrl}
                    alt="QR Code Pix"
                    className="h-48 w-48 rounded-md border border-border bg-white object-contain p-2"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Configure a chave ou o QR Pix em Configurações → Tesouraria.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TicketComandaButton({
  eventId,
  ticketId,
  buyerName,
  eventName,
  primary,
  disabled,
  paid,
}: {
  eventId: string;
  ticketId: string;
  buyerName: string;
  eventName?: string;
  primary?: string;
  disabled?: boolean;
  /** Quando true, abre só o extrato (comanda já quitada). */
  paid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {paid ? (
          <Receipt className="mr-1 h-4 w-4" />
        ) : (
          <ShoppingBag className="mr-1 h-4 w-4" />
        )}
        {paid ? "Extrato" : "Comanda"}
      </Button>
      <TicketComandaDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
        ticketId={ticketId}
        buyerName={buyerName}
        eventName={eventName}
        primary={primary}
        paid={paid}
      />
    </>
  );
}

export function TicketComandaDialog({
  open,
  onOpenChange,
  eventId,
  ticketId,
  buyerName,
  eventName,
  primary,
  paid: paidHint,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
  ticketId: string;
  buyerName: string;
  eventName?: string;
  primary?: string;
  paid?: boolean;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<EventTicketItemRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const financeQ = useQuery({
    queryKey: ["event-finance", eventId],
    queryFn: () => listEventFinance({ data: { eventId } }),
    enabled: open,
  });
  const linesQ = useQuery({
    queryKey: ["event-ticket-items", eventId, ticketId],
    queryFn: () => listEventTicketItems({ data: { eventId, ticketId } }),
    enabled: open,
  });

  const checkoutQ = useQuery({
    queryKey: ["comanda-checkout", eventId, ticketId],
    queryFn: () => getComandaCheckout({ data: { eventId, ticketId } }),
    enabled: open,
  });

  const pixQrUrl = useChapterLogo(checkoutQ.data?.pixQrPath);
  const isPaid =
    paidHint === true || checkoutQ.data?.charge?.status === "pago";

  const categories = financeQ.data?.categories ?? [];
  const items = (financeQ.data?.items ?? []).filter(
    (i) =>
      i.active &&
      !i.is_system &&
      i.category_id !== INGRESSOS_CATEGORY_ID &&
      !i.id.startsWith("ticket-type:"),
  );
  const selected = items.find((i) => i.id === itemId);

  const grouped = useMemo(() => {
    return categories
      .filter(
        (c) =>
          !c.is_system &&
          c.id !== INGRESSOS_CATEGORY_ID &&
          c.name.trim().toLowerCase() !== "ingressos",
      )
      .map((c) => ({
        ...c,
        items: items.filter((i) => i.category_id === c.id),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, items]);

  const lines = linesQ.data ?? [];
  const comandaTotal = lines.reduce((s, l) => s + Number(l.amount), 0);
  const parsedQty = Number(qty);
  const parsedPrice = parsePrice(price);
  const parsedEditQty = Number(editQty);
  const parsedEditPrice = parsePrice(editPrice);

  const add = useMutation({
    mutationFn: () => {
      const unit =
        price.trim() === ""
          ? (selected?.unit_price ?? null)
          : parsePrice(price);
      return addEventTicketItem({
        data: {
          ticketId,
          itemId,
          qty: parsedQty,
          unit_price: unit,
        },
      });
    },
    onSuccess: () => {
      toast.success("Item adicionado à comanda e lançado no caixa");
      setItemId("");
      setQty("1");
      setPrice("");
      invalidateComanda(qc, eventId);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao adicionar")),
  });

  const saveEdit = useMutation({
    mutationFn: () =>
      updateEventTicketItem({
        data: {
          lineId: editing!.id,
          qty: parsedEditQty,
          unit_price: parsedEditPrice,
        },
      }),
    onSuccess: () => {
      toast.success("Item da comanda atualizado");
      setEditing(null);
      invalidateComanda(qc, eventId);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao atualizar")),
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) =>
      deleteEventTicketItem({ data: { lineId } }),
    onSuccess: () => {
      toast.success("Item removido da comanda e do caixa");
      invalidateComanda(qc, eventId);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  const confirmCheckout = useMutation({
    mutationFn: () =>
      checkoutEventTicketComanda({ data: { eventId, ticketId } }),
    onSuccess: (res) => {
      toast.success(
        res.alreadyPaid
          ? "Cobrança já estava quitada"
          : "Cobrança do ingresso quitada no perfil do vendedor",
      );
      invalidateComanda(qc, eventId);
      setCheckoutOpen(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro no checkout")),
  });

  function pickItem(id: string) {
    setItemId(id);
    const it = items.find((i) => i.id === id);
    setPrice(it?.unit_price == null ? "" : String(it.unit_price));
  }

  function openEdit(line: EventTicketItemRow) {
    setEditing(line);
    setEditQty(String(line.qty));
    setEditPrice(String(line.unit_price));
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setCheckoutOpen(false);
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {checkoutQ.isLoading ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {paidHint ? "Extrato" : "Comanda"} · {buyerName}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Carregando…</p>
            </>
          ) : checkoutQ.error ? (
            <>
              <DialogHeader>
                <DialogTitle>Comanda · {buyerName}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-destructive">
                {mutationErrorMessage(
                  checkoutQ.error,
                  "Erro ao carregar comanda",
                )}
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : isPaid && checkoutQ.data ? (
            <>
              <DialogHeader>
                <DialogTitle>Extrato · {buyerName}</DialogTitle>
                {eventName ? (
                  <p className="text-sm text-muted-foreground">{eventName}</p>
                ) : null}
              </DialogHeader>
              <ComandaReceiptBody
                data={checkoutQ.data}
                pixQrUrl={pixQrUrl}
                showPix={false}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Comanda · {buyerName}</DialogTitle>
                {eventName ? (
                  <p className="text-sm text-muted-foreground">{eventName}</p>
                ) : null}
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">Adicionar item</div>
                  {grouped.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Cadastre itens na aba Financeiro do evento primeiro.
                      Ingressos não podem ser lançados na comanda.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                        {grouped.map((c) => (
                          <div key={c.id}>
                            <div className="px-1 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {c.name}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {c.items.map((it) => (
                                <button
                                  key={it.id}
                                  type="button"
                                  onClick={() => pickItem(it.id)}
                                  className={`rounded-full border px-3 py-1 text-xs transition ${
                                    itemId === it.id
                                      ? "border-transparent text-white"
                                      : "border-border"
                                  }`}
                                  style={
                                    itemId === it.id
                                      ? { backgroundColor: primary }
                                      : undefined
                                  }
                                >
                                  {it.name}
                                  {it.unit_price != null
                                    ? ` · ${formatBRL(Number(it.unit_price))}`
                                    : ""}
                                  {it.track_stock
                                    ? ` (${it.stock_qty ?? 0})`
                                    : ""}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {itemId && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="mb-1 block text-xs">Qtd</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={qty}
                              onChange={(e) =>
                                setQty(sanitizeIntegerQty(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label className="mb-1 block text-xs">
                              Valor unit.{" "}
                              {selected?.unit_price == null ? "*" : ""}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              placeholder="R$"
                            />
                          </div>
                        </div>
                      )}
                      <Button
                        className="w-full"
                        disabled={
                          !itemId ||
                          add.isPending ||
                          !(Number.isInteger(parsedQty) && parsedQty >= 1) ||
                          !(
                            (price.trim() === "" &&
                              selected?.unit_price != null) ||
                            (Number.isFinite(parsedPrice) && parsedPrice >= 0)
                          )
                        }
                        onClick={() => add.mutate()}
                        style={{ backgroundColor: primary }}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Adicionar item
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Gera lançamento automático no Caixa (Eventos). Estoque,
                        se houver, é decrementado aqui.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-medium">
                    <span>Itens da comanda</span>
                    <span>{formatBRL(comandaTotal)}</span>
                  </div>
                  {lines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum item lançado ainda.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {lines.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {l.item_name ?? "Item"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {l.qty} × {formatBRL(Number(l.unit_price))}
                              {l.category_name ? ` · ${l.category_name}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="mr-1 font-medium">
                              {formatBRL(Number(l.amount))}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEdit(l)}
                              aria-label={`Editar ${l.item_name ?? "item"} da comanda`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              disabled={removeLine.isPending}
                              aria-label={`Excluir ${l.item_name ?? "item"} da comanda`}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Remover item da comanda?",
                                  description: `Remover “${l.item_name ?? "item"}” da comanda? O lançamento no caixa também será excluído e o estoque (se houver) será devolvido.`,
                                  confirmLabel: "Remover",
                                });
                                if (ok) removeLine.mutate(l.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <Receipt className="mr-2 h-4 w-4" /> Checkout
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!isPaid && checkoutOpen}
        onOpenChange={setCheckoutOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checkout · recibo</DialogTitle>
          </DialogHeader>
          {checkoutQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : checkoutQ.error ? (
            <p className="text-sm text-destructive">
              {mutationErrorMessage(checkoutQ.error, "Erro ao carregar recibo")}
            </p>
          ) : checkoutQ.data ? (
            <ComandaReceiptBody
              data={checkoutQ.data}
              pixQrUrl={pixQrUrl}
              showPix
            />
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>
              Fechar
            </Button>
            <Button
              style={{ backgroundColor: primary }}
              disabled={
                confirmCheckout.isPending ||
                !checkoutQ.data?.charge ||
                checkoutQ.data.charge.status === "pago"
              }
              onClick={() => confirmCheckout.mutate()}
            >
              {checkoutQ.data?.charge?.status === "pago"
                ? "Cobrança já quitada"
                : confirmCheckout.isPending
                  ? "Quitando…"
                  : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing && !isPaid}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm font-medium">
              {editing?.item_name ?? "Item"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block text-xs">Qtd</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editQty}
                  onChange={(e) =>
                    setEditQty(sanitizeIntegerQty(e.target.value))
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Valor unit.</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Atualiza o lançamento no caixa e ajusta o estoque se o item
              controlar quantidade.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                saveEdit.isPending ||
                !(Number.isInteger(parsedEditQty) && parsedEditQty >= 1) ||
                !(Number.isFinite(parsedEditPrice) && parsedEditPrice >= 0)
              }
              onClick={() => saveEdit.mutate()}
              style={{ backgroundColor: primary }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
