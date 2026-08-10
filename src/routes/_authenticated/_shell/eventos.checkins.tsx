import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QrScanner } from "@/components/QrScanner";
import { TicketComandaDialog } from "@/components/events/TicketComandaDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import {
  checkinTicket,
  listChapterTicketsForCheckin,
  previewTicketByQr,
} from "@/lib/events.functions";
import { matchesLooseSearch } from "@/lib/utils";
import { useEventCheckinRealtime } from "@/hooks/useEventCheckinRealtime";

export const Route = createFileRoute("/_authenticated/_shell/eventos/checkins")({
  head: () => ({
    meta: [
      { title: "Check-ins — Templo Virtual" },
      {
        name: "description",
        content:
          "Leitura de QR, check-in manual e comanda virtual dos ingressos.",
      },
    ],
  }),
  component: Checkins,
});

type CheckinTicketsResult = Awaited<
  ReturnType<typeof listChapterTicketsForCheckin>
>;
type TicketRow = CheckinTicketsResult["tickets"][number];
type PreviewPayload = Awaited<ReturnType<typeof previewTicketByQr>>;
type SortKey = "nome" | "evento" | "valor" | "vendedor";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function rowToPreview(row: TicketRow): PreviewPayload {
  return {
    ticket: {
      id: row.id,
      qr_code: row.qr_code,
      buyer_name: row.buyer_name,
      buyer_email: row.buyer_email,
      price_paid: row.price_paid,
      ticket_type_name: row.ticket_type_name,
      status: "valido",
    },
    event: {
      id: row.event_id,
      name: row.event_name,
      starts_at: row.event_starts_at,
      location: row.event_location,
    },
    alreadyCheckedIn: row.already_checked_in,
    checkedInAt: row.checked_in_at,
  };
}

