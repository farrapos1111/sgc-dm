import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Plus,
  Trash2,
  Banknote,
  Wallet,
  History,
  Search,
  X,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useConfirmDialog } from "@/components/ConfirmDialog";
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
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { parseChargeAmount } from "@/lib/charge-amount";
import { formatBRL, formatDateBR } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
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

export const Route = createFileRoute(
  "/_authenticated/_shell/tesouraria/cobrancas",
)({
  head: () => ({
    meta: [
      { title: "Cobranças — Templo Virtual" },
      {
        name: "description",
        content: "Cobranças avulsas atribuídas a membros do capítulo.",
      },
    ],
  }),
  component: Cobrancas,
});

type ChargeStatus = "em_aberto" | "pago" | "isento";
type ListFilter = "pendentes" | "all" | "parcial" | "em_aberto" | "baixada";
type SortKey = "name_asc" | "name_desc" | "amount_asc" | "amount_desc";
type ChargeRow = Awaited<ReturnType<typeof listMemberCharges>>[number];

type ChargeForm = {
  id?: string;
  memberId: string;
  category: string;
  description: string;
  amount: string;
  status: ChargeStatus;
  dueDate: string;
  installments: string;
};

const emptyForm = (): ChargeForm => ({
  memberId: "",
  category: "Outras",
  description: "",
  amount: "",
  status: "em_aberto",
  dueDate: todayYmd(),
  installments: "1",
});

function addMonthsYmd(ymd: string, months: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7)) - 1 + months;
  const d = Number(ymd.slice(8, 10));
  const last = new Date(y, m + 1, 0).getDate();
  const dt = new Date(y, m, Math.min(d, last));
  return [
    String(dt.getFullYear()),
    String(dt.getMonth() + 1).padStart(2, "0"),
    String(dt.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Divide em centavos; o resto vai para as primeiras parcelas. */
function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

function parseInstallments(v: string): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 48) : 1;
}

const STATUS_LABEL: Record<ChargeStatus, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
};

function chargeBucket(c: ChargeRow): ListFilter | "isento" {
  if (c.status === "isento") return "isento";
  const amount = Number(c.amount) || 0;
  const amountPaid = Number(c.amount_paid) || 0;
  if (c.status === "pago" || (amount > 0 && amountPaid + 0.001 >= amount))
    return "baixada";
  if (amountPaid > 0) return "parcial";
  return "em_aberto";
}

