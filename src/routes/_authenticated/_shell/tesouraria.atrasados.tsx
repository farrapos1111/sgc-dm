import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  FileText,
  MessageCircle,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { formatBRL, formatDateBR } from "@/lib/format";
import { chapterFoundedAt } from "@/lib/terms";
import {
  getFinanceSigners,
  listMemberCharges,
  listYearDues,
} from "@/lib/finance.functions";
import {
  getChapterDefaultDuesAmount,
  isChapterDuesEnabled,
  type DueMemberLite,
} from "@/lib/dues-rules";
import {
  buildOverdueReportMessage,
  buildReminderMessage,
  buildWhatsAppUrl,
  classifyOpenChargesByMember,
  classifyOpenMonthsForMember,
  normalizeWhatsAppDigits,
  type ReminderChargeLine,
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
          "Mensalidades e cobranças em atraso por membro, com mensagem para WhatsApp.",
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
  openCharges: ReminderChargeLine[];
  overdueCharges: ReminderChargeLine[];
  chargesTotal: number;
  grandTotal: number;
};

function Atrasados() {
  const { active } = useActiveChapter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  /** Observações livres por membro (incluídas no relatório). */
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

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

  const { data: charges = [] } = useQuery({
    queryKey: ["member-charges", chapterId, "atrasados"],
    enabled: !!chapterId && duesEnabled,
    staleTime: DUES_STALE_MS,
    queryFn: () =>
      listMemberCharges({
        data: { chapterId: chapterId!, status: "em_aberto" },
      }),
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

  const openChargesByMember = useMemo(
    () => classifyOpenChargesByMember(charges),
    [charges],
  );

  const rows = useMemo((): MemberRow[] => {
    const byId = new Map<string, MemberRow>();

    function pack(
      member: DueMemberLite,
      summary: ReminderMemberSummary,
      openCharges: ReminderChargeLine[],
    ): MemberRow {
      const overdueCharges = openCharges.filter((c) => c.kind === "atrasado");
      const chargesTotal = openCharges.reduce((s, c) => s + c.amount, 0);
      return {
        member,
        summary,
        openCharges,
        overdueCharges,
        chargesTotal,
        grandTotal: summary.total + chargesTotal,
      };
    }

    for (const member of members) {
      const summary = classifyOpenMonthsForMember(
        member.id,
        year,
        dues,
        defaultAmount,
        undefined,
        member,
      );
      byId.set(
        member.id,
        pack(member, summary, openChargesByMember.get(member.id) ?? []),
      );
    }

    // Membros só com cobrança (fora da tabela de mensalidades do ano).
    for (const [memberId, openCharges] of openChargesByMember) {
      if (byId.has(memberId)) continue;
      const sample = charges.find((c) => c.member_id === memberId);
      const member: DueMemberLite = {
        id: memberId,
        full_name: sample?.member_name || "Membro",
        status: "regular",
        kind: "ativo",
        birth_date: null,
        iniciacao_ordem: null,
        phone: null,
      };
      const summary = classifyOpenMonthsForMember(
        memberId,
        year,
        dues,
        defaultAmount,
        undefined,
        member,
      );
      byId.set(memberId, pack(member, summary, openCharges));
    }

    return [...byId.values()];
  }, [members, dues, year, defaultAmount, openChargesByMember, charges]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) =>
        r.member.full_name.toLowerCase().includes(q),
      );
    }
    if (onlyOverdue) {
      list = list.filter(
        (r) => r.summary.overdueCount > 0 || r.overdueCharges.length > 0,
      );
    }
    return [...list].sort((a, b) => {
      const ao = a.summary.overdueCount + a.overdueCharges.length;
      const bo = b.summary.overdueCount + b.overdueCharges.length;
      if (ao !== bo) return bo - ao;
      const at = a.grandTotal;
      const bt = b.grandTotal;
      if (at !== bt) return bt - at;
      return a.member.full_name.localeCompare(b.member.full_name, "pt-BR");
    });
  }, [rows, search, onlyOverdue]);

  const overdueMembers = useMemo(
    () =>
      rows.filter(
        (r) => r.summary.overdueCount > 0 || r.overdueCharges.length > 0,
      ).length,
    [rows],
  );
  const openTotal = useMemo(
    () => rows.reduce((s, r) => s + r.grandTotal, 0),
    [rows],
  );

  function messageFor(row: MemberRow): string {
    return buildReminderMessage({
      fullName: row.member.full_name,
      months: row.summary.months,
      total: row.summary.total,
      charges: row.openCharges,
      chargesTotal: row.chargesTotal,
      pixKey,
      treasurerName,
    });
  }

  function reportMembersFrom(list: MemberRow[]) {
    return list
      .filter(
        (r) => r.summary.months.length > 0 || r.openCharges.length > 0,
      )
      .map((r) => ({
        fullName: r.member.full_name,
        months: r.summary.months,
        charges: r.openCharges,
        monthsTotal: r.summary.total,
        chargesTotal: r.chargesTotal,
        grandTotal: r.grandTotal,
        observation: observations[r.member.id] ?? "",
      }));
  }

  function openReport() {
    const membersForReport = reportMembersFrom(displayed);
    if (membersForReport.length === 0) {
      toast.message("Nenhum membro com valores em aberto neste filtro");
      return;
    }
    setReportText(
      buildOverdueReportMessage({
        chapterName: active?.chapter?.name,
        year,
        members: membersForReport,
      }),
    );
    setReportOpen(true);
  }

  async function copyReport() {
    const text =
      reportText.trim() ||
      buildOverdueReportMessage({
        chapterName: active?.chapter?.name,
        year,
        members: reportMembersFrom(displayed),
      });
    if (!text.trim()) {
      toast.message("Relatório vazio");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado");
    } catch {
      toast.error("Não foi possível copiar o relatório");
    }
  }

  async function copyMessage(row: MemberRow) {
    if (row.summary.months.length === 0 && row.openCharges.length === 0) {
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
    if (row.summary.months.length === 0 && row.openCharges.length === 0) {
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
        subtitle={`Mensalidades (valor ${formatBRL(defaultAmount)}) e cobranças em aberto/atraso. Mensagem pronta para WhatsApp com PIX e assinatura do Tesoureiro.`}
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
        <Button
          type="button"
          variant="outline"
          onClick={openReport}
          disabled={displayed.every(
            (r) =>
              r.summary.months.length === 0 && r.openCharges.length === 0,
          )}
        >
          <FileText className="mr-1.5 h-4 w-4" />
          Relatório
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
              ? "Ninguém com mensalidade ou cobrança atrasada neste filtro."
              : "Ajuste a busca ou o ano."
          }
        />
      ) : (
        <ul className="space-y-2">
          {displayed.map((row) => {
            const {
              member,
              summary,
              openCharges,
              overdueCharges,
              chargesTotal,
              grandTotal,
            } = row;
            const openOnlyCharges = openCharges.filter(
              (c) => c.kind === "em_aberto",
            );
            const hasOpen =
              summary.months.length > 0 || openCharges.length > 0;
            const hasPhone = Boolean(normalizeWhatsAppDigits(member.phone));
            const highlighted =
              summary.overdueCount > 0 || overdueCharges.length > 0;
            const overdueItems =
              summary.overdueCount + overdueCharges.length;

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
                            {overdueItems} atrasad
                            {overdueItems === 1 ? "o" : "os"}
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

                      {summary.months.length > 0 ? (
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
                        </ul>
                      ) : null}

                      {overdueCharges.length > 0 ? (
                        <div className="mt-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
                            Cobranças em atraso
                          </div>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            {overdueCharges.map((c) => (
                              <li
                                key={c.id}
                                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                              >
                                <span className="min-w-0">
                                  <span className="mr-1">🔴</span>
                                  <span className="text-foreground">
                                    {c.description}
                                  </span>
                                  <span className="ml-1 text-xs">
                                    (venc. {formatDateBR(c.dueDate)})
                                  </span>
                                </span>
                                <span className="shrink-0 font-medium text-foreground">
                                  {formatBRL(c.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {openOnlyCharges.length > 0 ? (
                        <div className="mt-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                            Cobranças em aberto
                          </div>
                          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                            {openOnlyCharges.map((c) => (
                              <li
                                key={c.id}
                                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                              >
                                <span className="min-w-0">
                                  <span className="mr-1">🟡</span>
                                  <span className="text-foreground">
                                    {c.description}
                                  </span>
                                  <span className="ml-1 text-xs">
                                    (venc. {formatDateBR(c.dueDate)})
                                  </span>
                                </span>
                                <span className="shrink-0 font-medium text-foreground">
                                  {formatBRL(c.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {hasOpen ? (
                        <div className="mt-2 space-y-0.5 text-sm">
                          {summary.total > 0 && chargesTotal > 0 ? (
                            <>
                              <div className="text-muted-foreground">
                                Mensalidades: {formatBRL(summary.total)}
                              </div>
                              <div className="text-muted-foreground">
                                Cobranças: {formatBRL(chargesTotal)}
                              </div>
                            </>
                          ) : null}
                          <div className="font-medium text-foreground">
                            💲 Total = {formatBRL(grandTotal)}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Sem mensalidades ou cobranças em aberto neste ano.
                        </p>
                      )}

                      {hasOpen ? (
                        <div className="mt-3">
                          <Label
                            htmlFor={`obs-${member.id}`}
                            className="mb-1 block text-xs text-muted-foreground"
                          >
                            Observação
                          </Label>
                          <Input
                            id={`obs-${member.id}`}
                            value={observations[member.id] ?? ""}
                            onChange={(e) =>
                              setObservations((prev) => ({
                                ...prev,
                                [member.id]: e.target.value,
                              }))
                            }
                            placeholder="Anotação para o relatório…"
                            className="h-9"
                          />
                        </div>
                      ) : null}
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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Relatório de atrasados</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Inclui mensalidades e cobranças em atraso/em aberto da lista
            filtrada, com a linha de observação de cada membro.
          </p>
          <Textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            className="min-h-[50vh] flex-1 resize-y font-mono text-xs"
            aria-label="Texto do relatório"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setReportOpen(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void copyReport()}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copiar relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
