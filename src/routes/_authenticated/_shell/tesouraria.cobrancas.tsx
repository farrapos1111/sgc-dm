import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Banknote, Wallet, History, Search, X, Copy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  addChargePayment,
  deleteChargePayment,
  deleteMemberCharge,
  listCashCategories,
  listChargeMembers,
  listChargePayments,
  listMemberCharges,
  updateChargePayment,
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
type ListFilter = "all" | "parcial" | "em_aberto" | "baixada";
type SortKey = "name_asc" | "name_desc" | "amount_asc" | "amount_desc";
type ChargeRow = Awaited<ReturnType<typeof listMemberCharges>>[number];

type ChargeForm = {
  id?: string;
  memberId: string;
  category: string;
  description: string;
  amount: string;
  status: ChargeStatus;
};

const emptyForm = (): ChargeForm => ({
  memberId: "",
  category: "Outras",
  description: "",
  amount: "",
  status: "em_aberto",
});

const STATUS_LABEL: Record<ChargeStatus, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
};

function chargeBucket(c: ChargeRow): ListFilter | "isento" {
  if (c.status === "isento") return "isento";
  const amount = Number(c.amount) || 0;
  const amountPaid = Number(c.amount_paid) || 0;
  if (c.status === "pago" || (amount > 0 && amountPaid + 0.001 >= amount)) return "baixada";
  if (amountPaid > 0) return "parcial";
  return "em_aberto";
}
function Cobrancas() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const writable = can(active?.role.name, "tesouraria");
  const [statusFilter, setStatusFilter] = useState<ListFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name_asc");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChargeForm>(emptyForm());
  const [payOpen, setPayOpen] = useState(false);
  const [payCharge, setPayCharge] = useState<ChargeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCharge, setHistoryCharge] = useState<ChargeRow | null>(null);
  const [editingPayment, setEditingPayment] = useState<{
    id: string;
    amount: string;
    paidAt: string;
  } | null>(null);

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["member-charges", active?.chapter_id],
    enabled: !!active,
    queryFn: () =>
      listMemberCharges({
        data: { chapterId: active!.chapter_id, status: "all" },
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

  const { data: payHistory = [] } = useQuery({
    queryKey: ["charge-payments", payCharge?.id ?? historyCharge?.id],
    enabled: !!(payCharge?.id || historyCharge?.id) && (payOpen || historyOpen),
    queryFn: () =>
      listChargePayments({
        data: { chargeId: (payCharge ?? historyCharge)!.id },
      }),
  });

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: m.full_name })),
    [members],
  );

  const categoryNames = useMemo(() => {
    const names = new Set<string>(FIXED_CATEGORIES);
    for (const c of catData?.categories ?? []) names.add(c.name);
    if (form.category) names.add(form.category);
    return [...names];
  }, [catData?.categories, form.category]);

  const filteredCharges = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = charges.filter((c) => {
      const bucket = chargeBucket(c);
      if (statusFilter !== "all" && bucket !== statusFilter) return false;
      if (!q) return true;
      const hay = `${c.member_name ?? ""} ${c.description ?? ""} ${c.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return [...list].sort((a, b) => {
      if (sortKey === "name_asc" || sortKey === "name_desc") {
        const cmp = (a.member_name ?? "").localeCompare(b.member_name ?? "", "pt-BR", {
          sensitivity: "base",
        });
        return sortKey === "name_asc" ? cmp : -cmp;
      }
      const diff = (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return sortKey === "amount_asc" ? diff : -diff;
    });
  }, [charges, statusFilter, search, sortKey]);

  const totals = useMemo(() => {
    let openAmt = 0;
    let paid = 0;
    for (const c of charges) {
      const amount = Number(c.amount) || 0;
      const amountPaid = Number(c.amount_paid) || 0;
      if (c.status === "isento") continue;
      paid += Math.min(amountPaid, amount);
      openAmt += Math.max(0, amount - amountPaid);
    }
    return { openAmt, paid };
  }, [charges]);

  async function copyOpenList() {
    const byMember = new Map<string, { count: number; total: number }>();
    for (const c of filteredCharges) {
      if (c.status === "isento") continue;
      const amount = Number(c.amount) || 0;
      const amountPaid = Number(c.amount_paid) || 0;
      const remaining = Math.max(0, amount - amountPaid);
      if (remaining <= 0) continue;
      const name = (c.member_name ?? "").trim() || "Sem nome";
      const cur = byMember.get(name) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += remaining;
      byMember.set(name, cur);
    }

    const rows = [...byMember.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map(([name, o]) => {
        const itens =
          o.count === 1 ? "1 cobrança" : `${o.count} cobranças`;
        return `${name} - ${itens} - ${formatBRL(o.total)}`;
      });

    if (rows.length === 0) {
      toast.message("Nenhum membro com cobrança em aberto na lista");
      return;
    }

    const now = new Date();
    const dateLabel = [
      String(now.getDate()).padStart(2, "0"),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getFullYear()),
    ].join("/");

    const text = [
      "Lista de Cobranças em Aberto:",
      dateLabel,
      "",
      "*Nome - Cobranças - Total devido*",
      ...rows,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `Lista copiada (${rows.length} membro${rows.length === 1 ? "" : "s"})`,
      );
    } catch {
      toast.error("Não foi possível copiar para a área de transferência");
    }
  }

  const save = useMutation({
    mutationFn: () =>
      upsertMemberCharge({
        data: {
          chapterId: active!.chapter_id,
          id: form.id,
          memberId: form.memberId,
          kind: "entrada",
          category: form.category,
          description: form.description.trim(),
          amount: Number(String(form.amount).replace(",", ".")) || 0,
          dueDate: new Date().toISOString().slice(0, 10),
          status: form.id ? form.status : "em_aberto",
          paidAt: new Date().toISOString().slice(0, 10),
        },
      }),
    onSuccess: async () => {
      toast.success("Cobrança salva");
      setOpen(false);
      setForm(emptyForm());
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const pay = useMutation({
    mutationFn: () =>
      addChargePayment({
        data: {
          chapterId: active!.chapter_id,
          chargeId: payCharge!.id,
          amount: Number(String(payAmount).replace(",", ".")) || 0,
          paidAt: payDate,
        },
      }),
    onSuccess: async (r) => {
      toast.success(
        r.fullyPaid
          ? "Cobrança quitada — lançamento criado no fluxo"
          : "Pagamento registrado — lançamento criado no fluxo",
      );
      setPayOpen(false);
      setPayCharge(null);
      setPayAmount("");
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["charge-payments"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar pagamento"),
  });

  const savePaymentEdit = useMutation({
    mutationFn: () =>
      updateChargePayment({
        data: {
          chapterId: active!.chapter_id,
          paymentId: editingPayment!.id,
          amount: Number(String(editingPayment!.amount).replace(",", ".")) || 0,
          paidAt: editingPayment!.paidAt,
        },
      }),
    onSuccess: async () => {
      toast.success("Pagamento atualizado (fluxo sincronizado)");
      setEditingPayment(null);
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["charge-payments"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar pagamento"),
  });

  const removePayment = useMutation({
    mutationFn: (paymentId: string) =>
      deleteChargePayment({
        data: { chapterId: active!.chapter_id, paymentId },
      }),
    onSuccess: async () => {
      toast.success("Pagamento removido da cobrança e do fluxo");
      setEditingPayment(null);
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["charge-payments"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir pagamento"),
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

  function editCharge(c: ChargeRow) {
    setForm({
      id: c.id,
      memberId: c.member_id,
      category: c.category,
      description: c.description,
      amount: String(c.amount),
      status: c.status as ChargeStatus,
    });
    setOpen(true);
  }

  function openPay(c: ChargeRow) {
    const amount = Number(c.amount) || 0;
    const amountPaid = Number(c.amount_paid) || 0;
    const remaining = Math.max(0, amount - amountPaid);
    setPayCharge(c);
    setPayAmount(remaining > 0 ? String(remaining) : "");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayOpen(true);
  }

  function openHistory(c: ChargeRow) {
    setHistoryCharge(c);
    setEditingPayment(null);
    setHistoryOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Cobranças"
        subtitle="Atribua cobranças a membros, registre pagamentos parciais ou totais e acompanhe a quitação. Cada pagamento gera lançamento no fluxo de caixa."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyOpenList()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar lista
            </Button>
            {writable ? (
              <Button
                onClick={() => {
                  setForm(emptyForm());
                  setOpen(true);
                }}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova cobrança
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 pr-8"
            placeholder="Buscar membro, descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ListFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="em_aberto">Em aberto</SelectItem>
            <SelectItem value="baixada">Baixada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nome A–Z</SelectItem>
            <SelectItem value="name_desc">Nome Z–A</SelectItem>
            <SelectItem value="amount_asc">Valor ↑</SelectItem>
            <SelectItem value="amount_desc">Valor ↓</SelectItem>
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
      ) : filteredCharges.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-7 w-7" />}
          title="Nenhuma cobrança encontrada"
          description="Ajuste a busca ou o filtro de status."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-border rounded-[12px]">
          {filteredCharges.map((c) => {
            const amount = Number(c.amount) || 0;
            const amountPaid = Number(c.amount_paid) || 0;
            const pct =
              amount > 0 ? Math.min(100, Math.round((amountPaid / amount) * 100)) : 0;
            const remaining = Math.max(0, amount - amountPaid);
            const overdue =
              c.status === "em_aberto" &&
              remaining > 0 &&
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
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="truncate text-sm font-medium">
                    {c.member_name || "—"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.description} · {c.category}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(amountPaid)} de {formatBRL(amount)}
                    {remaining > 0 && c.status !== "isento"
                      ? ` · resta ${formatBRL(remaining)}`
                      : ""}
                  </div>
                  {c.status !== "isento" && (
                    <div className="max-w-xs space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <div className="text-[11px] text-muted-foreground">{pct}% quitado</div>
                    </div>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={
                    overdue
                      ? "bg-rose-100 text-rose-800"
                      : c.status === "pago" || pct >= 100
                        ? "bg-emerald-100 text-emerald-800"
                        : amountPaid > 0
                          ? "bg-amber-100 text-amber-800"
                          : undefined
                  }
                >
                  {overdue
                    ? "Atrasada"
                    : pct >= 100 || c.status === "pago"
                      ? "Pago"
                      : amountPaid > 0
                        ? "Parcial"
                        : STATUS_LABEL[c.status as ChargeStatus]}
                </Badge>
                {writable && (
                  <div className="inline-flex">
                    {c.status !== "isento" && remaining > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Registrar pagamento"
                        onClick={() => openPay(c)}
                      >
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Histórico de pagamentos"
                      onClick={() => openHistory(c)}
                    >
                      <History className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
                        if (confirm("Excluir esta cobrança e seus pagamentos?"))
                          remove.mutate(c.id);
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
              Busque o membro (mín. 2 letras). Pagamentos são registrados depois, na lista.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Membro *</Label>
              <SearchableSelect
                value={form.memberId}
                options={memberOptions}
                onChange={(v) => setForm((f) => ({ ...f, memberId: v }))}
                placeholder="Buscar membro…"
                searchPlaceholder="Digite ao menos 2 letras…"
                minQueryLength={2}
                minQueryHint="Digite ao menos 2 letras do nome."
                emptyText="Nenhum membro encontrado."
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
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

      <Dialog
        open={payOpen}
        onOpenChange={(v) => {
          setPayOpen(v);
          if (!v) setPayCharge(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payCharge
                ? `${payCharge.member_name} · ${payCharge.description}`
                : "Pagamento da cobrança"}
            </DialogDescription>
          </DialogHeader>
          {payCharge && (
            <div className="space-y-3">
              {(() => {
                const amount = Number(payCharge.amount) || 0;
                const amountPaid = Number(payCharge.amount_paid) || 0;
                const remaining = Math.max(0, amount - amountPaid);
                const pct =
                  amount > 0 ? Math.min(100, Math.round((amountPaid / amount) * 100)) : 0;
                return (
                  <div className="space-y-1.5 rounded-md border border-border p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quitação</span>
                      <span>
                        {formatBRL(amountPaid)} / {formatBRL(amount)}
                      </span>
                    </div>
                    <Progress value={pct} />
                    <div className="text-xs text-muted-foreground">
                      Em aberto: {formatBRL(remaining)}
                    </div>
                  </div>
                );
              })()}
              <div>
                <Label className="mb-1.5 block text-sm">Valor do pagamento (R$)</Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Data</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              {payHistory.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Pagamentos anteriores
                  </div>
                  <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
                    {payHistory.map((p: any) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>{formatDateBR(p.paid_at)}</span>
                        <span className="font-medium text-emerald-600">
                          {formatBRL(Number(p.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                pay.isPending ||
                !payCharge ||
                !(Number(String(payAmount).replace(",", ".")) > 0)
              }
              onClick={() => pay.mutate()}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyOpen}
        onOpenChange={(v) => {
          setHistoryOpen(v);
          if (!v) {
            setHistoryCharge(null);
            setEditingPayment(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de pagamentos</DialogTitle>
            <DialogDescription>
              {historyCharge
                ? `${historyCharge.member_name} · ${historyCharge.description}`
                : "Pagamentos da cobrança"}
            </DialogDescription>
          </DialogHeader>

          {historyCharge && (
            <div className="space-y-3">
              {(() => {
                const amount = Number(historyCharge.amount) || 0;
                const amountPaid = Number(historyCharge.amount_paid) || 0;
                const pct =
                  amount > 0 ? Math.min(100, Math.round((amountPaid / amount) * 100)) : 0;
                return (
                  <div className="space-y-1.5 rounded-md border border-border p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quitação</span>
                      <span>
                        {formatBRL(amountPaid)} / {formatBRL(amount)}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })()}

              {payHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {payHistory.map((p: any) => {
                    const isEditing = editingPayment?.id === p.id;
                    return (
                      <li
                        key={p.id}
                        className="rounded-md border border-border p-3"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="mb-1 block text-xs">Valor (R$)</Label>
                                <Input
                                  type="number"
                                  min={0.01}
                                  step="0.01"
                                  value={editingPayment.amount}
                                  onChange={(e) =>
                                    setEditingPayment((ep) =>
                                      ep ? { ...ep, amount: e.target.value } : ep,
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">Data</Label>
                                <Input
                                  type="date"
                                  value={editingPayment.paidAt}
                                  onChange={(e) =>
                                    setEditingPayment((ep) =>
                                      ep ? { ...ep, paidAt: e.target.value } : ep,
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={savePaymentEdit.isPending}
                                onClick={() => savePaymentEdit.mutate()}
                                style={{ backgroundColor: active?.chapter.primary_color }}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingPayment(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-emerald-600">
                                {formatBRL(Number(p.amount))}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDateBR(p.paid_at)}
                                {p.cash_entry_id ? " · no fluxo" : ""}
                              </div>
                            </div>
                            {writable && (
                              <div className="inline-flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Editar pagamento"
                                  onClick={() =>
                                    setEditingPayment({
                                      id: p.id,
                                      amount: String(p.amount),
                                      paidAt: String(p.paid_at).slice(0, 10),
                                    })
                                  }
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Excluir pagamento"
                                  disabled={removePayment.isPending}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Excluir este pagamento? O lançamento correspondente será removido do fluxo e o valor voltará para a cobrança.",
                                      )
                                    ) {
                                      removePayment.mutate(p.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {writable &&
                historyCharge.status !== "isento" &&
                Number(historyCharge.amount_paid) < Number(historyCharge.amount) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setHistoryOpen(false);
                      openPay(historyCharge);
                    }}
                  >
                    <Wallet className="mr-2 h-4 w-4" /> Registrar novo pagamento
                  </Button>
                )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
