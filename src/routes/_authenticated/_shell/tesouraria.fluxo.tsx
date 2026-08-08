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
  Search,
  Settings2,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
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
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { formatBRL, formatDateBR } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
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
      { title: "Fluxo de Caixa — Templo Virtual" },
      { name: "description", content: "Entradas, saídas, importação e relatórios financeiros do capítulo." },
      { property: "og:title", content: "Fluxo de Caixa — Templo Virtual" },
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
  entry_date: todayYmd(),
});


function FluxoCaixa() {
  const { active } = useActiveChapter();
  const { can } = useChapterAccess();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
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
  const [search, setSearch] = useState("");
  const writable = can("tesouraria");

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
  const eventOptions = catData?.operationalEvents?.length
    ? catData.operationalEvents
    : (catData?.events ?? []);
  const legacySubs = catData?.subcategories ?? [];
  const eventFinanceItems = catData?.eventFinanceItems ?? [];
  const subcategories = [
    ...legacySubs,
    ...eventFinanceItems.map((i) => ({
      id: i.id,
      scope: "eventos" as const,
      calendar_event_id: i.event_id,
      name: i.name,
      active: i.active,
      unit_price: i.unit_price,
    })),
  ];

  const scope = scopeOfCategory(form.category);
  const scopedSubs = subcategories.filter(
    (s) =>
      scope === "eventos" &&
      s.scope === "eventos" &&
      s.calendar_event_id === form.eventId,
  );
  const eventsWithItems = useMemo(() => {
    const opts = [...eventOptions];
    if (form.eventId && !opts.some((e) => e.id === form.eventId)) {
      const fromEntry = entries.find(
        (e) =>
          e.event_id === form.eventId || e.calendar_event_id === form.eventId,
      );
      opts.push({
        id: form.eventId,
        title: fromEntry?.event_name ?? "Evento selecionado",
        start_at: fromEntry?.entry_date ?? "",
        status: "encerrado",
      } as (typeof eventOptions)[number]);
    }
    return opts;
  }, [eventOptions, form.eventId, entries]);
  const selectedEventItem = eventFinanceItems.find(
    (i) => i.id === form.subcategoryId,
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
   * (eventos). Hospitalaria não usa subcategorias na UI.
   */
  const filterSubcategoryOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries) {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) continue;
      if (e.category === "Eventos" && e.subcategory) names.add(e.subcategory);
    }
    for (const s of subcategories) {
      if (!s.name) continue;
      if (selectedCategories.length) {
        const matchesEventos =
          selectedCategories.includes("Eventos") && s.scope === "eventos";
        if (!matchesEventos) continue;
      }
      names.add(s.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entries, subcategories, selectedCategories]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dateFilter = q ? parseCashSearchDateFilter(q, year) : null;
    return entries.filter((e) => {
      if (selectedCategories.length && !selectedCategories.includes(e.category)) {
        return false;
      }
      if (selectedSubcategories.length) {
        if (!e.subcategory || !selectedSubcategories.includes(e.subcategory)) {
          return false;
        }
      }
      if (q) {
        if (dateFilter) {
          if (dateFilter.kind === "day" && e.entry_date === dateFilter.ymd) {
            return true;
          }
          if (
            dateFilter.kind === "range" &&
            e.entry_date >= dateFilter.from &&
            e.entry_date <= dateFilter.to
          ) {
            return true;
          }
        }
        const hay = [
          e.description,
          e.category,
          e.subcategory,
          e.kind,
          e.kind === "entrada" ? "entrada" : "saída saida",
          formatBRL(Number(e.amount)),
          String(e.amount),
          e.entry_date,
          formatDateBR(e.entry_date),
          formatCashSearchDateHints(e.entry_date),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, selectedCategories, selectedSubcategories, search, year]);

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
      selectedCategories.length > 0 ||
      selectedSubcategories.length > 0 ||
      search.trim().length > 0;
    // Sem filtro de categoria/busca: usar agregação completa do servidor
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
  }, [
    filteredEntries,
    selectedCategories.length,
    selectedSubcategories.length,
    search,
    data?.totals,
  ]);

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
  // ou quando nenhuma categoria com subcategorias está filtrada.
  const categoryFilterHasSubs = selectedCategories.some(
    (c) => scopeOfCategory(c) != null,
  );
  useEffect(() => {
    if (!categoryFilterHasSubs) {
      if (selectedSubcategories.length) setSelectedSubcategories([]);
      return;
    }
    if (!selectedSubcategories.length) return;
    const allowed = new Set(filterSubcategoryOptions);
    setSelectedSubcategories((prev) => {
      const next = prev.filter((s) => allowed.has(s));
      return next.length === prev.length ? prev : next;
    });
  }, [
    categoryFilterHasSubs,
    filterSubcategoryOptions,
    selectedSubcategories.length,
  ]);

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
        eventId: form.eventId || null,
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
    onMutate: async (id) => {
      const key = ["cash-entries", active?.chapter_id, year, month] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<typeof data>(key);

      if (previous) {
        const removed = previous.entries.find((e) => e.id === id);
        const nextEntries = previous.entries.filter((e) => e.id !== id);
        let nextBank = previous.bank;
        let nextTotals = previous.totals;
        if (removed) {
          const amt = Number(removed.amount) || 0;
          const isIn = removed.kind === "entrada";
          const isOut = removed.kind === "saida";
          if (previous.bank) {
            const income = Number(previous.bank.income) - (isIn ? amt : 0);
            const expense = Number(previous.bank.expense) - (isOut ? amt : 0);
            nextBank = { income, expense, balance: income - expense };
          }
          if (previous.totals) {
            const income = Number(previous.totals.income) - (isIn ? amt : 0);
            const expense = Number(previous.totals.expense) - (isOut ? amt : 0);
            nextTotals = { income, expense, balance: income - expense };
          }
        }
        qc.setQueryData(key, {
          ...previous,
          entries: nextEntries,
          bank: nextBank,
          totals: nextTotals,
        });
      }

      return { previous, key };
    },
    onError: (e: any, _id, ctx) => {
      if (ctx?.previous && ctx.key) {
        qc.setQueryData(ctx.key, ctx.previous);
      }
      toast.error(e?.message ?? "Erro ao excluir");
    },
    onSuccess: () => {
      toast.success(
        "Lançamento excluído — cobrança/mensalidade vinculada atualizada",
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["cash-entries"] });
      void qc.invalidateQueries({ queryKey: ["member-charges"] });
      void qc.invalidateQueries({ queryKey: ["charge-payments"] });
      void qc.invalidateQueries({ queryKey: ["dues"] });
      void qc.invalidateQueries({ queryKey: ["year-dues"] });
      void qc.invalidateQueries({ queryKey: ["member-finance"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-finance"] });
    },
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
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 pr-8"
              placeholder="Buscar descrição, categoria…"
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

          {categoryFilterHasSubs ? (
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
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => openShare.mutate()}
              disabled={openShare.isPending || !writable}
            >
              <Link2 className="mr-1.5 h-4 w-4" />
              {openShare.isPending ? "Abrindo…" : "Compartilhar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
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
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => exportPdf.mutate()}
              disabled={exportPdf.isPending}
            >
              <FileText className="mr-1.5 h-4 w-4" />
              {exportPdf.isPending ? "Gerando…" : "PDF"}
            </Button>
            {writable ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Importar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setCatsOpen(true)}
                >
                  <Settings2 className="mr-1.5 h-4 w-4" /> Categorias
                </Button>
              </>
            ) : null}
          </div>
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
          description="Ajuste a busca, categorias ou subcategorias para ver os lançamentos."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
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
                        eventId: e.event_id ?? e.calendar_event_id ?? "",
                        subcategoryId: e.event_finance_item_id ?? "",
                        description: e.description,
                        amount: String(e.amount),
                        entry_date: e.entry_date,
                      });
                      setEntryOpen(true);
                    }}
                    onDelete={async (id) => {
                      const e = group.entries.find((row) => row.id === id);
                      const ok = await confirm({
                        title: "Excluir lançamento?",
                        description: e
                          ? `Excluir “${e.description}” (${e.kind === "entrada" ? "+" : "−"} ${formatBRL(Number(e.amount))}) do fluxo de caixa?`
                          : "Excluir este lançamento do fluxo de caixa?",
                        confirmLabel: "Excluir",
                      });
                      if (ok) remove.mutate(id);
                    }}
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
                eventId: e.event_id ?? e.calendar_event_id ?? "",
                subcategoryId: e.event_finance_item_id ?? "",
                description: e.description,
                amount: String(e.amount),
                entry_date: e.entry_date,
              });
              setEntryOpen(true);
            }}
            onDelete={async (id) => {
              const e = sortedMonthEntries.find((row) => row.id === id);
              const ok = await confirm({
                title: "Excluir lançamento?",
                description: e
                  ? `Excluir “${e.description}” (${e.kind === "entrada" ? "+" : "−"} ${formatBRL(Number(e.amount))}) do fluxo de caixa?`
                  : "Excluir este lançamento do fluxo de caixa?",
                confirmLabel: "Excluir",
              });
              if (ok) remove.mutate(id);
            }}
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
                <SearchableSelect
                  value={form.eventId}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, eventId: v, subcategoryId: "" }))
                  }
                  placeholder="Selecione o evento"
                  searchPlaceholder="Buscar evento…"
                  emptyText="Nenhum evento encontrado."
                  options={eventsWithItems.map((e) => ({
                    value: e.id,
                    label: e.title,
                  }))}
                />
                {eventsWithItems.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhum evento ativo. Crie um evento em Eventos e cadastre
                    itens na aba Financeiro.
                  </p>
                )}
              </div>
            )}

            {scope && form.eventId && (
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-sm">Tipo de movimentação *</Label>
                <Select
                  value={form.subcategoryId}
                  onValueChange={(v) => {
                    const item = eventFinanceItems.find((i) => i.id === v);
                    setForm((f) => ({
                      ...f,
                      subcategoryId: v,
                      amount:
                        item?.unit_price != null && !f.amount
                          ? String(item.unit_price)
                          : item?.unit_price != null
                            ? String(item.unit_price)
                            : f.amount,
                    }));
                  }}
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
                {scope === "eventos" && selectedEventItem?.track_stock && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Este item controla estoque. Lançamentos manuais no Caixa não
                    baixam estoque — use a comanda do ingresso para isso.
                  </p>
                )}
              </div>
            )}

            {isManualDues && (
              <>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-sm">Membro *</Label>
                  <SearchableSelect
                    value={duesMemberId}
                    onChange={setDuesMemberId}
                    placeholder="Selecione o membro"
                    searchPlaceholder="Digite o nome…"
                    emptyText="Nenhum membro encontrado."
                    options={activeMembers.map((m) => ({
                      value: m.id,
                      label: m.full_name,
                    }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-sm">Competências *</Label>
                  <div className="mb-2 flex items-center gap-2">
                    <Select value={String(duesYear)} onValueChange={(v) => setDuesYear(Number(v))}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[year - 1, year].map((y) => (
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
      {dialog}
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
  const { confirm, dialog } = useConfirmDialog();
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
                onClick={async () => {
                  const ok = await confirm({
                    title: "Excluir categoria?",
                    description: `Excluir a categoria “${c.name}”?`,
                    confirmLabel: "Excluir",
                  });
                  if (ok) remove.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
      {dialog}
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
  /** Ordem de inserção (oculto na UI); desempate ao ordenar por data. */
  created_at?: string | null;
  event_id: string | null;
  event_finance_item_id: string | null;
  calendar_event_id: string | null;
  event_name?: string | null;
};

type CashSortKey = "entry_date" | "kind" | "category" | "description" | "amount";

const CASH_MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Interpreta busca de data ou intervalo (1.8 - 5.8) no ano do filtro. */
function parseCashSearchDateFilter(
  raw: string,
  year: number,
): { kind: "day"; ymd: string } | { kind: "range"; from: string; to: string } | null {
  const q = stripDiacritics(raw.trim().toLowerCase());
  if (!q) return null;

  const rangeParts = splitCashSearchDateRange(q);
  if (rangeParts) {
    const from = parseCashSearchDatePart(rangeParts[0], year);
    const to = parseCashSearchDatePart(rangeParts[1], year);
    if (from && to) {
      return from <= to
        ? { kind: "range", from, to }
        : { kind: "range", from: to, to: from };
    }
  }

  const ymd = parseCashSearchDatePart(q, year);
  return ymd ? { kind: "day", ymd } : null;
}

function splitCashSearchDateRange(q: string): [string, string] | null {
  const spaced = q.split(/\s+(?:-|–|—|a|ate|até)\s+/);
  if (spaced.length === 2 && spaced[0] && spaced[1]) {
    return [spaced[0].trim(), spaced[1].trim()];
  }

  // Compacto: 1.8-5.8 ou 1/8-5/8 (evita confundir com 1-8 como dia-mês)
  const compact = q.match(
    /^(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?)\s*[-–—]\s*(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?)$/,
  );
  if (compact) return [compact[1], compact[2]];

  const named = q.match(
    /^(\d{1,2}\s+de\s+[a-z]+)\s*[-–—]\s*(\d{1,2}\s+de\s+[a-z]+)$/,
  );
  if (named) return [named[1], named[2]];

  return null;
}

function parseCashSearchDatePart(raw: string, year: number): string | null {
  const q = stripDiacritics(raw.trim().toLowerCase());
  if (!q) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const toYmd = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1) return null;
    const dim = new Date(y, m, 0).getDate();
    if (d > dim) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  const slash = q.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    let y = year;
    if (slash[3]) {
      y = Number(slash[3]);
      if (slash[3].length === 2) y += y >= 70 ? 1900 : 2000;
    }
    return toYmd(y, m, d);
  }

  const named = q.match(/^(\d{1,2})\s+de\s+([a-z]+)$/);
  if (named) {
    const d = Number(named[1]);
    const monthIdx = CASH_MONTH_NAMES.findIndex(
      (name) => name === named[2] || name.startsWith(named[2]),
    );
    if (monthIdx >= 0) return toYmd(year, monthIdx + 1, d);
  }

  return null;
}

/** Formas alternativas da data para match parcial no haystack (ex.: 6/8). */
function formatCashSearchDateHints(entryDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entryDate);
  if (!m) return "";
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const monthName = CASH_MONTH_NAMES[month - 1] ?? "";
  return [
    `${day}/${month}`,
    `${day}/${month}/${y}`,
    `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
    `${day} de ${monthName}`,
    `${String(day).padStart(2, "0")} de ${monthName}`,
  ].join(" ");
}

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
    if (cmp === 0) {
      cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    }
    if (cmp === 0) {
      cmp = a.id.localeCompare(b.id);
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
                {(e.event_name || e.subcategory) && (
                  <div className="text-xs text-muted-foreground">
                    {e.event_name && e.subcategory
                      ? e.subcategory.includes(e.event_name)
                        ? e.subcategory
                        : `${e.event_name} · ${e.subcategory}`
                      : (e.event_name ?? e.subcategory)}
                  </div>
                )}
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
