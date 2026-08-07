import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useOrgScope } from "@/context/OrgScopeContext";
import {
  daysInMonth,
  deleteOrgMandatoryDate,
  formatPrazoLabel,
  listOrgMandatoryDates,
  PRAZO_KINDS,
  upsertOrgMandatoryDate,
  type OrgMandatoryDate,
  type PrazoKind,
} from "@/lib/org-mandatory-dates.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute(
  "/_authenticated/_shell/regional/datas-obrigatorias",
)({
  component: MandatoryDatesPage,
  head: () => ({
    meta: [{ title: "Datas obrigatórias — SG-CDM" }],
  }),
});

const PRAZO_LABELS: Record<PrazoKind, string> = {
  until_day: "Até uma data",
  within_month: "Dentro de um mês",
  until_month: "Até um mês",
  date_range: "De uma data até outra",
};

const MONTH_OPTIONS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Draft = {
  id?: string;
  title: string;
  description: string;
  prazoKind: PrazoKind;
  dueMonth: number;
  dueDay: number;
  startMonth: number;
  startDay: number;
};

function emptyDraft(): Draft {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return {
    title: "",
    description: "",
    prazoKind: "until_day",
    dueMonth: month,
    dueDay: day,
    startMonth: month,
    startDay: 1,
  };
}

function fromRow(row: OrgMandatoryDate): Draft {
  let dueMonth = row.due_month ?? new Date().getMonth() + 1;
  let dueDay = row.due_day ?? new Date().getDate();
  if (row.prazo_kind === "until_day" && row.due_date && !row.due_day) {
    const [, m, d] = row.due_date.slice(0, 10).split("-").map(Number);
    dueMonth = m;
    dueDay = d;
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    prazoKind: row.prazo_kind,
    dueMonth,
    dueDay,
    startMonth: row.start_month ?? dueMonth,
    startDay: row.start_day ?? 1,
  };
}

function DayMonthPickers({
  day,
  month,
  onChange,
  dayLabel = "Dia",
  monthLabel = "Mês",
}: {
  day: number;
  month: number;
  onChange: (next: { day: number; month: number }) => void;
  dayLabel?: string;
  monthLabel?: string;
}) {
  const maxDay = daysInMonth(month);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label>{dayLabel}</Label>
        <Select
          value={String(Math.min(day, maxDay))}
          onValueChange={(v) => onChange({ day: Number(v), month })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{monthLabel}</Label>
        <Select
          value={String(month)}
          onValueChange={(v) => {
            const nextMonth = Number(v);
            onChange({
              month: nextMonth,
              day: Math.min(day, daysInMonth(nextMonth)),
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MandatoryDatesPage() {
  return (
    <ScopeGuard>
      <MandatoryDatesContent />
    </ScopeGuard>
  );
}

function MandatoryDatesContent() {
  const { activeScope, canManageChapters } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [draft, setDraft] = useState<Draft | null>(null);

  const queryKey = useMemo(
    () => ["org-mandatory-dates", scope.type, scope.id] as const,
    [scope.type, scope.id],
  );

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listOrgMandatoryDates({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
    enabled: canManageChapters,
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      upsertOrgMandatoryDate({
        data: {
          scopeType: scope.type,
          scopeId: scope.id,
          id: d.id,
          title: d.title,
          description: d.description || null,
          prazoKind: d.prazoKind,
          dueMonth: d.dueMonth,
          dueDay:
            d.prazoKind === "until_day" || d.prazoKind === "date_range"
              ? d.dueDay
              : null,
          startMonth: d.prazoKind === "date_range" ? d.startMonth : null,
          startDay: d.prazoKind === "date_range" ? d.startDay : null,
        },
      }),
    onSuccess: () => {
      toast.success(draft?.id ? "Prazo atualizado" : "Prazo criado");
      setDraft(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOrgMandatoryDate({ data: { id } }),
    onSuccess: () => {
      toast.success("Prazo removido");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManageChapters) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Sem permissão para gerenciar datas obrigatórias neste escopo.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Datas obrigatórias"
        subtitle={`Prazos anuais que os capítulos de ${scope.label} devem cumprir`}
        actions={
          <Button
            size="sm"
            style={{ backgroundColor: "var(--chapter-primary)" }}
            onClick={() => setDraft(emptyDraft())}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo prazo
          </Button>
        }
      />

      <Card className="rounded-[12px] p-0 overflow-hidden">
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Nenhum prazo cadastrado. Crie um para avisar os capítulos no
            calendário.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrazoLabel(row)}
                  </div>
                  {row.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDraft(fromRow(row))}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover prazo ${row.title}`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Remover prazo?",
                        description: `Remover o prazo “${row.title}”? Os capítulos deixarão de vê-lo no calendário. Esta ação não pode ser desfeita.`,
                        confirmLabel: "Remover",
                      });
                      if (ok) remove.mutate(row.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar prazo" : "Novo prazo"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="md-title">Nome</Label>
                <Input
                  id="md-title"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Ex.: Relatório trimestral"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de prazo</Label>
                <Select
                  value={draft.prazoKind}
                  onValueChange={(v) =>
                    setDraft({ ...draft, prazoKind: v as PrazoKind })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRAZO_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {PRAZO_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draft.prazoKind === "date_range" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">De</Label>
                    <DayMonthPickers
                      day={draft.startDay}
                      month={draft.startMonth}
                      onChange={({ day, month }) =>
                        setDraft({
                          ...draft,
                          startDay: day,
                          startMonth: month,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground">Até</Label>
                    <DayMonthPickers
                      day={draft.dueDay}
                      month={draft.dueMonth}
                      onChange={({ day, month }) =>
                        setDraft({
                          ...draft,
                          dueDay: day,
                          dueMonth: month,
                        })
                      }
                    />
                  </div>
                </div>
              ) : draft.prazoKind === "until_day" ? (
                <DayMonthPickers
                  day={draft.dueDay}
                  month={draft.dueMonth}
                  onChange={({ day, month }) =>
                    setDraft({ ...draft, dueDay: day, dueMonth: month })
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Select
                    value={String(draft.dueMonth)}
                    onValueChange={(v) =>
                      setDraft({ ...draft, dueMonth: Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="md-desc">Descrição (opcional)</Label>
                <Textarea
                  id="md-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              style={{ backgroundColor: "var(--chapter-primary)" }}
              disabled={!draft?.title.trim() || save.isPending}
              onClick={() => draft && save.mutate(draft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}