function Checkins() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const primary = active?.chapter.primary_color ?? undefined;
  useEventCheckinRealtime({ enabled: !!active?.chapter_id });

  const [search, setSearch] = useState("");
  const [checkinFilter, setCheckinFilter] = useState<
    "all" | "presente" | "ausente"
  >("all");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Câmera começa pausada para a lista de ingressos caber na tela no mobile
  const [cameraOn, setCameraOn] = useState(false);

  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMethod, setPreviewMethod] = useState<"qr" | "nome">("qr");
  const [comanda, setComanda] = useState<{
    eventId: string;
    ticketId: string;
    buyerName: string;
    eventName: string;
  } | null>(null);

  const busyRef = useRef(false);
  const lastScanAtRef = useRef<Map<string, number>>(new Map());
  const SCAN_COOLDOWN_MS = 8_000;

  const ticketsQ = useQuery({
    queryKey: ["checkin-tickets", active?.chapter_id],
    enabled: !!active,
    queryFn: () =>
      listChapterTicketsForCheckin({ data: { chapterId: active!.chapter_id } }),
  });

  const tickets = ticketsQ.data?.tickets ?? [];
  const ticketsTruncated = Boolean(ticketsQ.data?.truncated);

  const checkinCounts = useMemo(() => {
    let presente = 0;
    let ausente = 0;
    for (const t of tickets) {
      if (t.already_checked_in) presente += 1;
      else ausente += 1;
    }
    return { presente, ausente };
  }, [tickets]);

  const visible = useMemo(() => {
    const q = search.trim();
    let rows = tickets;
    if (checkinFilter === "presente") {
      rows = rows.filter((t) => t.already_checked_in);
    } else if (checkinFilter === "ausente") {
      rows = rows.filter((t) => !t.already_checked_in);
    }
    if (q) {
      const qNum = Number(q.replace(",", "."));
      const hasNum = q.replace(",", ".").match(/^\d+(\.\d+)?$/) && !Number.isNaN(qNum);
      rows = rows.filter((t) => {
        if (matchesLooseSearch(t.buyer_name, q)) return true;
        if (matchesLooseSearch(t.event_name, q)) return true;
        if (t.seller_name && matchesLooseSearch(t.seller_name, q)) return true;
        if (matchesLooseSearch(t.qr_code, q)) return true;
        if (hasNum && Math.abs(t.price_paid - qNum) < 0.005) return true;
        if (formatBRL(t.price_paid).includes(q)) return true;
        return false;
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "valor") return (a.price_paid - b.price_paid) * dir;
      const av =
        sortKey === "nome"
          ? a.buyer_name
          : sortKey === "evento"
            ? a.event_name
            : (a.seller_name ?? "");
      const bv =
        sortKey === "nome"
          ? b.buyer_name
          : sortKey === "evento"
            ? b.event_name
            : (b.seller_name ?? "");
      return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * dir;
    });
  }, [tickets, search, sortKey, sortDir, checkinFilter]);

  const lookup = useMutation({
    mutationFn: (qr: string) =>
      previewTicketByQr({ data: { chapterId: active!.chapter_id, qr } }),
    onSuccess: (data) => {
      setPreviewMethod("qr");
      setPreview(data);
      setPreviewOpen(true);
    },
    onError: (e: unknown) => {
      busyRef.current = false;
      toast.error(mutationErrorMessage(e, "QR inválido"));
    },
  });

  const liberar = useMutation({
    mutationFn: () =>
      checkinTicket({
        data: {
          event_id: preview!.event.id,
          ticket_id: preview!.ticket.id,
          method: previewMethod,
        },
      }),
    onSuccess: async (res) => {
      const who = res.buyer_name ?? preview?.ticket.buyer_name ?? "Convidado";
      if (res.alreadyCheckedIn) {
        toast.info(`Acesso já liberado: ${who}`);
      } else {
        toast.success(`Acesso liberado: ${who}`);
      }
      setPreviewOpen(false);
      setPreview(null);
      busyRef.current = false;
      setComanda({
        eventId: res.event_id,
        ticketId: res.ticket_id,
        buyerName: res.buyer_name ?? who,
        eventName: preview?.event.name ?? "",
      });
      await qc.invalidateQueries({ queryKey: ["checkin-tickets"] });
      await qc.invalidateQueries({ queryKey: ["checkins"] });
      await qc.invalidateQueries({ queryKey: ["event"] });
    },
    onError: (e: unknown) => {
      busyRef.current = false;
      toast.error(mutationErrorMessage(e, "Erro ao liberar acesso"));
    },
  });

  function handleScan(text: string) {
    if (!active || busyRef.current || previewOpen || lookup.isPending) return;
    const now = Date.now();
    const last = lastScanAtRef.current.get(text) ?? 0;
    if (now - last < SCAN_COOLDOWN_MS) return;
    lastScanAtRef.current.set(text, now);
    busyRef.current = true;
    lookup.mutate(text);
  }

  function openManual(row: TicketRow) {
    if (row.already_checked_in) {
      setComanda({
        eventId: row.event_id,
        ticketId: row.id,
        buyerName: row.buyer_name,
        eventName: row.event_name,
      });
      return;
    }
    setPreviewMethod("nome");
    setPreview(rowToPreview(row));
    setPreviewOpen(true);
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreview(null);
    busyRef.current = false;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "valor" ? "desc" : "asc");
    }
  }

  return (
    <div>
      <PageHeader
        title="Check-ins"
        subtitle="Leia o QR ou libere o acesso manualmente pela lista. Ao confirmar, a comanda virtual é aberta."
      />

      {ticketsTruncated ? (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
          Lista limitada aos 2000 ingressos mais recentes. Refine a busca ou
          filtre por evento se o ingresso esperado não aparecer.
        </p>
      ) : null}

      <Card className="mb-3 rounded-[12px] p-3 sm:mb-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">Leitor de QR</span>
            {lookup.isPending && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                · Validando…
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="shrink-0"
            variant={cameraOn ? "default" : "outline"}
            style={cameraOn ? { backgroundColor: primary } : undefined}
            onClick={() => setCameraOn((v) => !v)}
          >
            {cameraOn ? "Pausar" : "Ligar câmera"}
          </Button>
        </div>
        {active && cameraOn ? (
          <QrScanner
            onScan={handleScan}
            paused={previewOpen || lookup.isPending}
          />
        ) : (
          <div className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground sm:p-8 sm:text-sm">
            {active
              ? "Câmera pausada. Ligue para escanear ou libere pela lista abaixo."
              : "Selecione um capítulo para iniciar."}
          </div>
        )}
      </Card>

      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nome, valor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger className="w-[7.5rem] sm:w-40">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome</SelectItem>
            <SelectItem value="evento">Evento</SelectItem>
            <SelectItem value="valor">Valor</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Inverter ordenação"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? (
            <ArrowUpAZ className="h-4 w-4" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "Todos"],
            ["presente", `Presentes (${checkinCounts.presente})`],
            ["ausente", `Ausentes (${checkinCounts.ausente})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCheckinFilter(key)}
            className="cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={
              checkinFilter === key
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

      {ticketsQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando ingressos…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-7 w-7" />}
          title={search ? "Nenhum ingresso encontrado" : "Nenhum ingresso"}
          description={
            search
              ? "Ajuste a busca por nome, valor ou vendedor."
              : "Venda ingressos em Eventos para liberar acessos aqui."
          }
        />
      ) : (
        <Card className="overflow-hidden rounded-[12px]">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto] gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <button type="button" className="text-left" onClick={() => toggleSort("nome")}>
              Nome
            </button>
            <button type="button" className="text-left" onClick={() => toggleSort("evento")}>
              Evento
            </button>
            <button type="button" className="text-right" onClick={() => toggleSort("valor")}>
              Valor
            </button>
            <span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-border">
            {visible.map((row) => (
              <li
                key={row.id}
                className="px-3 py-2.5 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto] sm:items-center sm:gap-3 sm:px-4 sm:py-3"
              >
                {/* Mobile: nome completo + meta; ações abaixo */}
                <div className="flex flex-col gap-2 sm:hidden">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium leading-snug">
                      {row.buyer_name}
                    </div>
                    <div className="mt-0.5 break-words text-xs text-muted-foreground">
                      {row.ticket_type_name}
                      {" · "}
                      {row.event_name}
                    </div>
                    <div className="break-words text-[11px] text-muted-foreground">
                      {formatDateTimeBR(row.event_starts_at)}
                      {row.seller_name ? ` · ${row.seller_name}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatBRL(row.price_paid)}
                      </div>
                      {row.already_checked_in ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Presente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Em aberto
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 px-2.5"
                      variant={row.already_checked_in ? "outline" : "default"}
                      style={
                        row.already_checked_in
                          ? undefined
                          : { backgroundColor: primary }
                      }
                      onClick={() => openManual(row)}
                    >
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {row.already_checked_in ? "Comanda" : "Liberar"}
                    </Button>
                  </div>
                </div>

                {/* Desktop: grid */}
                <div className="hidden min-w-0 sm:block">
                  <div className="break-words text-sm font-medium">{row.buyer_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.ticket_type_name}
                    {row.seller_name ? ` · Vend. ${row.seller_name}` : ""}
                  </div>
                </div>
                <div className="hidden min-w-0 sm:block">
                  <div className="break-words text-sm">{row.event_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatDateTimeBR(row.event_starts_at)}
                  </div>
                </div>
                <div className="hidden text-sm font-medium sm:block sm:text-right">
                  {formatBRL(row.price_paid)}
                </div>
                <div className="hidden flex-wrap items-center gap-2 sm:flex sm:justify-end">
                  {row.already_checked_in ? (
                    <Badge variant="secondary">Presente</Badge>
                  ) : (
                    <Badge variant="outline">Em aberto</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openManual(row)}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    {row.already_checked_in ? "Comanda" : "Liberar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground sm:px-4">
            {visible.length} ingresso{visible.length === 1 ? "" : "s"}
            {search ? " (filtrados)" : ""}
          </div>
        </Card>
      )}

      <Dialog
        open={previewOpen}
        onOpenChange={(o) => {
          if (!o) closePreview();
          else setPreviewOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Liberar acesso
            </DialogTitle>
            <DialogDescription>
              Confira os dados do ingresso antes de liberar a entrada e abrir a
              comanda.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              <div className="rounded-[10px] border border-border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">Evento</div>
                <div className="text-sm font-semibold">{preview.event.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTimeBR(preview.event.starts_at)}
                </div>
                {preview.event.location && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{preview.event.location}</span>
                  </div>
                )}
              </div>

              <div className="rounded-[10px] border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Convidado</div>
                    <div className="truncate text-sm font-semibold">
                      {preview.ticket.buyer_name}
                    </div>
                    {preview.ticket.buyer_email && (
                      <div className="truncate text-xs text-muted-foreground">
                        {preview.ticket.buyer_email}
                      </div>
                    )}
                  </div>
                  {preview.alreadyCheckedIn ? (
                    <Badge variant="secondary">Já entrou</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      Válido
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Tipo</div>
                    <div className="font-medium">{preview.ticket.ticket_type_name}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Valor</div>
                    <div className="font-medium">
                      {formatBRL(Number(preview.ticket.price_paid) || 0)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Ingresso</div>
                    <div className="font-mono text-sm">{preview.ticket.qr_code}</div>
                  </div>
                </div>
                {preview.alreadyCheckedIn && preview.checkedInAt && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    Check-in anterior em {formatDateTimeBR(preview.checkedInAt)}.
                    Você ainda pode abrir a comanda.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closePreview} disabled={liberar.isPending}>
              Cancelar
            </Button>
            <Button
              disabled={!preview || liberar.isPending}
              onClick={() => liberar.mutate()}
              style={{ backgroundColor: primary }}
            >
              {preview?.alreadyCheckedIn ? (
                <Wallet className="mr-2 h-4 w-4" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {liberar.isPending
                ? "Liberando…"
                : preview?.alreadyCheckedIn
                  ? "Abrir comanda"
                  : "Liberar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {comanda && (
        <TicketComandaDialog
          open={!!comanda}
          onOpenChange={(o) => {
            if (!o) setComanda(null);
          }}
          eventId={comanda.eventId}
          ticketId={comanda.ticketId}
          buyerName={comanda.buyerName}
          eventName={comanda.eventName}
          primary={primary}
        />
      )}
    </div>
  );
}