function Cobrancas() {
  const { active } = useActiveChapter();
  const { can, canScreen } = useChapterAccess();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const writable =
    canScreen("cobrancas", "edit") || can("tesouraria");
  const [statusFilter, setStatusFilter] = useState<ListFilter>("pendentes");
  const [sortKey, setSortKey] = useState<SortKey>("name_asc");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ChargeForm>(emptyForm());
  const [payOpen, setPayOpen] = useState(false);
  const [payCharge, setPayCharge] = useState<ChargeRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayYmd());
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
    queryFn: () =>
      listChargeMembers({ data: { chapterId: active!.chapter_id } }),
  });

  const { data: catData } = useQuery({
    queryKey: ["cash-categories", active?.chapter_id],
    enabled: !!active && open,
    queryFn: () =>
      listCashCategories({ data: { chapterId: active!.chapter_id } }),
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
      if (statusFilter === "pendentes") {
        if (bucket !== "em_aberto" && bucket !== "parcial") return false;
      } else if (statusFilter !== "all" && bucket !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${c.member_name ?? ""} ${c.description ?? ""} ${c.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return [...list].sort((a, b) => {
      if (sortKey === "name_asc" || sortKey === "name_desc") {
        const cmp = (a.member_name ?? "").localeCompare(
          b.member_name ?? "",
          "pt-BR",
          {
            sensitivity: "base",
          },
        );
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
    const byMember = new Map<
      string,
      { name: string; count: number; total: number }
    >();
    for (const c of filteredCharges) {
      if (c.status === "isento") continue;
      const amount = Number(c.amount) || 0;
      const amountPaid = Number(c.amount_paid) || 0;
      const remaining = Math.max(0, amount - amountPaid);
      if (remaining <= 0) continue;
      const name = (c.member_name ?? "").trim() || "Sem nome";
      const cur = byMember.get(c.member_id) ?? { name, count: 0, total: 0 };
      cur.name = name;
      cur.count += 1;
      cur.total += remaining;
      byMember.set(c.member_id, cur);
    }

    const rows = [...byMember.values()]
      .sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      )
      .map((o) => {
        const itens = o.count === 1 ? "1 cobrança" : `${o.count} cobranças`;
        return `${o.name} - ${itens} - ${formatBRL(o.total)}`;
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
    mutationFn: async () => {
      const amount = parseChargeAmount(form.amount);
      if (amount == null) {
        throw new Error("O valor da cobrança deve ser pelo menos R$ 0,01");
      }
      const base = {
        chapterId: active!.chapter_id,
        memberId: form.memberId,
        kind: "entrada" as const,
        category: form.category,
        paidAt: todayYmd(),
      };
      const dueDate = form.dueDate || todayYmd();
      const n = form.id ? 1 : parseInstallments(form.installments);
      if (n === 1) {
        return upsertMemberCharge({
          data: {
            ...base,
            id: form.id,
            description: form.description.trim(),
            amount,
            dueDate,
            status: form.id ? form.status : "em_aberto",
          },
        });
      }
      const values = splitInstallments(amount, n);
      if (values.some((v) => parseChargeAmount(String(v)) == null)) {
        throw new Error("Valor pequeno demais para esse número de parcelas");
      }
      for (let i = 0; i < n; i++) {
        await upsertMemberCharge({
          data: {
            ...base,
            description: `${form.description.trim()} (${i + 1}/${n})`,
            amount: values[i],
            dueDate: addMonthsYmd(dueDate, i),
            status: "em_aberto",
          },
        });
      }
    },
    onSuccess: async () => {
      toast.success(
        !form.id && parseInstallments(form.installments) > 1
          ? "Cobrança parcelada criada"
          : "Cobrança salva",
      );
      setOpen(false);
      setForm(emptyForm());
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const chargeAmountValid = parseChargeAmount(form.amount) != null;

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
    onError: (e: any) =>
      toast.error(e?.message ?? "Erro ao registrar pagamento"),
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
    onError: (e: any) =>
      toast.error(e?.message ?? "Erro ao atualizar pagamento"),
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
      dueDate: String(c.due_date).slice(0, 10),
      installments: "1",
    });
    setOpen(true);
  }

  function openPay(c: ChargeRow) {
    const amount = Number(c.amount) || 0;
    const amountPaid = Number(c.amount_paid) || 0;
    const remaining = Math.max(0, amount - amountPaid);
    setPayCharge(c);
    setPayAmount(remaining > 0 ? String(remaining) : "");
    setPayDate(todayYmd());
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
          <div className="flex flex-wrap gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
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

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 sm:min-w-[200px] sm:max-w-xs sm:flex-1">
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
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Em aberto e parciais</SelectItem>
            <SelectItem value="em_aberto">Em aberto</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="baixada">Baixada</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-44">
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
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Recebido</div>
          <div className="text-xl font-bold text-emerald-600">
            {formatBRL(totals.paid)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Em aberto</div>
          <div className="text-xl font-bold text-amber-600">
            {formatBRL(totals.openAmt)}
          </div>
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
        <Card className="divide-y divide-border ">
          {filteredCharges.map((c) => {
            const amount = Number(c.amount) || 0;
            const amountPaid = Number(c.amount_paid) || 0;
            const pct =
              amount > 0
                ? Math.min(100, Math.round((amountPaid / amount) * 100))
                : 0;
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
            const badge = (
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
            );
            return (
              <div
                key={c.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 break-words text-sm font-medium sm:truncate">
                      {c.member_name || "—"}
                    </div>
                    <span className="shrink-0 sm:hidden">{badge}</span>
                  </div>
                  <div className="break-words text-xs text-muted-foreground sm:truncate">
                    {c.description} · {c.category}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(amountPaid)} de {formatBRL(amount)}
                    {remaining > 0 && c.status !== "isento"
                      ? ` · resta ${formatBRL(remaining)}`
                      : ""}
                  </div>
                  {c.due_date && c.status !== "isento" ? (
                    <div className="text-xs text-muted-foreground">
                      Vence em {formatDateBR(c.due_date)}
                    </div>
                  ) : null}
                  {c.status !== "isento" && (
                    <div className="space-y-1 sm:max-w-xs">
                      <Progress value={pct} className="h-1.5" />
                      <div className="text-xs text-muted-foreground">
                        {pct}% quitado
                      </div>
                    </div>
                  )}
                </div>
                <span className="hidden shrink-0 sm:inline-flex">{badge}</span>
                {writable && (
                  <div className="-mx-2 flex justify-end border-t border-border/60 pt-1 sm:mx-0 sm:border-0 sm:pt-0">
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
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Excluir cobrança?",
                          description: `Excluir a cobrança “${c.description}” de ${c.member_name || "membro"} e seus pagamentos?`,
                          confirmLabel: "Excluir",
                        });
                        if (ok) remove.mutate(c.id);
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
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar cobrança" : "Nova cobrança"}
            </DialogTitle>
            <DialogDescription>
              Busque o membro (mín. 2 letras). Pagamentos são registrados
              depois, na lista.
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
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
                min={0.01}
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">
                {!form.id && parseInstallments(form.installments) > 1
                  ? "1º vencimento"
                  : "Vencimento"}
              </Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </div>
            {!form.id && (
              <div>
                <Label className="mb-1.5 block text-sm">Parcelas</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={48}
                  step={1}
                  value={form.installments}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, installments: e.target.value }))
                  }
                />
              </div>
            )}
            {!form.id &&
              parseInstallments(form.installments) > 1 &&
              chargeAmountValid && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {parseInstallments(form.installments)}x de{" "}
                  {formatBRL(
                    splitInstallments(
                      parseChargeAmount(form.amount) ?? 0,
                      parseInstallments(form.installments),
                    )[0],
                  )}
                  , uma por mês a partir do vencimento. Cada parcela vira uma
                  cobrança separada.
                </p>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                save.isPending ||
                !form.memberId ||
                !form.description.trim() ||
                !chargeAmountValid
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
                  amount > 0
                    ? Math.min(100, Math.round((amountPaid / amount) * 100))
                    : 0;
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
                <Label className="mb-1.5 block text-sm">
                  Valor do pagamento (R$)
                </Label>
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
                  amount > 0
                    ? Math.min(100, Math.round((amountPaid / amount) * 100))
                    : 0;
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
                <p className="text-sm text-muted-foreground">
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {payHistory.map((p: any) => {
                    const isEditing = editingPayment?.id === p.id;
                    return (
                      <li
                        key={p.id}
                        className="rounded-md border border-border p-3"
                      >
                        {isEditing && editingPayment ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="mb-1 block text-xs">
                                  Valor (R$)
                                </Label>
                                <Input
                                  type="number"
                                  min={0.01}
                                  step="0.01"
                                  value={editingPayment.amount}
                                  onChange={(e) =>
                                    setEditingPayment((ep) =>
                                      ep
                                        ? { ...ep, amount: e.target.value }
                                        : ep,
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label className="mb-1 block text-xs">
                                  Data
                                </Label>
                                <Input
                                  type="date"
                                  value={editingPayment.paidAt}
                                  onChange={(e) =>
                                    setEditingPayment((ep) =>
                                      ep
                                        ? { ...ep, paidAt: e.target.value }
                                        : ep,
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
                                style={{
                                  backgroundColor:
                                    active?.chapter.primary_color,
                                }}
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
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: "Excluir pagamento?",
                                      description:
                                        "Excluir este pagamento? O lançamento correspondente será removido do fluxo e o valor voltará para a cobrança.",
                                      confirmLabel: "Excluir",
                                    });
                                    if (ok) removePayment.mutate(p.id);
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
                Number(historyCharge.amount_paid) <
                  Number(historyCharge.amount) && (
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
      {dialog}
    </div>
  );
}
