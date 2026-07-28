import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { can } from "@/lib/permissions";
import { formatBRL } from "@/lib/format";
import { generateDues, listDues, upsertDue } from "@/lib/finance.functions";

export const Route = createFileRoute("/_authenticated/_shell/tesouraria/mensalidades")({
  head: () => ({
    meta: [
      { title: "Mensalidades — SG-CDM" },
      { name: "description", content: "Controle das mensalidades dos membros do capítulo." },
    ],
  }),
  component: Mensalidades,
});

const DUE_LABELS: Record<string, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
};

function Mensalidades() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [defaultAmount, setDefaultAmount] = useState(50);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const writable = can(active?.role.name, "tesouraria");

  const { data, isLoading } = useQuery({
    queryKey: ["dues", active?.chapter_id, year, month],
    enabled: !!active,
    queryFn: () => listDues({ data: { chapterId: active!.chapter_id, year, month } }),
  });

  const members = data?.members ?? [];
  const dues = data?.dues ?? [];
  const byMember = useMemo(() => new Map(dues.map((d) => [d.member_id, d])), [dues]);

  const totals = useMemo(() => {
    let paid = 0;
    let openAmount = 0;
    for (const d of dues) {
      if (d.status === "pago") paid += Number(d.amount);
      else if (d.status === "em_aberto") openAmount += Number(d.amount);
    }
    return { paid, openAmount };
  }, [dues]);

  const setStatus = useMutation({
    mutationFn: (v: { memberId: string; status: "em_aberto" | "pago" | "isento"; amount: number }) =>
      upsertDue({
        data: {
          chapterId: active!.chapter_id,
          memberId: v.memberId,
          year,
          month,
          amount: v.amount,
          status: v.status,
          paidAt,
        },
      }),
    onSuccess: async (_r, v) => {
      if (v.status === "pago") toast.success("Pagamento registrado no fluxo de caixa");
      await qc.invalidateQueries({ queryKey: ["dues"] });
      await qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const generate = useMutation({
    mutationFn: () =>
      generateDues({ data: { chapterId: active!.chapter_id, year, month, amount: defaultAmount } }),
    onSuccess: async (r) => {
      toast.success(`${r.created} mensalidades geradas`);
      await qc.invalidateQueries({ queryKey: ["dues"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar"),
  });

  return (
    <div>
      <PageHeader
        title="Mensalidades"
        subtitle="Cobrança apenas de membros ativos — Senior DeMolay e Maçom são isentos."
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>
                {new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {writable && (
          <>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Valor padrão</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-32"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Data do pagamento</Label>
              <Input
                type="date"
                className="w-44"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              Gerar competência
            </Button>
          </>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card className="rounded-[12px] p-5">
          <div className="text-sm text-muted-foreground">Recebido</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(totals.paid)}</div>
        </Card>
        <Card className="rounded-[12px] p-5">
          <div className="text-sm text-muted-foreground">Em aberto</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatBRL(totals.openAmount)}</div>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="Nenhum membro ativo"
          description="Apenas membros com status Ativo geram mensalidade."
        />
      ) : (
        <Card className="divide-y divide-border rounded-[12px]">
          {members.map((m) => {
            const due = byMember.get(m.id);
            const status = due?.status ?? "em_aberto";
            const amount = Number(due?.amount ?? defaultAmount);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground">{formatBRL(amount)}</div>
                </div>
                {!due && <span className="text-xs text-muted-foreground">sem lançamento</span>}
                {writable ? (
                  <Select
                    value={status}
                    onValueChange={(v) =>
                      setStatus.mutate({ memberId: m.id, status: v as any, amount })
                    }
                  >
                    <SelectTrigger className="h-11 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_aberto">Em aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{DUE_LABELS[status]}</Badge>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Ao marcar como <strong>Pago</strong>, o sistema lança automaticamente uma entrada no fluxo de
        caixa na categoria “Mensalidades”.
      </p>
    </div>
  );
}
