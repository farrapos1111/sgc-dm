import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
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
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { can } from "@/lib/permissions";
import { formatBRL, formatDateBR } from "@/lib/format";
import { chapterFoundedAt } from "@/lib/terms";
import {
  createCashEntry,
  createManualDuesEntry,
  deleteCashCategory,
  deleteCashEntry,
  getFinanceSigners,
  importCashEntries,
  listActiveMembers,
  listCashCategories,
  listCashEntries,
  updateCashEntry,
  upsertCashCategory,
} from "@/lib/finance.functions";
import {
  FIXED_CATEGORIES,
  duesDescription,
  scopeOfCategory,
} from "@/lib/cash-categories";

import { downloadCashTemplate, exportCashXlsx, parseCashSheet, type ParsedRow } from "@/lib/finance-xlsx";
import { exportCashPdf } from "@/lib/finance-pdf";
import {
  ensureCashShareToken,
  getCashShareToken,
  revokeCashShareToken,
} from "@/lib/cash-share.functions";

export const Route = createFileRoute("/_authenticated/_shell/tesouraria/fluxo")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — SG-CDM" },
      { name: "description", content: "Entradas, saídas, importação e relatórios financeiros do capítulo." },
      { property: "og:title", content: "Fluxo de Caixa — SG-CDM" },
      { property: "og:description", content: "Controle financeiro mensal do capítulo DeMolay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FluxoCaixa,
});

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const monthName = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

type EntryForm = {
  id?: string;
  kind: "entrada" | "saida";
  category: string;
  eventId: string;
  subcategoryId: string;
  description: string;
  amount: string;
  entry_date: string;
};

const emptyForm = (): EntryForm => ({
  kind: "entrada",
  category: "Outras",
  eventId: "",
  subcategoryId: "",
  description: "",
  amount: "",
  entry_date: new Date().toISOString().slice(0, 10),
});


