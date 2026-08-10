import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, Search, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { formatBRL } from "@/lib/format";
import { chapterFoundedAt } from "@/lib/terms";
import {
  getFinanceSigners,
  listYearDues,
} from "@/lib/finance.functions";
import {
  getChapterDefaultDuesAmount,
  isChapterDuesEnabled,
  type DueMemberLite,
} from "@/lib/dues-rules";
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  classifyOpenMonthsForMember,
  normalizeWhatsAppDigits,
  type ReminderMemberSummary,
} from "@/lib/dues-reminder";

export const Route = createFileRoute(
  "/_authenticated/_shell/tesouraria/atrasados",
)({
  head: () => ({
    meta: [
      { title: "Atrasados — Templo Virtual" },
      {
        name: "description",
        content:
          "Mensalidades por membro: atrasados e mês corrente, com mensagem para WhatsApp.",
      },
    ],
  }),
  component: Atrasados,
});

type DueRow = {
  id: string;
  member_id: string;
  amount: number | string;
  status: string;
  paid_at: string | null;
  competence_year: number;
  competence_month: number;
  cash_entry_id: string | null;
};

type YearDuesData = {
  members: DueMemberLite[];
  dues: DueRow[];
  defaultAmount: number;
};

const DUES_STALE_MS = 60_000;

function duesYearKey(chapterId: string, year: number) {
  return ["dues-year", chapterId, year] as const;
}

type MemberRow = {
  member: DueMemberLite;
  summary: ReminderMemberSummary;
};

