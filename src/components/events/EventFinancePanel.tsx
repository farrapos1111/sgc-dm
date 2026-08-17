import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatBRL } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
import {
  buildComandaReportRows,
  exportEventComandasPdf,
  exportEventFinancePdf,
  exportEventTicketsXlsx,
} from "@/lib/event-finance-export";
import {
  addEventBudgetExpense,
  deleteEventBudgetExpense,
  deleteEventFinanceCategory,
  deleteEventFinanceItem,
  getEventFinanceTotals,
  INGRESSOS_CATEGORY_ID,
  isBudgetCategoryName,
  listEventBudgetExpenses,
  listEventFinance,
  listEventTicketItems,
  updateEventBudgetExpense,
  upsertEventFinanceCategory,
  upsertEventFinanceItem,
  type EventFinanceCategory,
  type EventFinanceItem,
} from "@/lib/event-finance.functions";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function budgetExpenseName(
  row: {
    name?: string | null;
    subcategory?: string | null;
    description?: string | null;
  },
  eventName: string,
) {
  if (row.name?.trim()) return row.name.trim();
  const raw = (row.subcategory ?? row.description ?? "").trim();
  const prefix = `Evento ${eventName} - Despesa `;
  if (raw.startsWith(prefix)) {
    const rest = raw.slice(prefix.length);
    const cut = rest.lastIndexOf(" - ");
    return (cut > 0 ? rest.slice(0, cut) : rest).trim() || raw;
  }
  return raw;
}

