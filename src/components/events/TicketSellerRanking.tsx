import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatBRL } from "@/lib/format";
import { datePartsInAppTz } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export type SellerRankingTicket = {
  id: string;
  status: string;
  buyer_name: string;
  price_paid: number | string | null;
  ticket_type_id: string | null;
  seller_member_id: string | null;
  seller_name: string | null;
  sold_at?: string | null;
};

export type SellerRankingTicketType = {
  id: string;
  name: string;
};

type SellerBucket = {
  key: string;
  name: string;
  tickets: SellerRankingTicket[];
};

function buildRanking(tickets: SellerRankingTicket[]): SellerBucket[] {
  const bySeller = new Map<string, SellerBucket>();

  for (const t of tickets) {
    if (t.status === "cancelado") continue;
    const key = t.seller_member_id ?? "__none__";
    const name =
      t.seller_name?.trim() ||
      (t.seller_member_id ? "Vendedor" : "Sem vendedor");
    const bucket = bySeller.get(key) ?? { key, name, tickets: [] };
    bucket.tickets.push(t);
    bySeller.set(key, bucket);
  }

  const rows = [...bySeller.values()];
  for (const row of rows) {
    row.tickets.sort((a, b) => {
      const ta = a.sold_at ? Date.parse(a.sold_at) : 0;
      const tb = b.sold_at ? Date.parse(b.sold_at) : 0;
      if (tb !== ta) return tb - ta;
      return a.buyer_name.localeCompare(b.buyer_name, "pt-BR");
    });
  }

  rows.sort((a, b) => {
    if (b.tickets.length !== a.tickets.length) {
      return b.tickets.length - a.tickets.length;
    }
    const sumA = a.tickets.reduce((s, t) => s + Number(t.price_paid ?? 0), 0);
    const sumB = b.tickets.reduce((s, t) => s + Number(t.price_paid ?? 0), 0);
    if (sumB !== sumA) return sumB - sumA;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return rows;
}

function ordinal(n: number) {
  return `${n}º`;
}

function formatEventDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const { day, month, year } = datePartsInAppTz(d);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function buildSellerRankingMessage({
  eventName,
  eventStartsAt,
  ranking,
}: {
  eventName: string;
  eventStartsAt: string;
  ranking: Array<{ name: string; tickets: { length: number } }>;
}): string {
  const day = formatEventDay(eventStartsAt);
  const lines = ranking.map(
    (row, idx) => `${ordinal(idx + 1)} ${row.name} - ${row.tickets.length}`,
  );
  const total = ranking.reduce((s, row) => s + row.tickets.length, 0);
  return [
    `Ranking vendedores do ${eventName} dia ${day}`,
    "",
    ...lines,
    "",
    `Total de ingressos vendidos: ${total}`,
  ].join("\n");
}

export function TicketSellerRanking({
  tickets,
  ticketTypes,
  eventName,
  eventStartsAt,
  primary,
}: {
  tickets: SellerRankingTicket[];
  ticketTypes: SellerRankingTicketType[];
  eventName: string;
  eventStartsAt: string;
  primary?: string | null;
}) {
  const typeNameById = useMemo(
    () => new Map(ticketTypes.map((t) => [t.id, t.name])),
    [ticketTypes],
  );
  const ranking = useMemo(() => buildRanking(tickets), [tickets]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);

  const message = useMemo(
    () =>
      buildSellerRankingMessage({
        eventName,
        eventStartsAt,
        ranking,
      }),
    [eventName, eventStartsAt, ranking],
  );

  function toggle(key: string, open: boolean) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Ranking copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const accent = primary || undefined;

  return (
    <Card className="rounded-[12px] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Trophy className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Ranking de vendedores</div>
          <div className="text-xs text-muted-foreground">
            Por quantidade de ingressos vendidos (exceto cancelados)
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void copyMessage()}
          disabled={ranking.length === 0}
        >
          {copied ? (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar ranking"}
        </Button>
      </div>

      {ranking.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">
          Ainda não há vendas de ingresso para montar o ranking.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {ranking.map((row, idx) => {
            const place = idx + 1;
            const open = openKeys.has(row.key);
            const totalValue = row.tickets.reduce(
              (s, t) => s + Number(t.price_paid ?? 0),
              0,
            );
            return (
              <li key={row.key}>
                <Collapsible
                  open={open}
                  onOpenChange={(v) => toggle(row.key, v)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                          place === 1
                            ? "bg-foreground text-background"
                            : place === 2
                              ? "bg-muted text-foreground"
                              : place === 3
                                ? "bg-muted/70 text-foreground"
                                : "bg-transparent text-muted-foreground",
                        )}
                        style={
                          place === 1 && accent
                            ? { backgroundColor: accent, color: "#fff" }
                            : undefined
                        }
                      >
                        {ordinal(place)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.tickets.length}{" "}
                          {row.tickets.length === 1 ? "ingresso" : "ingressos"}
                          {" · "}
                          {formatBRL(totalValue)}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border bg-muted/20 px-4 py-2 sm:pl-14">
                      <div className="mb-1 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                        <span>Comprador</span>
                        <span>Tipo</span>
                        <span className="text-right">Valor</span>
                      </div>
                      <ul className="space-y-1">
                        {row.tickets.map((t) => {
                          const typeName =
                            (t.ticket_type_id
                              ? typeNameById.get(t.ticket_type_id)
                              : null) ?? "Avulso";
                          return (
                            <li
                              key={t.id}
                              className="grid grid-cols-1 gap-0.5 rounded-md px-1 py-1.5 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-2"
                            >
                              <span className="min-w-0 truncate font-medium sm:font-normal">
                                <span className="text-muted-foreground sm:hidden">
                                  Comprador ·{" "}
                                </span>
                                {t.buyer_name}
                              </span>
                              <span className="min-w-0 truncate text-muted-foreground">
                                <span className="sm:hidden">Tipo · </span>
                                {typeName}
                              </span>
                              <span className="tabular-nums sm:text-right">
                                <span className="text-muted-foreground sm:hidden">
                                  Valor ·{" "}
                                </span>
                                {formatBRL(Number(t.price_paid ?? 0))}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
