import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { exportEventFinancePdf } from "@/lib/event-finance-export";
import {
  deleteEventFinanceCategory,
  deleteEventFinanceItem,
  getEventFinanceTotals,
  INGRESSOS_CATEGORY_ID,
  listEventFinance,
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

export function EventFinancePanel({
  eventId,
  chapterId,
  primary,
  canEdit,
  chapterName,
  chapterCity,
  logoPath,
}: {
  eventId: string;
  chapterId: string;
  primary?: string;
  canEdit: boolean;
  chapterName?: string;
  chapterCity?: string | null;
  logoPath?: string | null;
}) {
  const qc = useQueryClient();
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
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState("");

  const [exporting, setExporting] = useState(false);

  const financeQ = useQuery({
    queryKey: ["event-finance", eventId],
    queryFn: () => listEventFinance({ data: { eventId } }),
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

  const categories = financeQ.data?.categories ?? [];
  const items = financeQ.data?.items ?? [];
  const eventName = financeQ.data?.eventName ?? "Evento";
  const totals = totalsQ.data;
  const editableCategories = categories.filter((c) => !c.is_system);

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
    qc.invalidateQueries({ queryKey: ["cash-categories"] });
  }

  const saveCat = useMutation({
    mutationFn: () =>
      upsertEventFinanceCategory({
        data: {
          id: editingCat?.id,
          eventId,
          chapterId,
          name: catName.trim(),
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
          active: true,
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
    setTrackStock(false);
    setStockQty("");
    setItemOpen(true);
  }
  function openEditItem(it: EventFinanceItem) {
    setEditingItem(it);
    setItemCategoryId(it.category_id);
    setItemName(it.name);
    setItemPrice(it.unit_price == null ? "" : String(it.unit_price));
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
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(totals?.byCategory ?? []).map((c) => (
          <Card key={c.categoryId} className="rounded-[12px] p-4">
            <div className="text-sm font-medium">{c.name}</div>
            <div className="mt-1 text-xl font-bold">{formatBRL(c.income)}</div>
            <button
              type="button"
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                if (c.categoryId !== "other") {
                  setExpanded((prev) => new Set(prev).add(c.categoryId));
                }
              }}
            >
              Ver itens
            </button>
          </Card>
        ))}
        {(totals?.byCategory ?? []).length === 0 && (
          <Card className="rounded-[12px] p-5 sm:col-span-2 lg:col-span-3 text-sm text-muted-foreground">
            Nenhum lançamento no período. Cadastre categorias/itens e lance no
            Caixa ou nas comandas.
          </Card>
        )}
      </div>

      <Card className="rounded-[12px] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Categorias e subcategorias
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
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEditCat(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Excluir categoria “${c.name}” e seus itens?`,
                              )
                            ) {
                              removeCat.mutate(c.id);
                            }
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
                          const itemTotal =
                            totals?.byItem.find((x) => x.itemId === it.id)
                              ?.income ?? 0;
                          const itemQty = totals?.byItem.find(
                            (x) => x.itemId === it.id,
                          )?.qty;
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
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      if (
                                        confirm(`Excluir item “${it.name}”?`)
                                      ) {
                                        removeItem.mutate(it.id);
                                      }
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
              <Label className="mb-1.5 block text-sm">Categoria</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={itemCategoryId}
                onChange={(e) => setItemCategoryId(e.target.value)}
              >
                {editableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Nome</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ex.: Cerveja"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">
                Valor unitário (opcional)
              </Label>
              <Input
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
                <div className="text-sm font-medium">Controlar estoque</div>
                <div className="text-xs text-muted-foreground">
                  Útil para rifas com bilhetes limitados (baixa só na comanda)
                </div>
              </div>
              <Switch checked={trackStock} onCheckedChange={setTrackStock} />
            </div>
            {trackStock && (
              <div>
                <Label className="mb-1.5 block text-sm">
                  Quantidade disponível
                </Label>
                <Input
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
    </div>
  );
}
