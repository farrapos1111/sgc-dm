import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Copy,
  Pencil,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChapterLogo } from "@/lib/chapter-logo";
import { useTicketComandaRealtime } from "@/hooks/useTicketComandaRealtime";
import {
  INGRESSOS_CATEGORY_ID,
  addEventTicketItem,
  checkoutEventTicketComanda,
  deleteEventTicketItem,
  getComandaCheckout,
  listEventFinance,
  listEventTicketItems,
  payEventTicketItem,
  settleEventTicketComanda,
  updateEventTicketItem,
  type EventTicketItemRow,
} from "@/lib/event-finance.functions";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function parsePrice(value: string) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
}

/** Digitação em centavos: 1 → 0,01 · 10 → 0,10 · 100 → 1,00. */
function formatMoneyFromDigits(raw: string, max?: number): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  let value = Number(digits) / 100;
  if (!Number.isFinite(value)) return "";
  if (max != null && Number.isFinite(max) && max >= 0 && value > max + 1e-9) {
    value = Math.round(max * 100) / 100;
  }
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyFromNumber(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function TenderPayFields({
  method,
  onMethodChange,
  amount,
  onAmountChange,
  totalDue,
  sellerName,
  pixKey,
  pixQrUrl,
  idPrefix = "tender",
}: {
  method: "pix" | "dinheiro";
  onMethodChange: (method: "pix" | "dinheiro") => void;
  amount: string;
  onAmountChange: (value: string) => void;
  totalDue: number;
  sellerName?: string | null;
  pixKey?: string | null;
  pixQrUrl?: string | null;
  idPrefix?: string;
}) {
  const cashAmount = parsePrice(amount);
  const troco =
    Number.isFinite(cashAmount) && cashAmount > totalDue + 0.001
      ? cashAmount - totalDue
      : 0;
  const remainder =
    Number.isFinite(cashAmount) &&
    cashAmount > 0 &&
    cashAmount < totalDue - 0.001
      ? totalDue - cashAmount
      : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        <button
          type="button"
          className={cn(
            "h-9 rounded-sm text-sm font-medium transition-colors",
            method === "pix"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            onMethodChange("pix");
            if (amount) onAmountChange(formatMoneyFromDigits(amount, totalDue));
          }}
        >
          Pix
        </button>
        <button
          type="button"
          className={cn(
            "h-9 rounded-sm text-sm font-medium transition-colors",
            method === "dinheiro"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onMethodChange("dinheiro")}
        >
          Dinheiro
        </button>
      </div>

      {method === "pix" ? (
        <div className="space-y-2">
          {pixKey || pixQrUrl ? (
            <>
              {pixKey ? (
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                    {pixKey}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    aria-label="Copiar chave Pix"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pixKey);
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
          <div className="space-y-2 pt-2">
            <Label htmlFor={`${idPrefix}-pix`} className="text-xs">
              Pago parcial
            </Label>
            <Input
              id={`${idPrefix}-pix`}
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={amount}
              onChange={(e) =>
                onAmountChange(formatMoneyFromDigits(e.target.value, totalDue))
              }
            />
            {remainder > 0 ? (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                O saldo de {formatBRL(remainder)} será alocado no perfil
                {sellerName ? ` de ${sellerName}` : " do vendedor"}.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-cash`} className="text-xs">
            Valor recebido
          </Label>
          <Input
            id={`${idPrefix}-cash`}
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={amount}
            onChange={(e) =>
              onAmountChange(formatMoneyFromDigits(e.target.value))
            }
          />
          {troco > 0 ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Troco a devolver: {formatBRL(troco)}
            </p>
          ) : null}
          {remainder > 0 ? (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              O saldo de {formatBRL(remainder)} será alocado no perfil
              {sellerName ? ` de ${sellerName}` : " do vendedor"}.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ComandaReceiptBody({
  data,
  pixQrUrl,
  payMethod,
  onPayMethodChange,
  cashPaid,
  onCashPaidChange,
}: {
  data: CheckoutData;
  pixQrUrl: string | null;
  payMethod: "pix" | "dinheiro";
  onPayMethodChange: (method: "pix" | "dinheiro") => void;
  cashPaid: string;
  onCashPaidChange: (value: string) => void;
}) {
  // Cortesia (R$ 0) conta como quitada; com valor, exige status pago ou saldo 0.
  const ticketFace = data.charge?.amount ?? data.ticketAmount;
  const ticketDue = data.ticketDue ?? ticketFace;
  const ticketPaid =
    ticketDue <= 0 ||
    (data.charge != null &&
      (data.charge.status === "pago" || data.charge.remaining <= 0));
  const totalDue = data.grandTotal;
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
        <div
          className={cn(
            "flex justify-between gap-2",
            ticketPaid && "text-muted-foreground",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate", ticketPaid && "line-through")}>
              {data.ticket.ticket_type_name ?? "Ingresso"}
            </span>
            {ticketPaid ? (
              <Badge
                variant="secondary"
                className="font-sans text-[10px] no-underline"
              >
                Pago
              </Badge>
            ) : data.charge && data.charge.amount_paid > 0 ? (
              <Badge variant="outline" className="font-sans text-[10px]">
                Pago parcial
              </Badge>
            ) : (
              <Badge variant="outline" className="font-sans text-[10px]">
                Em aberto
              </Badge>
            )}
          </span>
          <span className={cn("shrink-0", ticketPaid && "line-through")}>
            {formatBRL(ticketFace)}
          </span>
        </div>
        {data.charge && data.charge.amount_paid > 0 && !ticketPaid ? (
          <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
            <span>Pago parcial / saldo</span>
            <span>
              {formatBRL(data.charge.amount_paid)} /{" "}
              {formatBRL(data.charge.remaining)}
            </span>
          </div>
        ) : null}
        {data.lines.map((l) => (
          <div
            key={l.id}
            className={cn(
              "mt-1.5 flex justify-between gap-2",
              l.paid && "text-muted-foreground",
            )}
          >
            <span className={cn("min-w-0 truncate", l.paid && "line-through")}>
              {l.item_name ?? "Item"} × {l.qty}
            </span>
            <span className={cn("shrink-0", l.paid && "line-through")}>
              {formatBRL(l.amount)}
            </span>
          </div>
        ))}
        <div className="my-3 border-t border-border border-dashed" />
        {(data.paidTotal ?? 0) > 0.001 ? (
          <div className="flex justify-between gap-2 text-sm text-muted-foreground">
            <span>Pago parcial</span>
            <span>{formatBRL(data.paidTotal)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between font-sans text-base font-semibold">
          <span>Total</span>
          <span>{formatBRL(data.grandTotal)}</span>
        </div>
      </div>

      <div className="rounded-md border border-border p-4">
        <TenderPayFields
          method={payMethod}
          onMethodChange={onPayMethodChange}
          amount={cashPaid}
          onAmountChange={onCashPaidChange}
          totalDue={totalDue}
          sellerName={data.ticket.seller_name}
          pixKey={data.pixKey}
          pixQrUrl={pixQrUrl}
          idPrefix="recibo"
        />
      </div>
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
  /** Quando true, sugere modo extrato (tudo quitado). */
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
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<EventTicketItemRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptPayMethod, setReceiptPayMethod] = useState<"pix" | "dinheiro">(
    "pix",
  );
  const [receiptCashPaid, setReceiptCashPaid] = useState("");
  const [payingLine, setPayingLine] = useState<EventTicketItemRow | null>(null);
  const [itemPayMethod, setItemPayMethod] = useState<"pix" | "dinheiro">("pix");
  const [itemPayInput, setItemPayInput] = useState("");

  useEffect(() => {
    setItemId("");
    setQty("0");
    setPrice("");
    if (!open) {
      setCheckoutOpen(false);
      setReceiptPayMethod("pix");
      setReceiptCashPaid("");
      setPayingLine(null);
      setItemPayMethod("pix");
      setItemPayInput("");
      setEditing(null);
    }
  }, [open]);

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

  useTicketComandaRealtime({
    eventId,
    ticketId,
    chargeId: checkoutQ.data?.charge?.id ?? null,
    enabled: open,
  });

  const pixQrUrl = useChapterLogo(checkoutQ.data?.pixQrPath);
  const checkout = checkoutQ.data;
  const hasTicketCharge = !!checkout?.charge;
  const ticketRemaining = checkout?.charge?.remaining ?? 0;
  const chargeAmount = checkout?.charge?.amount ?? checkout?.ticketAmount ?? 0;
  // Cortesia (R$ 0) não gera pendência; com valor, exige quitação.
  const ticketFullyPaid =
    chargeAmount <= 0 ||
    (hasTicketCharge &&
      (checkout!.charge!.status === "pago" || ticketRemaining <= 0));
  const lines = linesQ.data ?? [];
  const unpaidLines = lines.filter((l) => !l.paid);

  const categories = financeQ.data?.categories ?? [];
  const items = (financeQ.data?.items ?? []).filter(
    (i) =>
      i.active &&
      !i.is_system &&
      i.category_id !== INGRESSOS_CATEGORY_ID &&
      !i.id.startsWith("ticket-type:"),
  );
  const selected = items.find((i) => i.id === itemId);

  const itemOptions = useMemo(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    return items.map((it) => {
      const cat = catName.get(it.category_id) ?? "";
      const priceLabel =
        it.unit_price != null ? ` · ${formatBRL(Number(it.unit_price))}` : "";
      const stock = it.track_stock ? ` (${it.stock_qty ?? 0})` : "";
      return {
        value: it.id,
        label: `${it.name}${priceLabel}${stock}`,
        group: cat || undefined,
      };
    });
  }, [categories, items]);

  const comandaTotal = lines.reduce((s, l) => s + Number(l.amount), 0);
  const unpaidComandaTotal = unpaidLines.reduce(
    (s, l) => s + Number(l.amount),
    0,
  );
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
      toast.success("Item adicionado à comanda");
      setItemId("");
      setQty("0");
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
    mutationFn: (lineId: string) => deleteEventTicketItem({ data: { lineId } }),
    onSuccess: () => {
      toast.success("Item removido da comanda");
      invalidateComanda(qc, eventId);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  const payLine = useMutation({
    mutationFn: (input: {
      lineId: string;
      tender: "pix" | "dinheiro";
      amount?: number;
    }) =>
      payEventTicketItem({
        data: {
          lineId: input.lineId,
          tender: input.tender,
          amount: input.amount,
        },
      }),
    onSuccess: (res) => {
      if (res.alreadyPaid) {
        toast.success("Item já estava baixado");
      } else if (res.remaining && res.remaining > 0.001) {
        toast.success(
          `Pagamento de ${formatBRL(res.amount)} registrado · cobrança de ${formatBRL(res.remaining)} criada`,
        );
      } else {
        toast.success("Item baixado e lançado no caixa");
      }
      setPayingLine(null);
      setItemPayInput("");
      setItemPayMethod("pix");
      invalidateComanda(qc, eventId);
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao baixar item")),
  });

  const payTicket = useMutation({
    mutationFn: (amount?: number) =>
      checkoutEventTicketComanda({
        data: { eventId, ticketId, amount },
      }),
    onSuccess: (res) => {
      if (res.alreadyPaid) {
        toast.success("Ingresso já estava quitado");
      } else if (res.fullyPaid) {
        toast.success("Ingresso quitado e lançado no caixa");
      } else {
        toast.success(
          `Baixa do ingresso: ${formatBRL(res.amount)} · saldo ${formatBRL(res.remaining)}`,
        );
      }
      invalidateComanda(qc, eventId);
    },
    onError: (e) =>
      toast.error(mutationErrorMessage(e, "Erro ao baixar ingresso")),
  });

  const receiptCashAmount = parsePrice(receiptCashPaid);
  const receiptTotalDue = checkout?.grandTotal ?? 0;
  const hasReceiptAmount =
    receiptCashPaid.trim() !== "" &&
    Number.isFinite(receiptCashAmount) &&
    receiptCashAmount > 0;
  const receiptPayAmount = hasReceiptAmount
    ? Math.min(receiptCashAmount, receiptTotalDue || receiptCashAmount)
    : receiptTotalDue;
  const receiptRemainder = Math.max(0, receiptTotalDue - receiptPayAmount);

  const registerReceiptPayment = useMutation({
    mutationFn: () =>
      settleEventTicketComanda({
        data: {
          eventId,
          ticketId,
          tender: receiptPayMethod,
          amount: hasReceiptAmount ? receiptPayAmount : undefined,
        },
      }),
    onSuccess: (res) => {
      if (res.alreadyPaid) {
        toast.success("Comanda já estava quitada");
      } else if (res.fullyPaid) {
        toast.success("Pagamento registrado no caixa");
      } else {
        toast.success(
          `Pagamento de ${formatBRL(res.amount)} registrado · cobrança de ${formatBRL(res.remaining)} criada`,
        );
      }
      setCheckoutOpen(false);
      setReceiptCashPaid("");
      setReceiptPayMethod("pix");
    },
    onError: (e) =>
      toast.error(mutationErrorMessage(e, "Erro ao registrar pagamento")),
    onSettled: () => {
      invalidateComanda(qc, eventId);
    },
  });

  async function confirmReceiptPayment() {
    if (receiptPayMethod === "dinheiro" && !hasReceiptAmount) {
      toast.error("Informe o valor recebido em dinheiro");
      return;
    }
    if (receiptCashPaid.trim() !== "" && !hasReceiptAmount) {
      toast.error("Informe um valor válido");
      return;
    }
    const sellerName = checkout?.ticket.seller_name;
    const ok = await confirm({
      title: "Registrar pagamento?",
      description:
        receiptRemainder > 0.001
          ? `Registrar ${formatBRL(receiptPayAmount)} no caixa e criar cobrança de ${formatBRL(receiptRemainder)}${sellerName ? ` para ${sellerName}` : " no vendedor"}.`
          : `Registrar ${formatBRL(receiptPayAmount || receiptTotalDue)} no fluxo de caixa.`,
      confirmLabel: "Registrar",
    });
    if (ok) registerReceiptPayment.mutate();
  }

  const itemPayTotal = Number(payingLine?.amount) || 0;
  const itemPayParsed = parsePrice(itemPayInput);
  const hasItemPayAmount =
    itemPayInput.trim() !== "" &&
    Number.isFinite(itemPayParsed) &&
    itemPayParsed > 0;
  const itemPayAmount = hasItemPayAmount
    ? Math.min(itemPayParsed, itemPayTotal || itemPayParsed)
    : itemPayTotal;
  const itemPayRemainder = Math.max(0, itemPayTotal - itemPayAmount);

  async function confirmItemPayment() {
    if (!payingLine) return;
    if (itemPayMethod === "dinheiro" && !hasItemPayAmount) {
      toast.error("Informe o valor recebido em dinheiro");
      return;
    }
    if (itemPayInput.trim() !== "" && !hasItemPayAmount) {
      toast.error("Informe um valor válido");
      return;
    }
    const sellerName = checkout?.ticket.seller_name;
    const ok = await confirm({
      title: "Registrar pagamento do item?",
      description:
        itemPayRemainder > 0.001
          ? `Registrar ${formatBRL(itemPayAmount)} no caixa e criar cobrança de ${formatBRL(itemPayRemainder)}${sellerName ? ` para ${sellerName}` : " no vendedor"}.`
          : `Registrar ${formatBRL(itemPayAmount || itemPayTotal)} no fluxo de caixa.`,
      confirmLabel: "Registrar",
    });
    if (!ok) return;
    payLine.mutate({
      lineId: payingLine.id,
      tender: itemPayMethod,
      amount: hasItemPayAmount ? itemPayAmount : undefined,
    });
  }

  function pickItem(id: string) {
    setItemId(id);
    const it = items.find((i) => i.id === id);
    setPrice(
      it?.unit_price == null ? "" : formatMoneyFromNumber(Number(it.unit_price)),
    );
  }

  function openEdit(line: EventTicketItemRow) {
    setEditing(line);
    setEditQty(String(line.qty));
    setEditPrice(formatMoneyFromNumber(Number(line.unit_price)));
  }

  const hasPending =
    (hasTicketCharge && !ticketFullyPaid) || unpaidLines.length > 0;

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
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {unpaidLines.length === 0 &&
                  ticketFullyPaid &&
                  lines.length > 0
                    ? "Extrato"
                    : "Comanda"}{" "}
                  · {buyerName}
                </DialogTitle>
                {eventName ? (
                  <p className="text-sm text-muted-foreground">{eventName}</p>
                ) : null}
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md border border-border px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {checkout?.ticket.ticket_type_name ?? "Ingresso"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {!hasTicketCharge
                          ? "Sem cobrança vinculada"
                          : ticketFullyPaid
                            ? "Quitado"
                            : checkout?.ticket.seller_name
                              ? ticketRemaining > 0 &&
                                ticketRemaining < chargeAmount
                                ? `Cobrança vinculada a ${checkout.ticket.seller_name} · Saldo ${formatBRL(ticketRemaining)}`
                                : `Cobrança vinculada a ${checkout.ticket.seller_name}`
                              : ticketRemaining > 0 &&
                                  ticketRemaining < chargeAmount
                                ? `Saldo ${formatBRL(ticketRemaining)}`
                                : "Cobrança vinculada ao vendedor"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatBRL(chargeAmount)}
                      </span>
                      {ticketFullyPaid ? (
                        <Badge variant="secondary">Pago</Badge>
                      ) : hasTicketCharge ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={payTicket.isPending}
                          onClick={() => payTicket.mutate(undefined)}
                        >
                          <Banknote className="mr-1 h-3.5 w-3.5" />
                          Baixar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-medium">
                    <span>Consumo</span>
                    <span>
                      {unpaidComandaTotal > 0 &&
                      unpaidComandaTotal < comandaTotal
                        ? `${formatBRL(unpaidComandaTotal)} em aberto · ${formatBRL(comandaTotal)}`
                        : formatBRL(comandaTotal)}
                    </span>
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
                            <div className="flex items-center gap-2 truncate font-medium">
                              <span className="truncate">
                                {l.item_name ?? "Item"}
                              </span>
                              {l.paid ? (
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 text-[10px]"
                                >
                                  Pago
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-[10px]"
                                >
                                  Em aberto
                                </Badge>
                              )}
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
                            {!l.paid ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                disabled={payLine.isPending}
                                onClick={() => {
                                  setPayingLine(l);
                                  setItemPayMethod("pix");
                                  setItemPayInput("");
                                }}
                              >
                                Baixar
                              </Button>
                            ) : null}
                            {!l.paid ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEdit(l)}
                                aria-label={`Editar ${l.item_name ?? "item"} da comanda`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              disabled={removeLine.isPending}
                              aria-label={`Excluir ${l.item_name ?? "item"} da comanda`}
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Remover item da comanda?",
                                  description: l.paid
                                    ? `Remover “${l.item_name ?? "item"}”? O lançamento no caixa também será excluído e o estoque (se houver) será devolvido.`
                                    : `Remover “${l.item_name ?? "item"}” da comanda? O estoque (se houver) será devolvido.`,
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

                <div>
                  <div className="mb-2 text-sm font-medium">Adicionar item</div>
                  {itemOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Cadastre itens na aba Financeiro do evento primeiro.
                      Ingressos não podem ser lançados na comanda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <SearchableSelect
                            value={itemId}
                            options={itemOptions}
                            onChange={pickItem}
                            placeholder="Buscar item…"
                            searchPlaceholder="Nome ou categoria…"
                            emptyText="Nenhum item encontrado."
                          />
                        </div>
                        <div className="w-16 shrink-0">
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
                        <Button
                          size="icon"
                          className="shrink-0"
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
                          aria-label="Adicionar item"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {itemId && selected?.unit_price == null ? (
                        <div>
                          <Label className="mb-1 block text-xs">
                            Valor unit. *
                          </Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={price}
                            onChange={(e) =>
                              setPrice(formatMoneyFromDigits(e.target.value))
                            }
                            placeholder="0,00"
                          />
                        </div>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        Itens ficam em aberto até a baixa. Só então entram no
                        fluxo de caixa (Eventos). Estoque, se houver, é
                        decrementado ao adicionar.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReceiptPayMethod("pix");
                    setReceiptCashPaid("");
                    setCheckoutOpen(true);
                  }}
                >
                  <Receipt className="mr-2 h-4 w-4" /> Recibo / Pix
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) {
            setReceiptPayMethod("pix");
            setReceiptCashPaid("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recibo · Pix</DialogTitle>
          </DialogHeader>
          {checkoutQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : checkoutQ.error ? (
            <p className="text-sm text-destructive">
              {mutationErrorMessage(checkoutQ.error, "Erro ao carregar recibo")}
            </p>
          ) : checkoutQ.data ? (
            <ComandaReceiptBody
              key={`${ticketId}-${checkoutOpen}`}
              data={checkoutQ.data}
              pixQrUrl={pixQrUrl}
              payMethod={receiptPayMethod}
              onPayMethodChange={setReceiptPayMethod}
              cashPaid={receiptCashPaid}
              onCashPaidChange={setReceiptCashPaid}
            />
          ) : null}
          {hasPending ? (
            <DialogFooter>
              <Button
                style={{ backgroundColor: primary }}
                disabled={
                  registerReceiptPayment.isPending ||
                  (receiptPayMethod === "dinheiro" && !hasReceiptAmount)
                }
                onClick={() => void confirmReceiptPayment()}
              >
                {registerReceiptPayment.isPending
                  ? "Registrando…"
                  : "Registrar pagamento"}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!payingLine}
        onOpenChange={(o) => {
          if (!o) {
            setPayingLine(null);
            setItemPayMethod("pix");
            setItemPayInput("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Baixar item</DialogTitle>
          </DialogHeader>
          {payingLine ? (
            <div className="space-y-3">
              <div className="rounded-md border border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {payingLine.item_name ?? "Item"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {payingLine.qty} × {formatBRL(Number(payingLine.unit_price))}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatBRL(Number(payingLine.amount))}
                  </span>
                </div>
              </div>
              <TenderPayFields
                method={itemPayMethod}
                onMethodChange={setItemPayMethod}
                amount={itemPayInput}
                onAmountChange={setItemPayInput}
                totalDue={itemPayTotal}
                sellerName={checkout?.ticket.seller_name}
                pixKey={checkout?.pixKey}
                pixQrUrl={pixQrUrl}
                idPrefix="item-pay"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPayingLine(null);
                setItemPayInput("");
                setItemPayMethod("pix");
              }}
            >
              Cancelar
            </Button>
            <Button
              style={{ backgroundColor: primary }}
              disabled={
                payLine.isPending ||
                (itemPayMethod === "dinheiro" && !hasItemPayAmount)
              }
              onClick={() => void confirmItemPayment()}
            >
              {payLine.isPending ? "Registrando…" : "Registrar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
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
                  type="text"
                  inputMode="numeric"
                  value={editPrice}
                  onChange={(e) =>
                    setEditPrice(formatMoneyFromDigits(e.target.value))
                  }
                  placeholder="0,00"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Só itens em aberto podem ser editados. Ajuste o estoque se o item
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
