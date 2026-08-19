import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { listLodges } from "@/lib/chapter.functions";
import {
  EVENT_CASH_TABLE_COLUMNS,
  EVENT_FINANCE_REPORT_BLOCKS,
  defaultEventCashTableColumns,
  defaultEventReportBlocks,
  exportEventFinancePdf,
  exportEventFinanceSimplePdf,
  type EventCashTableColumnState,
  type EventFinanceReportBlockState,
} from "@/lib/event-finance-export";
import type { EventFinanceTotals } from "@/lib/event-finance.functions";
import { getFinanceSigners } from "@/lib/finance.functions";
import { currentTerm } from "@/lib/terms";
import { cn } from "@/lib/utils";

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function gestaoFromEventDate(eventStartsAt?: string) {
  const d = eventStartsAt ? new Date(eventStartsAt) : new Date();
  const term = currentTerm(Number.isNaN(d.getTime()) ? new Date() : d);
  return `${term.year}/${term.semester}`;
}

export function EventFinanceReportDialog({
  open,
  onOpenChange,
  chapterId,
  chapterName,
  chapterCity,
  logoPath,
  eventName,
  eventStartsAt,
  from,
  until,
  totals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  chapterName: string;
  chapterCity?: string | null;
  logoPath?: string | null;
  eventName: string;
  eventStartsAt?: string;
  from: string;
  until: string;
  totals: EventFinanceTotals | null;
}) {
  const [complete, setComplete] = useState(false);
  const [blocks, setBlocks] = useState<EventFinanceReportBlockState[]>(
    defaultEventReportBlocks,
  );
  const [incomeColumns, setIncomeColumns] = useState<EventCashTableColumnState[]>(
    defaultEventCashTableColumns,
  );
  const [expenseColumns, setExpenseColumns] = useState<EventCashTableColumnState[]>(
    defaultEventCashTableColumns,
  );
  const [exporting, setExporting] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!open) return;
    setComplete(false);
    setBlocks(defaultEventReportBlocks());
    setIncomeColumns(defaultEventCashTableColumns());
    setExpenseColumns(defaultEventCashTableColumns());
  }, [open]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function generate() {
    if (!totals) return;
    setExporting(true);
    try {
      if (complete) {
        const periodLabel =
          from || until
            ? `Período: ${from ? formatDateLabel(from) : "…"} a ${until ? formatDateLabel(until) : "…"}`
            : "Período: completo";
        await exportEventFinancePdf({
          chapterName,
          chapterCity: chapterCity ?? null,
          logoPath: logoPath ?? null,
          eventName,
          gestaoLabel: gestaoFromEventDate(eventStartsAt),
          periodLabel,
          totals,
          blocks,
          incomeColumns,
          expenseColumns,
        });
      } else {
        const [signers, lodges] = await Promise.all([
          getFinanceSigners({ data: { chapterId } }),
          listLodges({ data: { chapterId } }),
        ]);
        const mc = signers.find((s) => s.positionCode === "mestre_conselheiro");
        const pcc = signers.find(
          (s) => s.positionCode === "presidente_conselho_consultivo",
        );
        const primary =
          lodges.find((l) => l.is_primary) ?? lodges[0] ?? null;
        await exportEventFinanceSimplePdf({
          chapterName,
          chapterCity: chapterCity ?? null,
          logoPath: logoPath ?? null,
          eventName,
          gestaoLabel: gestaoFromEventDate(eventStartsAt),
          lodgeAddress: primary?.address?.trim() || primary?.name || null,
          totals,
          signers: {
            mc: {
              name: mc?.name ?? "",
              demolayId: mc?.demolayId ?? null,
              signatureDataUrl: mc?.signatureDataUrl ?? null,
            },
            pcc: {
              name: pcc?.name ?? "",
              demolayId: pcc?.demolayId ?? null,
              signatureDataUrl: pcc?.signatureDataUrl ?? null,
            },
          },
        });
      }
      toast.success("PDF gerado");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imprimir relatório</DialogTitle>
          <DialogDescription>
            Escolha o modelo simplificado (declaração de rendimentos) ou o
            relatório completo, com os blocos que devem aparecer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-1">
          <span
            className={cn(
              "text-sm",
              !complete ? "font-semibold" : "text-muted-foreground",
            )}
          >
            Simplificado
          </span>
          <Switch
            checked={complete}
            onCheckedChange={setComplete}
            aria-label="Tipo de relatório"
          />
          <span
            className={cn(
              "text-sm",
              complete ? "font-semibold" : "text-muted-foreground",
            )}
          >
            Completo
          </span>
        </div>

        {complete ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Marque o que incluir e arraste para definir a ordem no PDF.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1.5">
                  {blocks.map((block) => (
                    <SortableReportBlockRow
                      key={block.id}
                      block={block}
                      onToggle={(enabled) =>
                        setBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id ? { ...b, enabled } : b,
                          ),
                        )
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <CashColumnsPicker
              title="Colunas das entradas"
              columns={incomeColumns}
              onChange={setIncomeColumns}
            />
            <CashColumnsPicker
              title="Colunas das saídas"
              columns={expenseColumns}
              onChange={setExpenseColumns}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Gera a declaração de rendimentos com despesas, receita bruta
            (incluindo valores em aberto), lucro, assinaturas do MC e do PCC e
            o endereço da loja principal.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!totals || exporting} onClick={() => void generate()}>
            {exporting ? "Gerando…" : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashColumnsPicker({
  title,
  columns,
  onChange,
}: {
  title: string;
  columns: EventCashTableColumnState[];
  onChange: (next: EventCashTableColumnState[]) => void;
}) {
  return (
    <div className="space-y-1.5 pt-2">
      <p className="text-xs font-medium">{title}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {columns.map((col) => {
          const meta = EVENT_CASH_TABLE_COLUMNS.find((c) => c.id === col.id);
          return (
            <label
              key={col.id}
              className="flex items-center gap-1.5 text-sm"
            >
              <Checkbox
                checked={col.enabled}
                onCheckedChange={(v) =>
                  onChange(
                    columns.map((c) =>
                      c.id === col.id ? { ...c, enabled: v === true } : c,
                    ),
                  )
                }
                aria-label={meta?.label ?? col.id}
              />
              {meta?.label ?? col.id}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SortableReportBlockRow({
  block,
  onToggle,
}: {
  block: EventFinanceReportBlockState;
  onToggle: (enabled: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });
  const meta = EVENT_FINANCE_REPORT_BLOCKS.find((b) => b.id === block.id);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        className="touch-none text-muted-foreground hover:text-foreground"
        aria-label="Reordenar bloco"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={block.enabled}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={meta?.label ?? block.id}
      />
      <span className="text-sm">{meta?.label ?? block.id}</span>
    </li>
  );
}
