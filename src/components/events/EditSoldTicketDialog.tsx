import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { listChargeMembers } from "@/lib/finance.functions";
import { updateSoldTicket } from "@/lib/events.functions";
import { formatBRL } from "@/lib/format";

type TicketType = { id: string; name: string; price: number | string };

type EditableTicket = {
  id: string;
  buyer_name: string;
  seller_member_id: string | null;
  ticket_type_id: string | null;
  price_paid: number | string;
  seller_charge_paid?: boolean;
  seller_charge_amount_paid?: number;
};

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function EditSoldTicketDialog({
  open,
  onOpenChange,
  ticket,
  types,
  chapterId,
  eventId,
  primary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: EditableTicket | null;
  types: TicketType[];
  chapterId: string;
  eventId: string;
  primary?: string;
}) {
  const qc = useQueryClient();
  const [buyer, setBuyer] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [typeId, setTypeId] = useState("__avulso__");
  const [price, setPrice] = useState("");
  const [typeTouched, setTypeTouched] = useState(false);

  const sellersQ = useQuery({
    queryKey: ["charge-members", chapterId],
    queryFn: () => listChargeMembers({ data: { chapterId } }),
    enabled: open,
  });
  const sellerOptions = useMemo(
    () =>
      (sellersQ.data ?? []).map((s) => ({
        value: s.id,
        label: s.full_name,
      })),
    [sellersQ.data],
  );

  const sellerLocked = !!ticket && (ticket.seller_charge_amount_paid ?? 0) > 0;

  useEffect(() => {
    if (!open || !ticket) return;
    setBuyer(ticket.buyer_name);
    setSellerId(ticket.seller_member_id ?? "");
    setTypeId(ticket.ticket_type_id ?? "__avulso__");
    setPrice(String(Number(ticket.price_paid) || 0));
    setTypeTouched(false);
  }, [open, ticket]);

  useEffect(() => {
    if (!open || !typeTouched) return;
    if (typeId === "__avulso__") return;
    const t = types.find((x) => x.id === typeId);
    if (t) setPrice(String(Number(t.price) || 0));
  }, [typeId, types, open, typeTouched]);

  const parsedPrice = Number(String(price).replace(",", "."));
  const typeChanged =
    !!ticket &&
    (ticket.ticket_type_id ?? null) !==
      (typeId === "__avulso__" ? null : typeId);
  const priceChanged =
    !!ticket && Math.abs(Number(ticket.price_paid) - parsedPrice) > 0.001;

  const save = useMutation({
    mutationFn: () => {
      if (!ticket) throw new Error("Ingresso inválido");
      return updateSoldTicket({
        data: {
          ticketId: ticket.id,
          buyerName: buyer.trim(),
          sellerMemberId: sellerId || null,
          ticketTypeId: typeId === "__avulso__" ? null : typeId,
          pricePaid: parsedPrice,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ingresso atualizado");
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
      qc.invalidateQueries({ queryKey: ["event-finance-totals", eventId] });
      qc.invalidateQueries({ queryKey: ["member-charges"] });
      qc.invalidateQueries({ queryKey: ["comanda-checkout", eventId] });
      qc.invalidateQueries({ queryKey: ["checkin-tickets"] });
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(mutationErrorMessage(e, "Erro ao atualizar ingresso")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar ingresso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs">Comprador *</Label>
            <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Vendedor</Label>
            <SearchableSelect
              value={sellerId}
              options={sellerOptions}
              onChange={setSellerId}
              placeholder="Buscar membro…"
              searchPlaceholder="Digite o nome…"
              emptyText="Nenhum membro encontrado."
              disabled={sellersQ.isLoading || sellerLocked}
            />
            {sellerLocked ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Não é possível trocar o vendedor após pagamento da cobrança.
              </p>
            ) : null}
          </div>
          <div>
            <Label className="mb-1 block text-xs">Tipo</Label>
            <Select
              value={typeId}
              onValueChange={(v) => {
                setTypeTouched(true);
                setTypeId(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Avulso" />
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
          </div>
          <div>
            <Label className="mb-1 block text-xs">Valor</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {typeChanged || priceChanged ? (
            <p className="text-[11px] text-muted-foreground">
              A cobrança do vendedor será sincronizada com o novo valor (
              {formatBRL(Number.isFinite(parsedPrice) ? parsedPrice : 0)}).
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            style={{ backgroundColor: primary }}
            disabled={
              save.isPending ||
              buyer.trim().length < 2 ||
              !(Number.isFinite(parsedPrice) && parsedPrice >= 0)
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
