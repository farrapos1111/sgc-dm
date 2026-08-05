import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Loader2, Receipt } from "lucide-react";
import { getMyMemberFinance } from "@/lib/profile.functions";
import {
  autoDueExemptTip,
  isDueOverdue,
  isFutureMonth,
  MONTH_SHORT,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { formatBRL, formatDateBR } from "@/lib/format";
import { currentYearMonthInAppTz } from "@/lib/timezone";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DUE_STATUS_LABEL: Record<string, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
  desligado: "Desligado",
};

export function MyFinancePanel({
  memberId,
  chapterId,
}: {
  memberId: string;
  chapterId: string;
}) {
  const currentYear = currentYearMonthInAppTz().year;
  const [year, setYear] = useState(currentYear);
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  const { data: finance, isLoading, error } = useQuery({
    queryKey: ["my-finance", memberId, chapterId, year],
    queryFn: () =>
      getMyMemberFinance({ data: { memberId, chapterId, year } }),
  });

  if (isLoading && !finance) {
    return (
      <Card className="flex justify-center rounded-[12px] p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[12px] p-5 text-sm text-destructive">
        {error instanceof Error ? error.message : "Erro ao carregar cobranças"}
      </Card>
    );
  }

  const summary = finance?.summary ?? {
    duesOpenCount: 0,
    duesOpenAmount: 0,
    chargesOpenCount: 0,
    chargesOpenAmount: 0,
    totalOpen: 0,
  };

  const memberLite: DueMemberLite = finance?.member
    ? {
        id: finance.member.id,
        full_name: finance.member.full_name,
        status: finance.member.status,
        kind: finance.member.kind,
        birth_date: finance.member.birth_date,
        iniciacao_ordem: finance.member.iniciacao_ordem,
      }
    : {
        id: memberId,
        full_name: "",
        status: "ativo",
        kind: "demolay",
        birth_date: null,
        iniciacao_ordem: null,
      };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Situação financeira</p>
          <p className="text-xs text-muted-foreground">
            Mensalidades e cobranças vinculadas a você neste capítulo
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-[12px] p-4">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div
            className={`mt-1 text-xl font-bold ${
              summary.totalOpen > 0 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {formatBRL(summary.totalOpen)}
          </div>
        </Card>
        <Card className="rounded-[12px] p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Mensalidades
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatBRL(summary.duesOpenAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {summary.duesOpenCount} competência
            {summary.duesOpenCount === 1 ? "" : "s"}
          </div>
        </Card>
        <Card className="rounded-[12px] p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" /> Cobranças
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatBRL(summary.chargesOpenAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {summary.chargesOpenCount} em aberto
          </div>
        </Card>
      </div>

      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold">
          Mensalidades · {year}
          {finance?.defaultAmount != null ? (
            <span className="ml-2 font-normal text-muted-foreground">
              · padrão {formatBRL(finance.defaultAmount)}
            </span>
          ) : null}
        </h3>
        {(finance?.dues.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma competência registrada neste ano.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {(finance?.dues ?? []).map((d) => {
              const future =
                d.status === "em_aberto" && isFutureMonth(year, d.month);
              const overdue = !future && isDueOverdue(year, d.month, d.status);
              const style = future
                ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                : d.status === "pago"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : d.status === "isento"
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
                    : d.status === "desligado"
                      ? "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                      : overdue
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
              const statusLabelTxt = future
                ? "·"
                : overdue
                  ? "Atrasado"
                  : (DUE_STATUS_LABEL[d.status] ?? d.status);
              const exemptTip =
                d.status === "isento"
                  ? autoDueExemptTip(memberLite, year, d.month)
                  : null;
              return (
                <div
                  key={d.id}
                  title={exemptTip ?? undefined}
                  className={`rounded-[8px] px-2 py-2 text-center ${style}`}
                >
                  <div className="text-xs font-medium">
                    {MONTH_SHORT[d.month - 1] ?? d.month}
                  </div>
                  <div className="text-[11px] opacity-80">{statusLabelTxt}</div>
                  <div className="mt-0.5 text-xs font-semibold">
                    {formatBRL(d.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold">Cobranças</h3>
        {(finance?.charges.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cobrança atribuída a você.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(finance?.charges ?? []).map((c) => {
              const pct =
                c.amount > 0
                  ? Math.min(100, Math.round((c.amount_paid / c.amount) * 100))
                  : 0;
              return (
                <li
                  key={c.id}
                  className="space-y-1.5 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {c.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.category} · venc. {formatDateBR(c.due_date)}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {c.remaining <= 0 || c.status === "pago"
                        ? "Quitada"
                        : c.amount_paid > 0
                          ? "Parcial"
                          : (DUE_STATUS_LABEL[c.status] ?? c.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatBRL(c.amount_paid)} de {formatBRL(c.amount)}
                    </span>
                    {c.remaining > 0 && c.status !== "isento" ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        resta {formatBRL(c.remaining)}
                      </span>
                    ) : null}
                  </div>
                  {c.status !== "isento" ? (
                    <Progress value={pct} className="h-1.5" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