function Atrasados() {
  const { active } = useActiveChapter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const chapterId = active?.chapter_id;
  const duesEnabled = isChapterDuesEnabled(active?.chapter);
  const defaultFromSettings = getChapterDefaultDuesAmount(active?.chapter);
  const pixKey =
    typeof active?.chapter?.settings?.pix_key === "string"
      ? active.chapter.settings.pix_key
      : null;

  const availableYears = useMemo(() => {
    const founded = chapterFoundedAt(active?.chapter);
    const start = founded ? Number(founded.slice(0, 4)) : now.getFullYear() - 2;
    const years: number[] = [];
    for (let y = now.getFullYear(); y >= start; y--) years.push(y);
    return years;
  }, [active?.chapter, now]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: duesYearKey(chapterId ?? "", year),
    enabled: !!chapterId && duesEnabled,
    staleTime: DUES_STALE_MS,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await listYearDues({
        data: { chapterId: chapterId!, year, ensure: true },
      })) as YearDuesData,
  });

  const { data: signers = [] } = useQuery({
    queryKey: ["finance-signers", chapterId],
    enabled: !!chapterId && duesEnabled,
    staleTime: 5 * 60_000,
    queryFn: () =>
      getFinanceSigners({ data: { chapterId: chapterId! } }),
  });

  const treasurerName =
    signers.find((s) => s.role === "Tesoureiro")?.name?.trim() || "";

  const defaultAmount = data?.defaultAmount ?? defaultFromSettings;
  const members = (data?.members ?? []) as DueMemberLite[];
  const dues = (data?.dues ?? []) as DueRow[];

  const rows = useMemo((): MemberRow[] => {
    return members.map((member) => ({
      member,
      summary: classifyOpenMonthsForMember(
        member.id,
        year,
        dues,
        defaultAmount,
      ),
    }));
  }, [members, dues, year, defaultAmount]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) =>
        r.member.full_name.toLowerCase().includes(q),
      );
    }
    if (onlyOverdue) {
      list = list.filter((r) => r.summary.overdueCount > 0);
    }
    return [...list].sort((a, b) => {
      const ao = a.summary.overdueCount;
      const bo = b.summary.overdueCount;
      if (ao !== bo) return bo - ao;
      const at = a.summary.total;
      const bt = b.summary.total;
      if (at !== bt) return bt - at;
      return a.member.full_name.localeCompare(b.member.full_name, "pt-BR");
    });
  }, [rows, search, onlyOverdue]);

  const overdueMembers = useMemo(
    () => rows.filter((r) => r.summary.overdueCount > 0).length,
    [rows],
  );
  const openTotal = useMemo(
    () => rows.reduce((s, r) => s + r.summary.total, 0),
    [rows],
  );

  function messageFor(row: MemberRow): string {
    return buildReminderMessage({
      fullName: row.member.full_name,
      months: row.summary.months,
      total: row.summary.total,
      pixKey,
      treasurerName,
    });
  }

  async function copyMessage(row: MemberRow) {
    if (row.summary.months.length === 0) {
      toast.message("Este membro está em dia");
      return;
    }
    try {
      await navigator.clipboard.writeText(messageFor(row));
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar a mensagem");
    }
  }

  function openWhatsApp(row: MemberRow) {
    if (row.summary.months.length === 0) {
      toast.message("Este membro está em dia");
      return;
    }
    const url = buildWhatsAppUrl(row.member.phone, messageFor(row));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!active) {
    return (
      <EmptyState
        title="Selecione um capítulo"
        description="Escolha um capítulo ativo para ver as mensalidades."
      />
    );
  }

  if (!duesEnabled) {
    return (
      <div className="space-y-4">
        <PageHeader title="Atrasados" />
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Este capítulo não cobra mensalidade. Ative a opção em{" "}
          <span className="font-medium text-foreground">
            Configurações → Tesouraria
          </span>
          .
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Atrasados"
        subtitle={`Por membro · valor ${formatBRL(defaultAmount)}. Mensagem pronta para WhatsApp com PIX e assinatura do Tesoureiro.`}
      />

      {!pixKey?.trim() ? (
        <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Chave PIX do capítulo não configurada. A mensagem será montada sem o
            bloco do PIX. Configure em Gestão → Configurações → Tesouraria.
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Ano
          </Label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Buscar
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome do membro"
              className="pl-8 pr-8"
            />
            {search ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant={onlyOverdue ? "default" : "outline"}
          onClick={() => setOnlyOverdue((v) => !v)}
        >
          Só atrasados
          {overdueMembers > 0 ? (
            <Badge
              variant="secondary"
              className="ml-2 bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            >
              {overdueMembers}
            </Badge>
          ) : null}
        </Button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Card className="rounded-[12px] p-3">
          <div className="text-xs text-muted-foreground">Membros na lista</div>
          <div className="text-lg font-semibold">{displayed.length}</div>
        </Card>
        <Card className="rounded-[12px] p-3">
          <div className="text-xs text-muted-foreground">Com atraso</div>
          <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">
            {overdueMembers}
          </div>
        </Card>
        <Card className="rounded-[12px] p-3">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div className="text-lg font-semibold">{formatBRL(openTotal)}</div>
        </Card>
      </div>

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : isError ? (
        <EmptyState
          title="Não foi possível carregar"
          description={(error as Error)?.message ?? "Erro desconhecido"}
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : displayed.length === 0 ? (
        <EmptyState
          title="Nenhum membro encontrado"
          description={
            onlyOverdue
              ? "Ninguém com mensalidade atrasada neste filtro."
              : "Ajuste a busca ou o ano."
          }
        />
      ) : (
        <ul className="space-y-2">
          {displayed.map((row) => {
            const { member, summary } = row;
            const hasOpen = summary.months.length > 0;
            const hasPhone = Boolean(normalizeWhatsAppDigits(member.phone));
            const highlighted = summary.overdueCount > 0;

            return (
              <li key={member.id}>
                <Card
                  className={`rounded-[12px] p-3 ${
                    highlighted
                      ? "border-rose-200 dark:border-rose-900/60"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {member.full_name}
                        </span>
                        {highlighted ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-200">
                            {summary.overdueCount} atrasad
                            {summary.overdueCount === 1 ? "o" : "os"}
                          </Badge>
                        ) : hasOpen ? (
                          <Badge variant="secondary">Em aberto</Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Em dia
                          </Badge>
                        )}
                      </div>

                      {hasOpen ? (
                        <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                          {summary.months.map((m) => (
                            <li key={`${m.year}-${m.month}`}>
                              <span className="mr-1">
                                {m.kind === "atrasado" ? "🔴" : "🟡"}
                              </span>
                              {m.label} — {formatBRL(m.amount)}{" "}
                              <span className="text-xs">
                                (
                                {m.kind === "atrasado"
                                  ? "atrasado"
                                  : "vencimento hoje"}
                                )
                              </span>
                            </li>
                          ))}
                          <li className="pt-1 font-medium text-foreground">
                            💲 Total = {formatBRL(summary.total)}
                          </li>
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sem mensalidades em aberto neste ano.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!hasOpen}
                        onClick={() => void copyMessage(row)}
                      >
                        <Copy className="mr-1.5 h-4 w-4" />
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!hasOpen}
                        onClick={() => openWhatsApp(row)}
                        title={
                          hasPhone
                            ? "Abrir WhatsApp com o telefone do cadastro"
                            : "Abrir WhatsApp sem número (escolha o contato)"
                        }
                      >
                        <MessageCircle className="mr-1.5 h-4 w-4" />
                        WhatsApp
                        {!hasPhone && hasOpen ? (
                          <span className="ml-1 text-[10px] opacity-70">
                            s/ nº
                          </span>
                        ) : null}
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
