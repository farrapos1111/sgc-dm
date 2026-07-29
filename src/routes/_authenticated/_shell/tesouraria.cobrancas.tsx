import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Banknote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { can } from "@/lib/permissions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { FIXED_CATEGORIES } from "@/lib/cash-categories";
import {
  deleteMemberCharge,
  listCashCategories,
  listChargeMembers,
  listMemberCharges,
  upsertMemberCharge,
} from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/_shell/tesouraria/cobrancas")({
  head: () => ({
    meta: [
      { title: "Cobranças — SG-CDM" },
      {
        name: "description",
        content: "Cobranças avulsas atribuídas a membros do capítulo.",
      },
    ],
  }),
  component: Cobrancas,
});

type ChargeStatus = "em_aberto" | "pago" | "isento";

type ChargeForm = {
  id?: string;
  memberId: string;
  kind: "entrada" | "saida";
  category: string;
  description: string;
  amount: string;
  dueDate: string;
  status: ChargeStatus;
  paidAt: string;
};

const emptyForm = (): ChargeForm => ({
  memberId: "",
  kind: "entrada",
  category: "Outras",
  description: "",
  amount: "",
  dueDate: new Date().toISOString().slice(0, 10),
  status: "em_aberto",
  paidAt: new Date().toISOString().slice(0, 10),
});

const STATUS_LABEL: Record<ChargeStatus, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
};

function Cobrancas() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const writable = can(active?.role.name, "tesouraria");
  const [statusFilter, setStatusFilter] = useState<"all" | ChargeStatus>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChargeForm>(emptyForm());

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["member-charges", active?.chapter_id, statusFilter],
    enabled: !!active,
    queryFn: () =>
      listMemberCharges({
        data: { chapterId: active!.chapter_id, status: statusFilter },
      }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["charge-members", active?.chapter_id],
    enabled: !!active && open,
    queryFn: () => listChargeMembers({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: catData } = useQuery({
    queryKey: ["cash-categories", active?.chapter_id],
    enabled: !!active && open,
    queryFn: () => listCashCategories({ data: { chapterId: active!.chapter_id } }),
  });

  const categoryNames = useMemo(() => {
    const names = new Set<string>(FIXED_CATEGORIES);
    for (const c of catData?.categories ?? []) names.add(c.name);
    if (form.category) names.add(form.category);
    return [...names];
  }, [catData?.categories, form.category]);

  const totals = useMemo(() => {
    let openAmt = 0;
    let paid = 0;
    for (const c of charges) {
      if (c.status === "pago") paid += Number(c.amount);
      else if (c.status === "em_aberto") openAmt += Number(c.amount);
    }
    return { openAmt, paid };
  }, [charges]);

  const save = useMutation({
    mutationFn: () =>
      upsertMemberCharge({
        data: {
          chapterId: active!.chapter_id,
          id: form.id,
          memberId: form.memberId,
          kind: form.kind,
          category: form.category,
          description: form.description.trim(),
          amount: Number(String(form.amount).replace(",", ".")) || 0,
          dueDate: form.dueDate,
          status: form.status,
          paidAt: form.paidAt,
        },
      }),
    onSuccess: async (_r, _v) => {
      if (form.status === "pago") toast.success("Cobrança baixada — entrada criada no fluxo");
      else if (form.id && form.status === "em_aberto")
        toast.message("Se estava paga, a entrada foi removida do fluxo");
      else toast.success("Cobrança salva");
      setOpen(false);
      setForm(emptyForm());
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMemberCharge({ data: { id } }),
    onSuccess: async () => {
      toast.success("Cobrança excluída");
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  function editCharge(c: (typeof charges)[number]) {
    setForm({
      id: c.id,
      memberId: c.member_id,
      kind: c.kind as "entrada" | "saida",
      category: c.category,
      description: c.description,
      amount: String(c.amount),
      dueDate: c.due_date,
      status: c.status as ChargeStatus,
      paidAt: c.paid_at ?? new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Cobranças"
        subtitle="Atribua cobranças a membros. Ao marcar como pago, cria lançamento no fluxo de caixa; ao reabrir, remove a entrada."
        actions={
          writable ? (
            <Button
              onClick={() => {
                setForm(emptyForm());
                setOpen(true);
              }}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              <Plus className="mr-2 h-4 w-4" /> Nova cobrança
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="em_aberto">Em aberto</SelectItem>
            <SelectItem value="pago">Pagas</SelectItem>
            <SelectItem value="isento">Isentas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card className="rounded-[12px] p-5">
          <div className="text-sm text-muted-foreground">Recebido</div>
          <div className="text-xl font-bold text-emerald-600">{formatBRL(totals.paid)}</div>
        </Card>
        <Card className="rounded-[12px] p-5">
          <div className="text-sm text-muted-foreground">Em aberto</div>
          <div className="text-xl font-bold text-amber-600">{formatBRL(totals.openAmt)}</div>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : charges.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-7 w-7" />}
          title="Nenhuma cobrança"
          description="Crie cobranças avulsas e atribua a um membro."
        />
      ) : (
        <Card className="divide-y divide-border rounded-[12px]">
          {charges.map((c) => {
                  const overdue =
                    c.status === "em_aberto" &&
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      new Date().getDate(),
                    ) >
                      new Date(
                        Number(String(c.due_date).slice(0, 4)),
                        Number(String(c.due_date).slice(5, 7)) - 1,
                        Number(String(c.due_date).slice(8, 10)),
                      );
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {c.member_name || "—"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.description} · {c.category}
                    {c.subcategory ? ` / ${c.subcategory}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venc. {formatDateBR(c.due_date)} · {formatBRL(Number(c.amount))}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    overdue
                      ? "bg-rose-100 text-rose-800"
                      : c.status === "pago"
                        ? "bg-emerald-100 text-emerald-800"
                        : undefined
                  }
                >
                  {overdue ? "Atrasada" : STATUS_LABEL[c.status as ChargeStatus]}
                </Badge>
                {writable && (
                  <div className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => editCharge(c)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      onClick={() => {
                        if (confirm("Excluir esta cobrança?")) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cobrança" : "Nova cobrança"}</DialogTitle>
            <DialogDescription>
              Mesmas especificações de um lançamento de caixa. Baixar como pago gera a entrada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Membro *</Label>
              <Select
                value={form.memberId}
                onValueChange={(v) => setForm((f) => ({ ...f, memberId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, kind: v as "entrada" | "saida" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryNames.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Vencimento</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as ChargeStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_aberto">Em aberto</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="isento">Isento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "pago" && (
              <div>
                <Label className="mb-1.5 block text-sm">Data do pagamento</Label>
                <Input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                save.isPending || !form.memberId || !form.description.trim()
              }
              onClick={() => save.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
