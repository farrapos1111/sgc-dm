import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getPublicCashFlow, type PublicCashEntry } from "@/lib/cash-share.functions";
import { exportCashPdf } from "@/lib/finance-pdf";
import { exportCashXlsx } from "@/lib/finance-xlsx";
import { formatBRL, formatDateBR } from "@/lib/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/fluxo-caixa/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Templo Virtual" },
      {
        name: "description",
        content: "Visualização pública do fluxo de caixa do capítulo.",
      },
    ],
  }),
  component: function PublicCashFlowRoute() {
    const { token } = Route.useParams();
    return <PublicCashFlowView token={token} variant="standalone" />;
  },
});

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

export function PublicCashFlowView({
  token,
  variant = "standalone",
}: {
  token: string;
  variant?: "standalone" | "lobby";
}) {
  const now = new Date();
  const embedded = variant === "lobby";
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [monthOrder, setMonthOrder] = useState<"newest" | "oldest">("newest");
  const [openMonths, setOpenMonths] = useState<Set<number>>(
    () => new Set([now.getMonth() + 1]),
  );
  const openMonthsPeriodRef = useRef<string>("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["public-cash-flow", token, year, month],
    queryFn: () => getPublicCashFlow({ data: { token, year, month } }),
    retry: false,
  });

  const entries = data?.entries ?? [];
  const opening = data?.opening ?? { balance: 0, previousYear: year - 1 };
  const openingBalance = Number(opening.balance) || 0;
  const bank = data?.bank ?? { income: 0, expense: 0, balance: 0 };
  const currentCashBalance = Number(bank.balance) || 0;
  const chapter = data?.chapter;

  useEffect(() => {
    if (month !== null) return;
    if (isLoading) return;
    const periodKey = `${token}:${year}`;
    if (openMonthsPeriodRef.current === periodKey) return;
    openMonthsPeriodRef.current = periodKey;

    const today = new Date();
    if (year === today.getFullYear()) {
      setOpenMonths(new Set([today.getMonth() + 1]));
    } else {
      setOpenMonths(new Set());
    }
  }, [year, month, token, isLoading]);

  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    const founded = chapter?.founded_at;
    const startYear = founded ? Number(founded.slice(0, 4)) : currentYear - 2;
    const years: number[] = [];
    for (let y = currentYear; y >= startYear; y--) years.push(y);
    return years;
  }, [chapter?.founded_at]);

  const filterCategoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries) {
      if (e.category) names.add(e.category);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries]);

  const filterSubcategoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries) {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) continue;
      if (e.subcategory) names.add(e.subcategory);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, selectedCategories]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) return false;
      if (selectedSubcategories.length) {
        if (!e.subcategory || !selectedSubcategories.includes(e.subcategory)) return false;
      }
      return true;
    });
  }, [entries, selectedCategories, selectedSubcategories]);

  useEffect(() => {
    if (!selectedSubcategories.length) return;
    const allowed = new Set(filterSubcategoryOptions);
    setSelectedSubcategories((prev) => {
      const next = prev.filter((s) => allowed.has(s));
      return next.length === prev.length ? prev : next;
    });
  }, [filterSubcategoryOptions, selectedSubcategories.length]);

  function toggleFilterValue(
    list: string[],
    value: string,
    setList: (next: string[]) => void,
  ) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const periodTotals = useMemo(() => {
    const hasClientFilters =
      selectedCategories.length > 0 || selectedSubcategories.length > 0;
    if (!hasClientFilters && data?.totals) {
      return {
        income: Number(data.totals.income) || 0,
        expense: Number(data.totals.expense) || 0,
        balance: Number(data.totals.balance) || 0,
      };
    }
    let income = 0;
    let expense = 0;
    for (const e of filteredEntries) {
      if (e.kind === "entrada") income += Number(e.amount);
      else expense += Number(e.amount);
    }
    return { income, expense, balance: income - expense };
  }, [filteredEntries, selectedCategories.length, selectedSubcategories.length, data?.totals]);

  const usingServerPeriodTotals =
    selectedCategories.length === 0 &&
    selectedSubcategories.length === 0 &&
    Boolean(data?.totals);

  const periodLabel = month ? `${monthName(month)} de ${year}` : `Ano de ${year}`;

  const isPastYear = year < now.getFullYear();
  const periodClosingBalance = openingBalance + periodTotals.balance;
  const cashBalanceValue = isPastYear ? periodClosingBalance : currentCashBalance;
  const cashBalanceLabel = isPastYear ? "Saldo final do caixa" : "Saldo Atual do Caixa";

  const entriesByMonth = useMemo(() => {
    if (month !== null) return null;
    const groups = new Map<number, PublicCashEntry[]>();
    for (const e of filteredEntries) {
      const m = Number(String(e.entry_date).slice(5, 7));
      if (!m) continue;
      const list = groups.get(m) ?? [];
      list.push(e);
      groups.set(m, list);
    }
    return [...groups.entries()]
      .sort((a, b) => (monthOrder === "newest" ? b[0] - a[0] : a[0] - b[0]))
      .map(([m, list]) => {
        let income = 0;
        let expense = 0;
        for (const e of list) {
          if (e.kind === "entrada") income += Number(e.amount);
          else expense += Number(e.amount);
        }
        return { month: m, entries: list, income, expense };
      });
  }, [filteredEntries, month, monthOrder]);

  function toggleMonth(m: number) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  async function handlePdf() {
    if (!data || !chapter) return;
    setExportingPdf(true);
    try {
      await exportCashPdf({
        chapterName: `${chapter.name} nº ${chapter.number}`,
        chapterCity: chapter.city,
        logoDataUrl: data.logoDataUrl,
        periodLabel,
        entries: [...filteredEntries].reverse(),
        totals: periodTotals,
        cashBalance: cashBalanceValue,
        cashBalanceLabel,
        opening: {
          balance: openingBalance,
          previousYear: opening.previousYear,
          title:
            month === null
              ? `Saldo remanescente do ano ${opening.previousYear}`
              : "Saldo inicial do período",
          hint:
            month === null
              ? "Caixa transferido do exercício anterior (chão deste relatório)."
              : `Inclui o restante do ano ${opening.previousYear} e meses anteriores (chão deste relatório).`,
        },
        signers: data.signers ?? [],
      });
    } finally {
      setExportingPdf(false);
    }
  }

  function handleXlsx() {
    exportCashXlsx(
      filteredEntries,
      `fluxo-de-caixa-${month ? `${year}-${String(month).padStart(2, "0")}` : year}.xlsx`,
      {
        periodLabel,
        cashBalance: cashBalanceValue,
        cashBalanceLabel,
        opening: {
          balance: openingBalance,
          previousYear: opening.previousYear,
          title:
            month === null
              ? `Saldo remanescente do ano ${opening.previousYear} (caixa transferido)`
              : `Saldo inicial do período (inclui restante de ${opening.previousYear})`,
        },
        totals: periodTotals,
      },
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-background px-4 ${
          embedded ? "py-16" : "min-h-svh"
        }`}
      >
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error).message ||
              "Este link de fluxo de caixa é inválido ou foi revogado."}
          </p>
        </Card>
      </div>
    );
  }

  const accent = chapter?.primary_color || "#9E1B32";
  const Container = embedded ? "div" : "main";

  return (
    <div className={embedded ? "bg-background" : "min-h-svh bg-background"}>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 px-1">
          <div>
            <h2 className="text-lg font-semibold">Fluxo de caixa</h2>
            <p className="text-sm text-muted-foreground">Somente leitura</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleXlsx} disabled={!data || isLoading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePdf()}
              disabled={!data || isLoading || exportingPdf}
            >
              <FileText className="mr-2 h-4 w-4" />
              {exportingPdf ? "Gerando…" : "PDF"}
            </Button>
          </div>
        </div>
      ) : (
        <header
          className="border-b border-border px-4 py-5 sm:px-6"
          style={{ borderTop: `3px solid ${accent}` }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fluxo de Caixa · visualização pública
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">
                {chapter
                  ? `${chapter.name} nº ${chapter.number}`
                  : isLoading
                    ? "Carregando…"
                    : "Fluxo de Caixa"}
              </h1>
              {chapter?.city ? (
                <p className="text-sm text-muted-foreground">{chapter.city}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle className="h-9 w-9 shrink-0" />
              <Button variant="outline" size="sm" onClick={handleXlsx} disabled={!data || isLoading}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handlePdf()}
                disabled={!data || isLoading || exportingPdf}
              >
                <FileText className="mr-2 h-4 w-4" />
                {exportingPdf ? "Gerando…" : "PDF"}
              </Button>
            </div>
          </div>
        </header>
      )}

      <Container
        className={
          embedded ? "py-2" : "mx-auto max-w-5xl px-4 py-6 sm:px-6"
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {data?.entries_truncated ? (
            <p className="w-full text-xs text-amber-700 dark:text-amber-300">
              Exibindo os {entries.length} lançamentos mais recentes de{" "}
              {data.entries_total ?? "vários"} no período.
              {usingServerPeriodTotals
                ? " Totais usam o período completo."
                : " Totais refletem apenas os lançamentos filtrados exibidos."}
            </p>
          ) : null}
          <Select
            value={month === null ? "all" : String(month)}
            onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Geral (todos)</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {monthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-36 justify-between"
                disabled={filterCategoryOptions.length === 0}
              >
                <span>
                  Categorias
                  {selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ""}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filtrar categorias</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterCategoryOptions.map((name) => (
                <DropdownMenuCheckboxItem
                  key={name}
                  checked={selectedCategories.includes(name)}
                  onCheckedChange={() =>
                    toggleFilterValue(selectedCategories, name, setSelectedCategories)
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {name}
                </DropdownMenuCheckboxItem>
              ))}
              {selectedCategories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedCategories([])}>
                    Limpar filtro
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-40 justify-between"
                disabled={filterSubcategoryOptions.length === 0}
              >
                <span>
                  Subcategorias
                  {selectedSubcategories.length > 0
                    ? ` (${selectedSubcategories.length})`
                    : ""}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-72">
              <DropdownMenuLabel>Filtrar subcategorias</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterSubcategoryOptions.length === 0 ? (
                <DropdownMenuItem disabled>
                  Nenhuma subcategoria no período
                </DropdownMenuItem>
              ) : (
                filterSubcategoryOptions.map((name) => (
                  <DropdownMenuCheckboxItem
                    key={name}
                    checked={selectedSubcategories.includes(name)}
                    onCheckedChange={() =>
                      toggleFilterValue(
                        selectedSubcategories,
                        name,
                        setSelectedSubcategories,
                      )
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {name}
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {selectedSubcategories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedSubcategories([])}>
                    Limpar filtro
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {isFetching && !isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando fluxo…
          </div>
        ) : (
          <>
            <div
              className={`mb-6 grid grid-cols-2 gap-3 ${
                month === null ? "lg:grid-cols-5" : "lg:grid-cols-3"
              }`}
            >
              {month === null && (
                <Metric
                  label={`Restante de ${opening.previousYear}`}
                  value={formatBRL(openingBalance)}
                  icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
                />
              )}
              <Metric
                label="Entradas"
                value={formatBRL(periodTotals.income)}
                tone="text-emerald-600"
                icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
              />
              <Metric
                label="Saídas"
                value={formatBRL(periodTotals.expense)}
                tone="text-rose-600"
                icon={<TrendingDown className="h-4 w-4 text-rose-600" />}
              />
              <Metric
                label="Resultado"
                value={formatBRL(periodTotals.balance)}
                tone={periodTotals.balance < 0 ? "text-rose-600" : undefined}
                icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
              />
              {month === null && (
                <Metric
                  label={cashBalanceLabel}
                  value={formatBRL(cashBalanceValue)}
                  tone={cashBalanceValue < 0 ? "text-rose-600" : undefined}
                  icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
                />
              )}
            </div>

            {month === null && entriesByMonth ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={monthOrder}
                    onValueChange={(v) => setMonthOrder(v as "newest" | "oldest")}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Mais recentes primeiro</SelectItem>
                      <SelectItem value="oldest">Mais antigos primeiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setOpenMonths(new Set(entriesByMonth.map((g) => g.month)))
                    }
                  >
                    Expandir todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpenMonths(new Set())}>
                    Fechar todos
                  </Button>
                </div>

                {entriesByMonth.length === 0 ? (
                  <Empty
                    message={
                      entries.length > 0
                        ? "Nenhum lançamento com esses filtros."
                        : undefined
                    }
                    onClear={
                      entries.length > 0
                        ? () => {
                            setSelectedCategories([]);
                            setSelectedSubcategories([]);
                          }
                        : undefined
                    }
                  />
                ) : (
                  entriesByMonth.map((group) => {
                    const open = openMonths.has(group.month);
                    return (
                      <Card key={group.month} className="overflow-hidden rounded-[12px]">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          onClick={() => toggleMonth(group.month)}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                open ? "" : "-rotate-90"
                              }`}
                            />
                            <h3 className="text-sm font-semibold capitalize">
                              {monthName(group.month)} de {year}
                              <span className="ml-2 font-normal text-muted-foreground">
                                ({group.entries.length}{" "}
                                {group.entries.length === 1 ? "lançamento" : "lançamentos"})
                              </span>
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                            <span className="text-emerald-600">
                              Entradas {formatBRL(group.income)}
                            </span>
                            <span className="text-rose-600">
                              Saídas {formatBRL(group.expense)}
                            </span>
                          </div>
                        </button>
                        {open && <ReadOnlyTable entries={group.entries} />}
                      </Card>
                    );
                  })
                )}
              </div>
            ) : filteredEntries.length === 0 ? (
              <Empty
                message={
                  entries.length > 0
                    ? "Nenhum lançamento com esses filtros."
                    : undefined
                }
                onClear={
                  entries.length > 0
                    ? () => {
                        setSelectedCategories([]);
                        setSelectedSubcategories([]);
                      }
                    : undefined
                }
              />
            ) : (
              <Card className="overflow-hidden rounded-[12px]">
                <ReadOnlyTable entries={filteredEntries} />
              </Card>
            )}
          </>
        )}
      </Container>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-[12px] p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`text-base font-semibold sm:text-lg ${tone ?? ""}`}>{value}</div>
    </Card>
  );
}

function Empty({
  message,
  onClear,
}: {
  message?: string;
  onClear?: () => void;
}) {
  return (
    <Card className="rounded-[12px] p-10 text-center text-sm text-muted-foreground">
      <p>{message ?? "Nenhuma movimentação no período."}</p>
      {onClear ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
          Limpar filtros
        </Button>
      ) : null}
    </Card>
  );
}

function ReadOnlyTable({ entries }: { entries: PublicCashEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Data</th>
            <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
            <th className="px-4 py-2.5 text-left font-medium">Categoria</th>
            <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
            <th className="px-4 py-2.5 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-border last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDateBR(e.entry_date)}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 font-medium ${
                  e.kind === "entrada" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {e.kind === "entrada" ? "Entrada" : "Saída"}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{e.category}</div>
                {e.subcategory ? (
                  <div className="text-xs text-muted-foreground">{e.subcategory}</div>
                ) : null}
              </td>
              <td className="max-w-[280px] truncate px-4 py-3" title={e.description}>
                {e.description}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                  e.kind === "entrada" ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {e.kind === "entrada" ? "+" : "−"} {formatBRL(Number(e.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