export function EventFinancePanel({
  eventId,
  chapterId,
  eventName,
  eventStartsAt,
  primary,
  canEdit,
  chapterName,
  chapterCity,
  logoPath,
  tickets = [],
  ticketTypes = [],
}: {
  eventId: string;
  chapterId: string;
  eventName: string;
  eventStartsAt: string;
  primary?: string;
  canEdit: boolean;
  chapterName?: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  tickets?: Array<{
    id: string;
    buyer_name: string;
    seller_name?: string | null;
    ticket_type_id: string | null;
    price_paid: number | string;
    status: string;
    sold_at?: string | null;
    settlement?: "open" | "partial" | "paid";
    seller_charge_paid?: boolean;
    seller_charge_amount_paid?: number;
  }>;
  ticketTypes?: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([INGRESSOS_CATEGORY_ID]),
  );

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<EventFinanceCategory | null>(
    null,
  );
  const [catName, setCatName] = useState("");

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventFinanceItem | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemActive, setItemActive] = useState(true);
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState("");

  const eventDay = String(eventStartsAt).slice(0, 10) || todayYmd();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetName, setBudgetName] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetDate, setBudgetDate] = useState(eventDay);

  const [exporting, setExporting] = useState(false);
  const [exportingTickets, setExportingTickets] = useState(false);
  const [exportingComandas, setExportingComandas] = useState(false);

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of ticketTypes) map.set(t.id, t.name);
    return map;
  }, [ticketTypes]);

  const ticketExportRows = useMemo(() => {
    return tickets
      .filter((t) => t.status !== "cancelado")
      .filter((t) => {
        if (!from && !until) return true;
        const day = t.sold_at ? t.sold_at.slice(0, 10) : "";
        if (!day) return !from && !until;
        if (from && day < from) return false;
        if (until && day > until) return false;
        return true;
      })
      .map((t) => ({
        buyer_name: t.buyer_name,
        seller_name: t.seller_name ?? null,
        ticket_type_name: t.ticket_type_id
          ? (typeNameById.get(t.ticket_type_id) ?? "Tipo removido")
          : "Avulso",
        price_paid: Number(t.price_paid) || 0,
        status: t.status,
        sold_at: t.sold_at ?? null,
      }));
  }, [tickets, typeNameById, from, until]);
  const financeQ = useQuery({
    queryKey: ["event-finance", eventId],
    queryFn: () => listEventFinance({ data: { eventId } }),
  });
  const budgetQ = useQuery({
    queryKey: ["event-budget", eventId],
    queryFn: () => listEventBudgetExpenses({ data: { eventId } }),
  });
  const totalsQ = useQuery({
    queryKey: ["event-finance-totals", eventId, from, until],
    queryFn: () =>
      getEventFinanceTotals({
        data: {
          eventId,
          from: from || null,
          until: until || null,
        },
      }),
  });

  const categories = (financeQ.data?.categories ?? []).filter(
    (c) => !isBudgetCategoryName(c.name),
  );
  const items = financeQ.data?.items ?? [];
  const totals = totalsQ.data;
  const editableCategories = categories.filter((c) => !c.is_system);
  const budgetRows = budgetQ.data ?? [];
  const budgetTotal = budgetRows.reduce((s, r) => s + Number(r.amount), 0);

  const itemsByCat = useMemo(() => {
    const map = new Map<string, EventFinanceItem[]>();
    for (const it of items) {
      const list = map.get(it.category_id) ?? [];
      list.push(it);
      map.set(it.category_id, list);
    }
    return map;
  }, [items]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["event-finance", eventId] });
    qc.invalidateQueries({ queryKey: ["event-finance-totals", eventId] });
    qc.invalidateQueries({ queryKey: ["event-budget", eventId] });
    qc.invalidateQueries({ queryKey: ["cash-categories"] });
    qc.invalidateQueries({ queryKey: ["cash-entries"] });
  }

  const saveCat = useMutation({
    mutationFn: () =>
      upsertEventFinanceCategory({
        data: {
          id: editingCat?.id,
          eventId,
          chapterId,
          name: catName.trim(),
          sort_order: editingCat?.sort_order ?? 100,
        },
      }),
    onSuccess: () => {
      toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
      setCatOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao salvar")),
  });

  const removeCat = useMutation({
    mutationFn: (id: string) => deleteEventFinanceCategory({ data: { id } }),
    onSuccess: () => {
      toast.success("Categoria removida");
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  const saveItem = useMutation({
    mutationFn: () =>
      upsertEventFinanceItem({
        data: {
          id: editingItem?.id,
          eventId,
          chapterId,
          categoryId: itemCategoryId,
          name: itemName.trim(),
          unit_price:
            itemPrice.trim() === "" ? null : Number(itemPrice.replace(",", ".")),
          track_stock: trackStock,
          stock_qty:
            trackStock && stockQty.trim() !== ""
              ? Number(stockQty)
              : trackStock
                ? 0
                : null,
          active: editingItem ? itemActive : true,
        },
      }),
    onSuccess: () => {
      toast.success(editingItem ? "Item atualizado" : "Item criado");
      setItemOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao salvar")),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => deleteEventFinanceItem({ data: { id } }),
    onSuccess: () => {
      toast.success("Item removido");
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  const saveBudget = useMutation({
    mutationFn: () => {
      const payload = {
        eventId,
        name: budgetName.trim(),
        amount: Number(String(budgetAmount).replace(",", ".")),
        entry_date: budgetDate,
      };
      if (editingBudgetId) {
        return updateEventBudgetExpense({
          data: { id: editingBudgetId, ...payload },
        });
      }
      return addEventBudgetExpense({
        data: { ...payload, chapterId },
      });
    },
    onSuccess: () => {
      toast.success(
        editingBudgetId
          ? "Despesa atualizada"
          : budgetDate > todayYmd()
            ? "Despesa registrada — entra no fluxo na data informada"
            : "Despesa de orçamento lançada no caixa",
      );
      setBudgetOpen(false);
      setEditingBudgetId(null);
      setBudgetName("");
      setBudgetAmount("");
      setBudgetDate(eventDay);
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao salvar")),
  });

  const removeBudget = useMutation({
    mutationFn: (id: string) =>
      deleteEventBudgetExpense({ data: { id, eventId } }),
    onSuccess: () => {
      toast.success("Despesa excluída");
      invalidate();
    },
    onError: (e) => toast.error(mutationErrorMessage(e, "Erro ao excluir")),
  });

  function openNewCat() {
    setEditingCat(null);
    setCatName("");
    setCatOpen(true);
  }
  function openEditCat(c: EventFinanceCategory) {
    setEditingCat(c);
    setCatName(c.name);
    setCatOpen(true);
  }
  function openNewItem(categoryId?: string) {
    setEditingItem(null);
    const firstEditable =
      editableCategories.find((c) => c.id === categoryId)?.id ??
      editableCategories[0]?.id ??
      "";
    setItemCategoryId(firstEditable);
    setItemName("");
    setItemPrice("");
    setItemActive(true);
    setTrackStock(false);
    setStockQty("");
    setItemOpen(true);
  }
  function openEditItem(it: EventFinanceItem) {
    setEditingItem(it);
    setItemCategoryId(it.category_id);
    setItemName(it.name);
    setItemPrice(it.unit_price == null ? "" : String(it.unit_price));
    setItemActive(it.active);
    setTrackStock(it.track_stock);
    setStockQty(it.stock_qty == null ? "" : String(it.stock_qty));
    setItemOpen(true);
  }

  function toggleCat(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (financeQ.error || totalsQ.error) {
    return (
      <Card className="rounded-[12px] p-5">
        <p className="text-sm text-destructive">
          Não foi possível carregar o financeiro do evento.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => {
            if (financeQ.error) void financeQ.refetch();
            if (totalsQ.error) void totalsQ.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[12px] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total arrecadado</div>
            <div className="text-2xl font-bold" style={{ color: primary }}>
              {formatBRL(totals?.totalIncome ?? 0)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ingressos {formatBRL(totals?.ticketsIncome ?? 0)}
              {(totals?.otherIncome ?? 0) > 0
                ? ` · Outros ${formatBRL(totals?.otherIncome ?? 0)}`
                : ""}
              {(totals?.totalExpense ?? 0) > 0
                ? ` · Saídas ${formatBRL(totals?.totalExpense ?? 0)}`
                : ""}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                De
              </Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="w-[140px]"
              />
            </div>
            {(from || until) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom("");
                  setUntil("");
                }}
              >
                Limpar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!totals || exporting}
              onClick={async () => {
                if (!totals) return;
                setExporting(true);
                try {
                  const periodLabel =
                    from || until
                      ? `Período: ${from ? formatDateLabel(from) : "…"} a ${until ? formatDateLabel(until) : "…"}`
                      : "Período: completo";
                  await exportEventFinancePdf({
                    chapterName: chapterName || "Capítulo",
                    chapterCity: chapterCity ?? null,
                    logoPath: logoPath ?? null,
                    eventName,
                    periodLabel,
                    totals,
                  });
                  toast.success("PDF gerado");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao gerar PDF",
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              <FileText className="mr-1 h-4 w-4" />{" "}
              {exporting ? "Gerando…" : "PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportingTickets || ticketExportRows.length === 0}
              onClick={() => {
                setExportingTickets(true);
                try {
                  const slug = eventName
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                  exportEventTicketsXlsx(
                    ticketExportRows,
                    `ingressos-${slug || "evento"}.xlsx`,
                    { eventName },
                  );
                  toast.success("Excel de ingressos gerado");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao gerar Excel",
                  );
                } finally {
                  setExportingTickets(false);
                }
              }}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />{" "}
              {exportingTickets ? "Gerando…" : "Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportingComandas || tickets.length === 0}
              onClick={async () => {
                setExportingComandas(true);
                try {
                  const items = await listEventTicketItems({
                    data: { eventId },
                  });
                  const filteredTickets = tickets.filter((t) => {
                    if (t.status === "cancelado") return false;
                    if (!from && !until) return true;
                    const day = t.sold_at ? t.sold_at.slice(0, 10) : "";
                    if (!day) return !from && !until;
                    if (from && day < from) return false;
                    if (until && day > until) return false;
                    return true;
                  });
                  const rows = buildComandaReportRows({
                    tickets: filteredTickets,
                    ticketTypes,
                    items,
                  });
                  await exportEventComandasPdf({
                    chapterName: chapterName || "Capítulo",
                    chapterCity: chapterCity ?? null,
                    logoPath: logoPath ?? null,
                    eventName,
                    rows,
                  });
                  toast.success("Relatório de comandas gerado");
                } catch (e) {
                  toast.error(
                    e instanceof Error
                      ? e.message
                      : "Erro ao gerar relatório de comandas",
                  );
                } finally {
                  setExportingComandas(false);
                }
              }}
            >
              <FileText className="mr-1 h-4 w-4" />{" "}
              {exportingComandas ? "Gerando…" : "Comandas"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(totals?.byCategory ?? []).map((c) => (
          <Card key={c.categoryId} className="rounded-[12px] p-4">
            <div className="text-sm font-medium">{c.name}</div>
            <div className="mt-1 text-xl font-bold">{formatBRL(c.income)}</div>
            {c.categoryId !== "other" &&
              categories.some((cat) => cat.id === c.categoryId) && (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                  setExpanded((prev) => new Set(prev).add(c.categoryId));
                  }}
                >
                  Ver itens
                </button>
              )}
          </Card>
        ))}
        {totalsQ.isSuccess && (totals?.byCategory ?? []).length === 0 && (
          <Card className="rounded-[12px] p-5 sm:col-span-2 lg:col-span-3 text-sm text-muted-foreground">
            Nenhum lançamento no período. Cadastre categorias/itens e lance no
            Caixa ou nas comandas.
          </Card>
        )}
      </div>

      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Orçamento
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Despesas do evento (saídas Eventos). Podem ser cadastradas antes;
              só entram no fluxo de caixa a partir da data informada.
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setEditingBudgetId(null);
                setBudgetName("");
                setBudgetAmount("");
                setBudgetDate(eventDay);
                setBudgetOpen(true);
              }}
              style={{ backgroundColor: primary }}
            >
              <Plus className="mr-1 h-4 w-4" /> Despesa
            </Button>
          )}
        </div>
        {budgetQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : budgetQ.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Não foi possível carregar as despesas de orçamento.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void budgetQ.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : budgetRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa de orçamento lançada.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {budgetRows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {budgetExpenseName(r, eventName)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateLabel(r.entry_date)}</span>
                    {r.entry_date > todayYmd() ? (
                      <Badge variant="secondary">Despesa Agendada</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="font-semibold text-rose-600 dark:text-rose-400">
                    − {formatBRL(r.amount)}
                  </div>
                  {canEdit ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Editar despesa ${budgetExpenseName(r, eventName)}`}
                        onClick={() => {
                          setEditingBudgetId(r.id);
                          setBudgetName(budgetExpenseName(r, eventName));
                          setBudgetAmount(String(r.amount));
                          setBudgetDate(r.entry_date);
                          setBudgetOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        aria-label={`Excluir despesa ${budgetExpenseName(r, eventName)}`}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Excluir despesa?",
                            description: `Excluir “${budgetExpenseName(r, eventName)}” (${formatBRL(r.amount)})? O lançamento sai do fluxo de caixa.`,
                            confirmLabel: "Excluir",
                          });
                          if (ok) removeBudget.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
            <li className="flex justify-between px-3 py-2.5 text-sm font-medium">
              <span>Total orçamento</span>
              <span className="text-rose-600 dark:text-rose-400">
                − {formatBRL(budgetTotal)}
              </span>
            </li>
          </ul>
        )}
      </Card>

      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Vendas do Evento
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openNewCat}>
                <Plus className="mr-1 h-4 w-4" /> Categoria
              </Button>
              <Button
                size="sm"
                onClick={() => openNewItem()}
                disabled={editableCategories.length === 0}
                style={{ backgroundColor: primary }}
              >
                <Plus className="mr-1 h-4 w-4" /> Item
              </Button>
            </div>
          )}
        </div>

        {financeQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nenhuma categoria ainda. Ex.: Rifas, Bar/Bebidas, Brindes.
          </div>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => {
              const open = expanded.has(c.id);
              const catItems = itemsByCat.get(c.id) ?? [];
              const catTotal =
                totals?.byCategory.find((x) => x.categoryId === c.id)?.income ??
                0;
              const isSystem = Boolean(c.is_system);
              return (
                <li key={c.id} className="rounded-[8px] border border-border">
                  <div className="flex items-center gap-2 p-3">
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground"
                      onClick={() => toggleCat(c.id)}
                      aria-label={`${open ? "Recolher" : "Expandir"} categoria ${c.name}`}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 truncate font-medium">
                        {c.name}
                        {isSystem && (
                          <Badge variant="secondary" className="text-[10px]">
                            automático
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isSystem
                          ? "Espelha os tipos da aba Ingressos"
                          : `${catItems.length} ${catItems.length === 1 ? "item" : "itens"}`}
                        {` · ${formatBRL(catTotal)}`}
                      </div>
                    </div>
                    {canEdit && !isSystem && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openNewItem(c.id)}
                          aria-label={`Adicionar item à categoria ${c.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditCat(c)}
                          aria-label={`Editar categoria ${c.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          aria-label={`Excluir categoria ${c.name}`}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Excluir categoria?",
                              description: `Excluir categoria “${c.name}” e seus itens?`,
                              confirmLabel: "Excluir",
                            });
                            if (ok) removeCat.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {open && (
                    <ul className="border-t border-border bg-muted/30">
                      {catItems.length === 0 ? (
                        <li className="px-4 py-3 text-xs text-muted-foreground">
                          {isSystem
                            ? "Crie tipos de ingresso na aba Ingressos."
                            : "Sem itens nesta categoria."}
                        </li>
                      ) : (
                        catItems.map((it) => {
                          const itemTotals = totals?.byItem.find(
                            (x) => x.itemId === it.id,
                          );
                          const itemTotal = itemTotals?.income ?? 0;
                          const itemQty = itemTotals?.qty;
                          return (
                            <li
                              key={it.id}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {it.name}
                                  {!it.active && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-2 text-[10px]"
                                    >
                                      inativo
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {it.unit_price == null
                                    ? "Preço variável"
                                    : formatBRL(Number(it.unit_price))}
                                  {isSystem && itemQty != null
                                    ? ` · ${itemQty} vendido${itemQty === 1 ? "" : "s"}`
                                    : ""}
                                  {it.track_stock
                                    ? ` · estoque ${it.stock_qty ?? 0}`
                                    : ""}
                                  {` · arrecadado ${formatBRL(itemTotal)}`}
                                </div>
                              </div>
                              {canEdit && !isSystem && (
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => openEditItem(it)}
                                    aria-label={`Editar item ${it.name}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    aria-label={`Excluir item ${it.name}`}
                                    onClick={async () => {
                                      const ok = await confirm({
                                        title: "Excluir item?",
                                        description: `Excluir item “${it.name}”?`,
                                        confirmLabel: "Excluir",
                                      });
                                      if (ok) removeItem.mutate(it.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCat ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label className="mb-1.5 block text-sm">Nome</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Ex.: Rifas"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCatOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveCat.mutate()}
              disabled={!catName.trim() || saveCat.isPending}
              style={{ backgroundColor: primary }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar item" : "Novo item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="event-finance-item-category" className="mb-1.5 block text-sm">
                Categoria
              </Label>
              <Select
                value={itemCategoryId}
                onValueChange={setItemCategoryId}
              >
                <SelectTrigger id="event-finance-item-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {editableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="event-finance-item-name" className="mb-1.5 block text-sm">
                Nome
              </Label>
              <Input
                id="event-finance-item-name"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ex.: Cerveja"
              />
            </div>
            <div>
              <Label htmlFor="event-finance-item-price" className="mb-1.5 block text-sm">
                Valor unitário (opcional)
              </Label>
              <Input
                id="event-finance-item-price"
                type="number"
                min={0}
                step="0.01"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="Deixe vazio se variável no lançamento"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="event-finance-item-track-stock" className="text-sm font-medium">
                  Controlar estoque
                </Label>
                <div className="text-xs text-muted-foreground">
                  Útil para rifas com bilhetes limitados (baixa só na comanda)
                </div>
              </div>
              <Switch
                id="event-finance-item-track-stock"
                checked={trackStock}
                onCheckedChange={setTrackStock}
              />
            </div>
            {editingItem && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <Label htmlFor="event-finance-item-active" className="text-sm font-medium">
                  Item ativo
                </Label>
                <Switch
                  id="event-finance-item-active"
                  checked={itemActive}
                  onCheckedChange={setItemActive}
                />
              </div>
            )}
            {trackStock && (
              <div>
                <Label htmlFor="event-finance-item-stock" className="mb-1.5 block text-sm">
                  Quantidade disponível
                </Label>
                <Input
                  id="event-finance-item-stock"
                  type="number"
                  min={0}
                  step={1}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveItem.mutate()}
              disabled={
                !itemName.trim() || !itemCategoryId || saveItem.isPending
              }
              style={{ backgroundColor: primary }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={budgetOpen}
        onOpenChange={(open) => {
          setBudgetOpen(open);
          if (!open) setEditingBudgetId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingBudgetId ? "Editar despesa" : "Despesa de orçamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Formato no caixa: Evento {eventName} - Despesa [nome] - [valor].
              Contabiliza no fluxo somente a partir da data abaixo.
            </p>
            <div>
              <Label htmlFor="event-budget-name" className="mb-1.5 block text-sm">
                Nome da despesa
              </Label>
              <Input
                id="event-budget-name"
                value={budgetName}
                onChange={(e) => setBudgetName(e.target.value)}
                placeholder="Ex.: Decoração"
              />
            </div>
            <div>
              <Label
                htmlFor="event-budget-amount"
                className="mb-1.5 block text-sm"
              >
                Valor
              </Label>
              <Input
                id="event-budget-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="event-budget-date" className="mb-1.5 block text-sm">
                Data no fluxo de caixa
              </Label>
              <Input
                id="event-budget-date"
                type="date"
                value={budgetDate}
                onChange={(e) => setBudgetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBudgetOpen(false)}>
              Cancelar
            </Button>
            <Button
              style={{ backgroundColor: primary }}
              disabled={
                saveBudget.isPending ||
                !budgetName.trim() ||
                !(Number(String(budgetAmount).replace(",", ".")) > 0) ||
                !budgetDate
              }
              onClick={() => saveBudget.mutate()}
            >
              {saveBudget.isPending
                ? "Salvando…"
                : editingBudgetId
                  ? "Salvar alterações"
                  : "Registrar despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