function FluxoCaixa() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    const founded = chapterFoundedAt(active?.chapter);
    const startYear = founded ? Number(founded.slice(0, 4)) : currentYear - 2;
    const years: number[] = [];
    for (let y = currentYear; y >= startYear; y--) years.push(y);
    return years;
  }, [active?.chapter]);
  const [month, setMonth] = useState<number | null>(null);
  const [monthOrder, setMonthOrder] = useState<"newest" | "oldest">("newest");
  const [openMonths, setOpenMonths] = useState<Set<number>>(
    () => new Set([now.getMonth() + 1]),
  );
  const [sortKey, setSortKey] = useState<CashSortKey>("entry_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const writable = can(active?.role.name, "tesouraria");

  const [form, setForm] = useState<EntryForm>(emptyForm());
  const [entryOpen, setEntryOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ParsedRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cash-entries", active?.chapter_id, year, month],
    enabled: !!active,
    queryFn: () => listCashEntries({ data: { chapterId: active!.chapter_id, year, month } }),
  });

  const entries = data?.entries ?? [];
  const opening = data?.opening ?? { balance: 0, previousYear: year - 1 };
  const openingBalance = Number(opening.balance) || 0;
  const bank = data?.bank ?? { income: 0, expense: 0, balance: 0 };
  const currentCashBalance = Number(bank.balance) || 0;

  const { data: catData } = useQuery({
    queryKey: ["cash-categories", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listCashCategories({ data: { chapterId: active!.chapter_id } }),
  });
  const categories = catData?.categories ?? [];
  const eventOptions = catData?.events ?? [];
  const subcategories = catData?.subcategories ?? [];

  const scope = scopeOfCategory(form.category);
  const scopedSubs = subcategories.filter((s) =>
    scope === "eventos"
      ? s.scope === "eventos" && s.calendar_event_id === form.eventId
      : s.scope === scope,
  );
  const eventsWithItems = eventOptions.filter((e) =>
    subcategories.some((s) => s.scope === "eventos" && s.calendar_event_id === e.id),
  );
  const isManualDues = form.category === "Mensalidades" && !form.id;

  const categoryNames = useMemo(() => {
    const names = new Set<string>(FIXED_CATEGORIES);
    for (const c of categories) names.add(c.name);
    if (form.category) names.add(form.category);
    return [...names];
  }, [categories, form.category]);

  /** Categorias disponíveis no filtro (config + lançamentos do período). */
  const filterCategoryOptions = useMemo(() => {
    const names = new Set<string>(FIXED_CATEGORIES);
    for (const c of categories) names.add(c.name);
    for (const e of entries) {
      if (e.category) names.add(e.category);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, entries]);

  /**
   * Subcategorias para filtro: nomes presentes nos lançamentos + configuradas
   * (eventos/hospitalaria). Pronto para quando subcategorias por evento forem mais usadas.
   */
  const filterSubcategoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries) {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) continue;
      if (e.subcategory) names.add(e.subcategory);
    }
    for (const s of subcategories) {
      if (!s.name) continue;
      // Escopos dinâmicos ligados a categorias conhecidas
      if (selectedCategories.length) {
        const matchesEventos =
          selectedCategories.includes("Eventos") && s.scope === "eventos";
        const matchesHosp =
          selectedCategories.includes("Hospitalaria") && s.scope === "hospitalaria";
        if (!matchesEventos && !matchesHosp) continue;
      }
      names.add(s.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, subcategories, selectedCategories]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) {
        return false;
      }
      if (selectedSubcategories.length) {
        if (!e.subcategory || !selectedSubcategories.includes(e.subcategory)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, selectedCategories, selectedSubcategories]);

  // Lançamento manual de mensalidade (uma ou várias competências).
  const [duesMemberId, setDuesMemberId] = useState("");
  const [duesYear, setDuesYear] = useState(now.getFullYear());
  const [duesMonths, setDuesMonths] = useState<string[]>([]);

  const { data: activeMembers = [] } = useQuery({
    queryKey: ["cash-active-members", active?.chapter_id],
    enabled: !!active && isManualDues,
    queryFn: () => listActiveMembers({ data: { chapterId: active!.chapter_id } }),
  });

  const duesCompetences = useMemo(
    () =>
      duesMonths
        .map((k) => {
          const [y, m] = k.split("-").map(Number);
          return { year: y, month: m };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month),
    [duesMonths],
  );

  const duesPreview = duesMemberId && duesCompetences.length
    ? duesDescription(
        activeMembers.find((m) => m.id === duesMemberId)?.full_name ?? "",
        duesCompetences,
      )
    : "";



  const periodTotals = useMemo(() => {
    const hasClientFilters =
      selectedCategories.length > 0 || selectedSubcategories.length > 0;
    // Sem filtro de categoria: usar agregação completa do servidor
    // (evita totais incompletos quando a lista de lançamentos é limitada).
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

  const periodLabel = month ? `${monthName(month)} de ${year}` : `Ano de ${year}`;

  const isPastYear = year < now.getFullYear();
  const periodClosingBalance = openingBalance + periodTotals.balance;
  const cashBalanceValue = isPastYear ? periodClosingBalance : currentCashBalance;
  const cashBalanceLabel = isPastYear ? "Saldo final do caixa" : "Saldo Atual do Caixa";
  const cashBalanceHint = isPastYear
    ? `Restante ${opening.previousYear} + período`
    : "Soma de todos os lançamentos";

  const entriesByMonth = useMemo(() => {
    if (month !== null) return null;
    const groups = new Map<number, typeof filteredEntries>();
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
        return {
          month: m,
          entries: sortCashEntries(list, sortKey, sortDir),
          income,
          expense,
        };
      });
  }, [filteredEntries, month, monthOrder, sortKey, sortDir]);

  const sortedMonthEntries = useMemo(
    () => (month !== null ? sortCashEntries(filteredEntries, sortKey, sortDir) : filteredEntries),
    [filteredEntries, month, sortKey, sortDir],
  );

  // Remove subcategorias selecionadas que deixaram de existir nas opções
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

  // Em Geral: por padrão só o mês atual do ano presente fica aberto; demais fechados.
  const openMonthsPeriodRef = useRef<string>("");
  useEffect(() => {
    if (month !== null) return;
    if (isLoading) return;
    const periodKey = `${active?.chapter_id ?? ""}:${year}`;
    if (openMonthsPeriodRef.current === periodKey) return;
    openMonthsPeriodRef.current = periodKey;

    const today = new Date();
    if (year === today.getFullYear()) {
      setOpenMonths(new Set([today.getMonth() + 1]));
    } else {
      setOpenMonths(new Set());
    }
  }, [year, month, active?.chapter_id, isLoading]);

  function toggleMonth(m: number) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function expandAllMonths() {
    if (!entriesByMonth) return;
    setOpenMonths(new Set(entriesByMonth.map((g) => g.month)));
  }

  function collapseAllMonths() {
    setOpenMonths(new Set());
  }

  function toggleSort(key: CashSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "entry_date" || key === "amount" ? "desc" : "asc");
    }
  }

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["cash-entries"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (isManualDues) {
        return createManualDuesEntry({
          data: {
            chapterId: active!.chapter_id,
            memberId: duesMemberId,
            competences: duesCompetences,
            amount: Number(String(form.amount).replace(",", ".")) || 0,
            entry_date: form.entry_date,
          },
        });
      }
      const payload = {
        kind: form.kind,
        category: form.category,
        subcategoryId: form.subcategoryId || null,
        description: form.description.trim(),
        amount: Number(String(form.amount).replace(",", ".")) || 0,
        entry_date: form.entry_date,
      };
      if (form.id) return updateCashEntry({ data: { id: form.id, ...payload } });
      return createCashEntry({ data: { chapterId: active!.chapter_id, ...payload } });
    },

    onSuccess: async () => {
      toast.success(form.id ? "Lançamento atualizado" : "Lançamento registrado");
      setEntryOpen(false);
      setForm(emptyForm());
      setDuesMemberId("");
      setDuesMonths([]);
      await invalidate();
      await qc.invalidateQueries({ queryKey: ["dues"] });
    },

    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCashEntry({ data: { id } }),
    onSuccess: async () => {
      toast.success("Lançamento excluído — cobrança/mensalidade vinculada atualizada");
      await invalidate();
      await qc.invalidateQueries({ queryKey: ["member-charges"] });
      await qc.invalidateQueries({ queryKey: ["charge-payments"] });
      await qc.invalidateQueries({ queryKey: ["dues"] });
      await qc.invalidateQueries({ queryKey: ["year-dues"] });
      await qc.invalidateQueries({ queryKey: ["member-finance"] });
      await qc.invalidateQueries({ queryKey: ["dashboard-finance"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const runImport = useMutation({
    mutationFn: () => {
      const valid = (importRows ?? []).filter((r) => !r.error);
      return importCashEntries({
        data: {
          chapterId: active!.chapter_id,
          rows: valid.map(({ line, error, ...r }) => r),
        },
      });
    },
    onSuccess: async (r) => {
      toast.success(`${r.imported} lançamentos importados`);
      setImportRows(null);
      await invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar"),
  });

  const exportPdf = useMutation({
    mutationFn: async () => {
      const signers = await getFinanceSigners({ data: { chapterId: active!.chapter_id } });
      await exportCashPdf({
        chapterName: `${active!.chapter.name} nº ${active!.chapter.number}`,
        chapterCity: active!.chapter.city,
        logoPath: (active!.chapter as any).logo_url ?? null,
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
        signers,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar PDF"),
  });

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/fluxo-caixa/${shareToken}`
    : "";

  const openShare = useMutation({
    mutationFn: async () => {
      const existing = await getCashShareToken({ data: { chapterId: active!.chapter_id } });
      if (existing.token) return existing.token;
      const created = await ensureCashShareToken({
        data: { chapterId: active!.chapter_id, regenerate: false },
      });
      return created.token;
    },
    onSuccess: (token) => {
      setShareToken(token);
      setShareOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar link"),
  });

  const regenerateShare = useMutation({
    mutationFn: () =>
      ensureCashShareToken({ data: { chapterId: active!.chapter_id, regenerate: true } }),
    onSuccess: (r) => {
      setShareToken(r.token);
      toast.success("Novo link gerado. O anterior deixou de funcionar.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao regenerar link"),
  });

  const revokeShare = useMutation({
    mutationFn: () => revokeCashShareToken({ data: { chapterId: active!.chapter_id } }),
    onSuccess: () => {
      setShareToken(null);
      setShareOpen(false);
      toast.success("Link público revogado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao revogar link"),
  });

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function handleFile(file: File) {
    try {
      const rows = await parseCashSheet(file);
      if (rows.length === 0) {
        toast.error("A planilha está vazia");
        return;
      }
      setImportRows(rows);
    } catch {
      toast.error("Não foi possível ler a planilha");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Entradas, saídas e relatórios financeiros do capítulo."
        actions={
          writable ? (
            <Button
              onClick={() => {
                setForm(emptyForm());
                setEntryOpen(true);
              }}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo lançamento
            </Button>
          ) : null
        }
      />

      {/* Filtros e ações */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={month === null ? "all" : String(month)}
          onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}
        >
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Geral (todos)</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={String(m)}>{monthName(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-36 justify-between">
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
                    toggleFilterValue(selectedSubcategories, name, setSelectedSubcategories)
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

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => openShare.mutate()}
            disabled={openShare.isPending || !writable}
          >
            <Link2 className="mr-2 h-4 w-4" />
            {openShare.isPending ? "Abrindo…" : "Compartilhar"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
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
              )
            }
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={() => exportPdf.mutate()} disabled={exportPdf.isPending}>
            <FileText className="mr-2 h-4 w-4" /> {exportPdf.isPending ? "Gerando…" : "PDF"}
          </Button>
          {writable && (
            <>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" onClick={() => setCatsOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" /> Categorias
              </Button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      </div>

      {/* Indicadores */}
      <div
        className={`mb-6 grid grid-cols-2 gap-4 ${
          month === null ? "lg:grid-cols-5" : "lg:grid-cols-3"
        }`}
      >
        {month === null && (
          <MetricCard
            label={`Restante de ${opening.previousYear}`}
            value={formatBRL(openingBalance)}
            hint="Caixa transferido do ano anterior"
            icon={<Landmark className="h-5 w-5 text-muted-foreground" />}
          />
        )}
        <MetricCard
          label="Total de entradas"
          value={formatBRL(periodTotals.income)}
          tone="text-emerald-600 dark:text-emerald-400"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          label="Total de saídas"
          value={formatBRL(periodTotals.expense)}
          tone="text-rose-600 dark:text-rose-400"
          icon={<TrendingDown className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
        />
        <MetricCard
          label="Resultado do período"
          value={formatBRL(periodTotals.balance)}
          hint={periodLabel}
          tone={periodTotals.balance < 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          icon={<Wallet className="h-5 w-5 text-muted-foreground" />}
        />
        {month === null && (
          <MetricCard
            label={cashBalanceLabel}
            value={formatBRL(cashBalanceValue)}
            hint={cashBalanceHint}
            tone={cashBalanceValue < 0 ? "text-rose-600 dark:text-rose-400" : undefined}
            icon={<Landmark className="h-5 w-5 text-muted-foreground" />}
          />
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhum lançamento no período"
          description="Registre entradas e saídas ou importe uma planilha para acompanhar o caixa."
          action={
            writable ? (
              <Button
                onClick={() => {
                  setForm(emptyForm());
                  setEntryOpen(true);
                }}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                Fazer primeiro lançamento
              </Button>
            ) : undefined
          }
        />
      ) : filteredEntries.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhum lançamento com esses filtros"
          description="Ajuste as categorias ou subcategorias selecionadas para ver os lançamentos."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCategories([]);
                setSelectedSubcategories([]);
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : month === null && entriesByMonth ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={monthOrder}
              onValueChange={(v) => setMonthOrder(v as "newest" | "oldest")}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Meses: mais recentes</SelectItem>
                <SelectItem value="oldest">Meses: mais antigos</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={expandAllMonths}>
              Expandir todos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={collapseAllMonths}>
              Fechar todos
            </Button>
          </div>
          {entriesByMonth.map((group) => {
            const open = openMonths.has(group.month);
            return (
              <Card key={group.month} className="overflow-hidden rounded-[12px]">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => toggleMonth(group.month)}
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        open ? "rotate-0" : "-rotate-90"
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
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Entradas {formatBRL(group.income)}
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      Saídas {formatBRL(group.expense)}
                    </span>
                  </div>
                </button>
                {open && (
                  <CashEntriesTable
                    entries={group.entries}
                    writable={writable}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    onEdit={(e) => {
                      setForm({
                        id: e.id,
                        kind: e.kind,
                        category: e.category,
                        eventId: "",
                        subcategoryId: "",
                        description: e.description,
                        amount: String(e.amount),
                        entry_date: e.entry_date,
                      });
                      setEntryOpen(true);
                    }}
                    onDelete={(id) => remove.mutate(id)}
                  />
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden rounded-[12px]">
          <CashEntriesTable
            entries={sortedMonthEntries}
            writable={writable}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            onEdit={(e) => {
              setForm({
                id: e.id,
                kind: e.kind,
                category: e.category,
                eventId: "",
                subcategoryId: "",
                description: e.description,
                amount: String(e.amount),
                entry_date: e.entry_date,
              });
              setEntryOpen(true);
            }}
            onDelete={(id) => remove.mutate(id)}
          />
        </Card>
      )}

      {/* Dialog: lançamento */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
            <DialogDescription>Movimentação do caixa do capítulo.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as "entrada" | "saida" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v, eventId: "", subcategoryId: "" }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Categorias</SelectLabel>
                    {categoryNames.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {scope === "eventos" && (
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-sm">Evento *</Label>
                <Select
                  value={form.eventId}
                  onValueChange={(v) => setForm((f) => ({ ...f, eventId: v, subcategoryId: "" }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                  <SelectContent>
                    {eventsWithItems.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventsWithItems.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum evento configurado pela Comissão de Eventos. Configure em
                    “Categorias e itens”.
                  </p>
                )}
              </div>
            )}

            {scope && (scope === "hospitalaria" || form.eventId) && (
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-sm">
                  {scope === "eventos" ? "Tipo de movimentação *" : "Item da hospitalaria *"}
                </Label>
                <Select
                  value={form.subcategoryId}
                  onValueChange={(v) => setForm((f) => ({ ...f, subcategoryId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {scopedSubs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scopedSubs.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A comissão ainda não liberou itens para esta categoria.
                  </p>
                )}
              </div>
            )}

            {isManualDues && (
              <>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-sm">Membro *</Label>
                  <Select value={duesMemberId} onValueChange={setDuesMemberId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o membro" /></SelectTrigger>
                    <SelectContent>
                      {activeMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-sm">Competências *</Label>
                  <div className="mb-2 flex items-center gap-2">
                    <Select value={String(duesYear)} onValueChange={(v) => setDuesYear(Number(v))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[year - 1, year, year + 1].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      Selecione um ou mais meses
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((m) => {
                      const key = `${duesYear}-${m}`;
                      const on = duesMonths.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setDuesMonths((prev) =>
                              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                            on
                              ? "border-transparent text-white"
                              : "border-border text-muted-foreground"
                          }`}
                          style={on ? { backgroundColor: active?.chapter.primary_color } : undefined}
                        >
                          {monthName(m).slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Descrição *</Label>
              <Input
                value={isManualDues ? duesPreview : form.description}
                disabled={isManualDues}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex.: Compra de insumos para a hospitalaria"
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
              <Label className="mb-1.5 block text-sm">Data</Label>
              <Input
                type="date"
                value={form.entry_date}
                onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEntryOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !form.entry_date ||
                (isManualDues
                  ? !duesMemberId || duesCompetences.length === 0
                  : !form.description.trim() || (!!scope && !form.subcategoryId))
              }
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Dialog: revisão da importação */}
      <Dialog open={!!importRows} onOpenChange={(o) => !o && setImportRows(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar importação</DialogTitle>
            <DialogDescription>
              Confira as linhas antes de confirmar. Linhas com erro são ignoradas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto rounded-[10px] border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(importRows ?? []).map((r) => (
                  <tr key={r.line} className={`border-t border-border ${r.error ? "bg-destructive/10" : ""}`}>
                    <td className="px-3 py-2">{r.entry_date ? formatDateBR(r.entry_date) : "—"}</td>
                    <td className="px-3 py-2">{r.kind === "entrada" ? "Entrada" : "Saída"}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">
                      {r.description || "—"}
                      {r.error && (
                        <div className="text-xs text-destructive">Linha {r.line}: {r.error}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{formatBRL(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={downloadCashTemplate} className="sm:mr-auto">
              <Download className="mr-2 h-4 w-4" /> Baixar modelo
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setImportRows(null)}>Cancelar</Button>
              <Button
                onClick={() => runImport.mutate()}
                disabled={runImport.isPending || !(importRows ?? []).some((r) => !r.error)}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                {runImport.isPending
                  ? "Importando…"
                  : `Importar ${(importRows ?? []).filter((r) => !r.error).length}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link público do fluxo de caixa</DialogTitle>
            <DialogDescription>
              Qualquer pessoa com o link pode visualizar e exportar (PDF/Excel) o fluxo,
              sem login. Quem tiver o link vê todos os lançamentos do período escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>URL compartilhável</Label>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => void copyShareLink()}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Regenerar invalida o link atual. Revogar remove o acesso público.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => revokeShare.mutate()}
              disabled={revokeShare.isPending}
            >
              Revogar link
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => regenerateShare.mutate()}
                disabled={regenerateShare.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerar
              </Button>
              <Button type="button" onClick={() => void copyShareLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoriesDialog open={catsOpen} onOpenChange={setCatsOpen} />
    </div>
  );
}

function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["cash-categories", active?.chapter_id],
    enabled: !!active && open,
    queryFn: () => listCashCategories({ data: { chapterId: active!.chapter_id } }),
  });
  const categories = data?.categories ?? [];

  const save = useMutation({
    mutationFn: () =>
      upsertCashCategory({
        data: {
          chapterId: active!.chapter_id,
          id: editing?.id,
          name: editing ? editing.name.trim() : name.trim(),
          sort_order: 100,
        },
      }),
    onSuccess: async () => {
      toast.success("Categoria salva");
      setName("");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["cash-categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar categoria"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCashCategory({ data: { id } }),
    onSuccess: async () => {
      toast.success("Categoria excluída");
      await qc.invalidateQueries({ queryKey: ["cash-categories"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir categoria"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorias do fluxo de caixa</DialogTitle>
          <DialogDescription>
            Categorias padrão do capítulo. Subcategorias de eventos são geradas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria"
            value={editing ? editing.name : name}
            onChange={(e) =>
              editing
                ? setEditing({ ...editing, name: e.target.value })
                : setName(e.target.value)
            }
          />
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !(editing ? editing.name.trim() : name.trim())}
            style={{ backgroundColor: active?.chapter.primary_color }}
          >
            {editing ? "Atualizar" : "Adicionar"}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          )}
        </div>

        <div className="max-h-[40vh] divide-y divide-border overflow-auto rounded-[10px] border border-border">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 text-sm">{c.name}</span>
              {c.is_system && <Badge variant="secondary" className="text-xs">padrão</Badge>}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Renomear categoria"
                onClick={() => setEditing({ id: c.id, name: c.name })}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir categoria"
                onClick={() => remove.mutate(c.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CashEntryRow = {
  id: string;
  kind: "entrada" | "saida";
  category: string;
  subcategory: string | null;
  description: string;
  amount: number | string;
  entry_date: string;
};

type CashSortKey = "entry_date" | "kind" | "category" | "description" | "amount";

function sortCashEntries(
  list: CashEntryRow[],
  key: CashSortKey,
  dir: "asc" | "desc",
): CashEntryRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "entry_date":
        cmp = a.entry_date.localeCompare(b.entry_date);
        break;
      case "kind":
        cmp = a.kind.localeCompare(b.kind);
        break;
      case "category":
        cmp = `${a.category} ${a.subcategory ?? ""}`.localeCompare(
          `${b.category} ${b.subcategory ?? ""}`,
          "pt-BR",
          { sensitivity: "base" },
        );
        break;
      case "description":
        cmp = a.description.localeCompare(b.description, "pt-BR", { sensitivity: "base" });
        break;
      case "amount":
        cmp = Number(a.amount) - Number(b.amount);
        break;
    }
    return cmp * mul;
  });
}

function CashEntriesTable({
  entries,
  writable,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: {
  entries: CashEntryRow[];
  writable: boolean;
  sortKey: CashSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: CashSortKey) => void;
  onEdit: (e: CashEntryRow) => void;
  onDelete: (id: string) => void;
}) {
  function SortHeader({
    label,
    column,
    align = "left",
  }: {
    label: string;
    column: CashSortKey;
    align?: "left" | "right";
  }) {
    const active = sortKey === column;
    return (
      <th className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 hover:text-foreground ${
            active ? "text-foreground" : "text-muted-foreground"
          } ${align === "right" ? "flex-row-reverse" : ""}`}
          onClick={() => onSort(column)}
        >
          {label}
          <span className="text-[10px] opacity-70">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs">
            <SortHeader label="Data" column="entry_date" />
            <SortHeader label="Tipo" column="kind" />
            <SortHeader label="Categoria" column="category" />
            <SortHeader label="Descrição" column="description" />
            <SortHeader label="Valor" column="amount" align="right" />
            {writable && <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Ações</th>}
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
                  e.kind === "entrada"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
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
                  e.kind === "entrada"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {e.kind === "entrada" ? "+" : "−"} {formatBRL(Number(e.amount))}
              </td>
              {writable && (
                <td className="px-2 py-2 text-right">
                  <div className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar lançamento"
                      onClick={() => onEdit(e)}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir lançamento"
                      onClick={() => onDelete(e.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  hint,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`text-xl font-bold ${tone ?? ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
