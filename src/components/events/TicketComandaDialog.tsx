import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
import { formatBRL } from "@/lib/format";
import {
  addEventTicketItem,
  deleteEventTicketItem,
  listEventFinance,
  listEventTicketItems,
  updateEventTicketItem,
  type EventTicketItemRow,
} from "@/lib/event-finance.functions";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
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
}

export function TicketComandaButton({
  eventId,
  ticketId,
  buyerName,
  primary,
  disabled,
}: {
  eventId: string;
  ticketId: string;
  buyerName: string;
  primary?: string;
  disabled?: boolean;
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
        <ShoppingBag className="mr-1 h-4 w-4" /> Comanda
      </Button>
      <TicketComandaDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
        ticketId={ticketId}
        buyerName={buyerName}
        primary={primary}
      />
    </>
  );
}

function TicketComandaDialog({
  open,
  onOpenChange,
  eventId,
  ticketId,
  buyerName,
  primary,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
  ticketId: string;
  buyerName: string;
  primary?: string;
}) {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<EventTicketItemRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");

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

  const categories = financeQ.data?.categories ?? [];
  const items = (financeQ.data?.items ?? []).filter((i) => i.active);
  const selected = items.find((i) => i.id === itemId);

  const grouped = useMemo(() => {
    return categories
      .map((c) => ({
        ...c,
        items: items.filter((i) => i.category_id === c.id),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, items]);

  const lines = linesQ.data ?? [];
  const comandaTotal = lines.reduce((s, l) => s + Number(l.amount), 0);

  const add = useMutation({
    mutationFn: () => {
      const unit =
        price.trim() === ""
          ? (selected?.unit_price ?? null)
          : Number(price.replace(",", "."));
      return addEventTicketItem({
        data: {
          ticketId,
          itemId,
          qty: Number(qty) || 1,
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
          qty: Number(editQty),
          unit_price: Number(String(editPrice).replace(",", ".")),
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comanda · {buyerName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-medium">Adicionar item</div>
              {grouped.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Cadastre itens na aba Financeiro do evento primeiro.
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
                          min={0.01}
                          step="1"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
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
                      !(Number(qty) > 0) ||
                      (selected?.unit_price == null && price.trim() === "")
                    }
                    onClick={() => add.mutate()}
                    style={{ backgroundColor: primary }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar item
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Gera lançamento automático no Caixa (Eventos). Estoque, se
                    houver, é decrementado aqui.
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
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          disabled={removeLine.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Remover “${l.item_name ?? "item"}” da comanda? O lançamento no caixa também será excluído e o estoque (se houver) será devolvido.`,
                              )
                            ) {
                              removeLine.mutate(l.id);
                            }
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

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
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
                  min={0.01}
                  step="1"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
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
                !(Number(editQty) > 0) ||
                editPrice.trim() === "" ||
                Number(editPrice) < 0
              }
              onClick={() => saveEdit.mutate()}
              style={{ backgroundColor: primary }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
