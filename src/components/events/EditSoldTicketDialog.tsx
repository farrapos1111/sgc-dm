import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

function typePrice(types: TicketType[], typeId: string): number | null {
  if (typeId === "__avulso__") return null;
  const t = types.find((x) => x.id === typeId);
  return t ? Number(t.price) || 0 : null;
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    const tid = ticket.ticket_type_id ?? "__avulso__";
    setTypeId(tid);
    setPrice(String(Number(ticket.price_paid) || 0));
    const catalog = typePrice(types, tid);
    const paid = Number(ticket.price_paid) || 0;
    setAdvancedOpen(
      catalog != null ? Math.abs(catalog - paid) > 0.001 : paid > 0,
    );
  }, [open, ticket, types]);

  const parsedPrice = Number(String(price).replace(",", "."));
  const catalogPrice = typePrice(types, typeId);
  const usingCatalogPrice =
    catalogPrice != null && Math.abs(catalogPrice - parsedPrice) < 0.001;
  const typeChanged =
    !!ticket &&
    (ticket.ticket_type_id ?? null) !==
      (typeId === "__avulso__" ? null : typeId);
  const priceChanged =
    !!ticket && Math.abs(Number(ticket.price_paid) - parsedPrice) > 0.001;

  function handleTypeChange(v: string) {
    setTypeId(v);
    const next = typePrice(types, v);
    if (next != null) {
      setPrice(String(next));
      setAdvancedOpen(false);
    }
  }

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
            <Select value={typeId} onValueChange={handleTypeChange}>
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              Valor:{" "}
              <span className="font-medium text-foreground">
                {formatBRL(Number.isFinite(parsedPrice) ? parsedPrice : 0)}
              </span>
              {usingCatalogPrice
                ? " (preço do tipo)"
                : catalogPrice != null
                  ? " (personalizado)"
                  : null}
            </p>
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
                  <Label className="mb-1 block text-xs">Valor</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Por padrão usa o preço do tipo. Altere só se a venda for
                    diferente.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
