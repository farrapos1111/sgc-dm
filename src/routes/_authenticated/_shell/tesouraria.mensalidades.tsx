import { createFileRoute } from "@tanstack/react-router";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { toast } from "sonner";
import {
  CheckCheck,
  ChevronDown,
  Copy,
  Link2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  UserMinus,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { can } from "@/lib/permissions";
import { chapterFoundedAt } from "@/lib/terms";
import { formatBRL, kindLabel, statusLabel } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
import {
  bulkYearDuesAction,
  includeMemberInYearDues,
  listDuesInclusionCandidates,
  listYearDues,
  removeMemberFromYearDues,
  upsertDue,
} from "@/lib/finance.functions";
import {
  ensureDuesShareToken,
  getDuesShareToken,
  revokeDuesShareToken,
} from "@/lib/dues-share.functions";
import {
  isDueOverdue,
  MONTH_LONG,
  MONTH_SHORT,
  autoDueExemptTip,
  isFutureMonth,
  getChapterDefaultDuesAmount,
  type DueMemberLite,
} from "@/lib/dues-rules";

export const Route = createFileRoute(
  "/_authenticated/_shell/tesouraria/mensalidades",
)({
  head: () => ({
    meta: [
      { title: "Mensalidades — SG-CDM" },
      {
        name: "description",
        content: "Calendário anual de mensalidades dos Demolays Ativos.",
      },
    ],
  }),
  component: Mensalidades,
});

type DueStatus = "em_aberto" | "pago" | "isento" | "desligado";

type DueRow = {
  id: string;
  member_id: string;
  amount: number | string;
  status: DueStatus;
  paid_at: string | null;
  competence_year: number;
  competence_month: number;
  cash_entry_id?: string | null;
};

type YearDuesData = {
  members: DueMemberLite[];
  dues: DueRow[];
  defaultAmount: number;
};

const DUES_STALE_MS = 60_000;

const STATUS_STYLE: Record<DueStatus, string> = {
  em_aberto:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  pago: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  isento: "bg-[#c8e0f7] text-sky-900 dark:bg-[#c8e0f7]/25 dark:text-sky-200",
  desligado:
    "bg-[#d3d3d3] text-stone-700 dark:bg-[#d3d3d3]/30 dark:text-stone-200",
};

const FUTURE_OPEN_STYLE =
  "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400";

const STATUS_LABEL: Record<DueStatus, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
  desligado: "Desligado",
};

const STATUS_DOT: Record<DueStatus, string> = {
  em_aberto: "bg-amber-400",
  pago: "bg-emerald-500",
  isento: "bg-slate-400",
  desligado: "bg-stone-500",
};

function cellClass(status: DueStatus, year: number, month: number) {
  if (status === "em_aberto" && isFutureMonth(year, month))
    return FUTURE_OPEN_STYLE;
  return STATUS_STYLE[status];
}

function cellLetter(status: DueStatus, overdue: boolean, future: boolean) {
  if (status === "pago") return "P";
  if (status === "isento") return "I";
  if (status === "desligado") return "D";
  if (future) return "·";
  if (overdue) return "A";
  return "O";
}

type SortKey = "name" | "open_count" | "open_total" | `month_${number}`;

function monthFromSortKey(key: SortKey): number | null {
  if (!key.startsWith("month_")) return null;
  const m = Number(key.slice(6));
  return m >= 1 && m <= 12 ? m : null;
}

/** Ordem: pago → atrasado → aberto → futuro → isento → desligado */
function monthStatusRank(
  status: DueStatus,
  year: number,
  month: number,
): number {
  if (status === "pago") return 0;
  if (status === "desligado") return 5;
  if (status === "isento") return 4;
  const future = isFutureMonth(year, month);
  if (future) return 3;
  if (isDueOverdue(year, month, status)) return 1;
  return 2;
}

function duesYearKey(chapterId: string, year: number) {
  return ["dues-year", chapterId, year] as const;
}

function patchDueInCache(
  prev: YearDuesData | undefined,
  patch: {
    memberId: string;
    month: number;
    year: number;
    status: DueStatus;
    amount: number;
    paidAt: string | null;
    id?: string;
  },
): YearDuesData | undefined {
  if (!prev) return prev;
  const idx = prev.dues.findIndex(
    (d) => d.member_id === patch.memberId && d.competence_month === patch.month,
  );
  const nextRow: DueRow = {
    id:
      patch.id ??
      (idx >= 0
        ? prev.dues[idx].id
        : `optimistic-${patch.memberId}-${patch.month}`),
    member_id: patch.memberId,
    amount: patch.amount,
    status: patch.status,
    paid_at: patch.paidAt,
    competence_year: patch.year,
    competence_month: patch.month,
    cash_entry_id: idx >= 0 ? prev.dues[idx].cash_entry_id : null,
  };
  if (idx >= 0) {
    const dues = prev.dues.slice();
    dues[idx] = { ...dues[idx], ...nextRow };
    return { ...prev, dues };
  }
  return { ...prev, dues: [...prev.dues, nextRow] };
}

type StatusCellProps = {
  member: DueMemberLite;
  month: number;
  year: number;
  status: DueStatus;
  defaultAmount: number;
  writable: boolean;
  compact?: boolean;
  onSetStatus: (v: {
    memberId: string;
    month: number;
    status: DueStatus;
  }) => void;
};

const StatusCell = memo(function StatusCell({
  member,
  month,
  year,
  status,
  defaultAmount,
  writable,
  compact = false,
  onSetStatus,
}: StatusCellProps) {
  const memberId = member.id;
  const memberName = member.full_name;
  const future = isFutureMonth(year, month);
  const overdue = !future && isDueOverdue(year, month, status);
  const exemptTip =
    status === "isento" ? autoDueExemptTip(member, year, month) : null;
  const label = exemptTip
    ? `${MONTH_LONG[month - 1]} — ${exemptTip}`
    : `${MONTH_LONG[month - 1]} — ${STATUS_LABEL[status]}${
        future && status === "em_aberto"
          ? " (futuro)"
          : overdue
            ? " (atrasado)"
            : ""
      }`;

  const button = compact ? (
    <button
      type="button"
      disabled={!writable}
      className={`w-full rounded-md px-1 py-2 text-center transition hover:ring-2 hover:ring-ring disabled:cursor-default ${cellClass(
        status,
        year,
        month,
      )} ${overdue ? "ring-1 ring-rose-500" : ""}`}
    >
      <div className="text-[10px] opacity-70">{MONTH_SHORT[month - 1]}</div>
      <div className="text-[10px] font-semibold uppercase">
        {future && status === "em_aberto"
          ? "Fut"
          : status === "desligado"
            ? "Des"
            : STATUS_LABEL[status].slice(0, 3)}
      </div>
    </button>
  ) : (
    <button
      type="button"
      disabled={!writable}
      className={`h-10 w-full rounded-md text-xs font-semibold uppercase tracking-wide transition hover:ring-2 hover:ring-ring disabled:cursor-default ${cellClass(
        status,
        year,
        month,
      )} ${overdue ? "ring-1 ring-rose-500" : ""}`}
    >
      {cellLetter(status, overdue, future && status === "em_aberto")}
    </button>
  );

  const withTip = (trigger: ReactElement) => {
    const tipTrigger = !writable ? (
      <span tabIndex={0} className="inline-block w-full">
        {trigger}
      </span>
    ) : (
      trigger
    );
    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>{tipTrigger}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-center">
          <p>{label}</p>
          {writable ? (
            <p className="mt-0.5 text-[10px] opacity-80">Clique para alterar</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    );
  };

  if (!writable) return withTip(button);

  return (
    <DropdownMenu>
      {withTip(<DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>)}
      <DropdownMenuContent align="center" className="w-44">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-xs font-medium">{memberName}</div>
          <div className="text-[11px] text-muted-foreground">
            {MONTH_LONG[month - 1]} · {formatBRL(defaultAmount)}
          </div>
          {exemptTip ? (
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {exemptTip}
            </div>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(["em_aberto", "pago", "isento", "desligado"] as DueStatus[]).map(
          (s) => (
            <DropdownMenuItem
              key={s}
              disabled={status === s}
              onSelect={() => onSetStatus({ memberId, month, status: s })}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-sm ${STATUS_DOT[s]}`}
              />
              {STATUS_LABEL[s]}
              {status === s ? " ✓" : ""}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

function Mensalidades() {
  const { active, refetch } = useActiveChapter();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [defaultAmount, setDefaultAmount] = useState(() =>
    getChapterDefaultDuesAmount(
      active?.chapter as { settings?: Record<string, unknown> } | undefined,
    ),
  );
  const [paidAt, setPaidAt] = useState(todayYmd());
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [skipCashEntry, setSkipCashEntry] = useState(false);
  const [includeOpen, setIncludeOpen] = useState(false);
  const [includeSearch, setIncludeSearch] = useState("");
  const writable = can(active?.role.name, "tesouraria");
  const ensuredYears = useRef(new Set<number>());
  const skipCashRef = useRef(skipCashEntry);
  skipCashRef.current = skipCashEntry;
  const paidAtRef = useRef(paidAt);
  paidAtRef.current = paidAt;
  const amountRef = useRef(defaultAmount);
  amountRef.current = defaultAmount;

  const availableYears = useMemo(() => {
    const founded = chapterFoundedAt(active?.chapter);
    const start = founded ? Number(founded.slice(0, 4)) : now.getFullYear() - 2;
    const years: number[] = [];
    for (let y = now.getFullYear() + 1; y >= start; y--) years.push(y);
    return years;
  }, [active?.chapter]);

  const chapterId = active?.chapter_id;

  useEffect(() => {
    ensuredYears.current.clear();
  }, [chapterId]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchDues,
  } = useQuery({
    queryKey: duesYearKey(chapterId ?? "", year),
    enabled: !!chapterId,
    staleTime: DUES_STALE_MS,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const ensure = !ensuredYears.current.has(year);
      const result = (await listYearDues({
        data: { chapterId: chapterId!, year, ensure },
      })) as YearDuesData;
      if (ensure) ensuredYears.current.add(year);
      return result;
    },
  });

  useEffect(() => {
    if (data?.defaultAmount != null)
      setDefaultAmount(Number(data.defaultAmount));
  }, [data?.defaultAmount]);

  // Prefetch anos vizinhos (sem ensure)
  useEffect(() => {
    if (!chapterId || !data) return;
    for (const y of [year - 1, year + 1]) {
      if (!availableYears.includes(y)) continue;
      void qc.prefetchQuery({
        queryKey: duesYearKey(chapterId, y),
        staleTime: DUES_STALE_MS,
        queryFn: async () => {
          const ensure = !ensuredYears.current.has(y);
          const result = (await listYearDues({
            data: { chapterId, year: y, ensure },
          })) as YearDuesData;
          if (ensure) ensuredYears.current.add(y);
          return result;
        },
      });
    }
  }, [chapterId, year, data, availableYears, qc]);

  const members = (data?.members ?? []) as DueMemberLite[];
  const dues = (data?.dues ?? []) as DueRow[];

  const dueMap = useMemo(() => {
    const map = new Map<string, DueRow>();
    for (const d of dues) {
      map.set(`${d.member_id}:${d.competence_month}`, d);
    }
    return map;
  }, [dues]);

  const openByMember = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const m of members) {
      let count = 0;
      let total = 0;
      for (let month = 1; month <= 12; month++) {
        if (isFutureMonth(year, month)) continue;
        const due = dueMap.get(`${m.id}:${month}`);
        const status = (due?.status as DueStatus) ?? "em_aberto";
        if (status !== "em_aberto") continue;
        count += 1;
        total += defaultAmount;
      }
      map.set(m.id, { count, total });
    }
    return map;
  }, [members, dueMap, year, defaultAmount]);

  const displayedMembers = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    let list = members;
    if (q) {
      list = list.filter((m) => m.full_name.toLowerCase().includes(q));
    }
    const mul = sortDir === "asc" ? 1 : -1;
    const sortMonth = monthFromSortKey(sortKey);
    return [...list].sort((a, b) => {
      if (sortMonth != null) {
        const sa =
          (dueMap.get(`${a.id}:${sortMonth}`)?.status as DueStatus) ??
          "em_aberto";
        const sb =
          (dueMap.get(`${b.id}:${sortMonth}`)?.status as DueStatus) ??
          "em_aberto";
        const cmp =
          monthStatusRank(sa, year, sortMonth) -
          monthStatusRank(sb, year, sortMonth);
        if (cmp !== 0) return cmp * mul;
        return a.full_name.localeCompare(b.full_name, "pt-BR");
      }
      if (sortKey === "name") {
        return (
          a.full_name.localeCompare(b.full_name, "pt-BR", {
            sensitivity: "base",
          }) * mul
        );
      }
      const oa = openByMember.get(a.id) ?? { count: 0, total: 0 };
      const ob = openByMember.get(b.id) ?? { count: 0, total: 0 };
      if (sortKey === "open_count") {
        const cmp = oa.count - ob.count;
        if (cmp !== 0) return cmp * mul;
        return a.full_name.localeCompare(b.full_name, "pt-BR");
      }
      const cmp = oa.total - ob.total;
      if (cmp !== 0) return cmp * mul;
      return a.full_name.localeCompare(b.full_name, "pt-BR");
    });
  }, [members, deferredSearch, sortKey, sortDir, openByMember, dueMap, year]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const totals = useMemo(() => {
    let paid = 0;
    let openAmount = 0;
    let overdue = 0;
    for (const d of dues) {
      if (d.status === "pago") paid += defaultAmount;
      else if (d.status === "em_aberto") {
        if (isFutureMonth(d.competence_year, d.competence_month)) continue;
        openAmount += defaultAmount;
        if (isDueOverdue(d.competence_year, d.competence_month, d.status)) {
          overdue += defaultAmount;
        }
      }
    }
    return { paid, openAmount, overdue };
  }, [dues, defaultAmount]);

  const openCount = useMemo(() => {
    let n = 0;
    for (const v of openByMember.values()) n += v.count;
    return n;
  }, [openByMember]);

  const softInvalidateCash = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["cash-entries"] });
  }, [qc]);

  const setStatus = useMutation({
    mutationFn: (v: { memberId: string; month: number; status: DueStatus }) =>
      upsertDue({
        data: {
          chapterId: chapterId!,
          memberId: v.memberId,
          year,
          month: v.month,
          amount: amountRef.current,
          status: v.status,
          paidAt: paidAtRef.current,
          skipCashEntry: v.status === "pago" ? skipCashRef.current : false,
        },
      }),
    onMutate: async (v) => {
      if (!chapterId) return;
      const key = duesYearKey(chapterId, year);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<YearDuesData>(key);
      const skip = v.status === "pago" ? skipCashRef.current : false;
      qc.setQueryData<YearDuesData>(key, (prev) =>
        patchDueInCache(prev, {
          memberId: v.memberId,
          month: v.month,
          year,
          status: v.status,
          amount: amountRef.current,
          paidAt: v.status === "pago" ? paidAtRef.current : null,
        }),
      );
      if (v.status === "pago") {
        toast.success(
          skip
            ? "Pago — sem lançamento no fluxo de caixa"
            : "Pago — lançado no fluxo de caixa",
        );
      } else if (v.status === "em_aberto") toast.message("Em aberto");
      else if (v.status === "desligado") toast.message("Desligado");
      else toast.message("Isento");
      return { previous, key };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.previous && ctx.key) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(e?.message ?? "Erro ao atualizar");
    },
    onSuccess: (row, v) => {
      if (!chapterId || !row) return;
      const key = duesYearKey(chapterId, year);
      qc.setQueryData<YearDuesData>(key, (prev) =>
        patchDueInCache(prev, {
          memberId: v.memberId,
          month: v.month,
          year,
          status: row.status as DueStatus,
          amount: Number(row.amount),
          paidAt: row.paid_at,
          id: row.id,
        }),
      );
    },
    onSettled: () => {
      softInvalidateCash();
    },
  });

  const onSetStatus = useCallback(
    (v: { memberId: string; month: number; status: DueStatus }) => {
      setStatus.mutate(v);
    },
    // mutate is stable; eslint may warn on setStatus — intentional
    [setStatus.mutate],
  );

  type BulkAction =
    "pay_all" | "pay_except_jan_dec" | "open_all" | "exempt_all";

  const bulkAction = useMutation({
    mutationFn: (action: BulkAction) =>
      bulkYearDuesAction({
        data: {
          chapterId: chapterId!,
          year,
          action,
          amount: amountRef.current,
          paidAt: paidAtRef.current,
          skipCashEntry: skipCashRef.current,
        },
      }),
    onMutate: async (action) => {
      if (!chapterId) return;
      const key = duesYearKey(chapterId, year);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<YearDuesData>(key);
      qc.setQueryData<YearDuesData>(key, (prev) => {
        if (!prev) return prev;
        const duesNext = prev.dues.map((d) => {
          if (action === "pay_all" || action === "pay_except_jan_dec") {
            if (d.status !== "em_aberto") return d;
            if (isFutureMonth(d.competence_year, d.competence_month)) return d;
            if (action === "pay_except_jan_dec" && d.competence_month === 1) {
              return d;
            }
            return {
              ...d,
              status: "pago" as DueStatus,
              paid_at: paidAtRef.current,
              amount: amountRef.current,
            };
          }
          if (action === "open_all") {
            return {
              ...d,
              status: "em_aberto" as DueStatus,
              paid_at: null,
              cash_entry_id: null,
            };
          }
          // exempt_all
          return {
            ...d,
            status: "isento" as DueStatus,
            paid_at: null,
            cash_entry_id: null,
          };
        });
        return { ...prev, dues: duesNext };
      });
      return { previous, key };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.previous && ctx.key) qc.setQueryData(ctx.key, ctx.previous);
      toast.error(e?.message ?? "Erro na ação em lote");
    },
    onSuccess: (r) => {
      const labels: Record<BulkAction, string> = {
        pay_all: "baixada(s)",
        pay_except_jan_dec: "baixada(s) (exceto janeiro)",
        open_all: "aberta(s)",
        exempt_all: "isentada(s)",
      };
      if (r.updated === 0) {
        toast.message("Nenhuma competência alterada");
      } else if (r.action === "pay_all" || r.action === "pay_except_jan_dec") {
        toast.success(
          skipCashRef.current
            ? `${r.updated} ${labels[r.action]} — sem lançamento no fluxo`
            : `${r.updated} ${labels[r.action]} — lançadas no fluxo de caixa`,
        );
      } else {
        toast.success(`${r.updated} ${labels[r.action]}`);
      }
      if (chapterId) {
        void qc.fetchQuery({
          queryKey: duesYearKey(chapterId, year),
          staleTime: 0,
          queryFn: async () =>
            (await listYearDues({
              data: { chapterId, year, ensure: false },
            })) as YearDuesData,
        });
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["cash-entries"] });
    },
  });

  function runBulk(action: BulkAction) {
    const msgs: Record<BulkAction, string> = {
      pay_all: skipCashEntry
        ? `Baixar ${openCount} em aberto sem registrar no fluxo de caixa?`
        : `Baixar ${openCount} em aberto e lançar no fluxo de caixa?`,
      pay_except_jan_dec: skipCashEntry
        ? "Baixar todas em aberto (exceto janeiro) sem fluxo de caixa?"
        : "Baixar todas em aberto (exceto janeiro) e lançar no fluxo?",
      open_all:
        "Reabrir TODAS as competências do ano (remove lançamentos de caixa vinculados)?",
      exempt_all:
        "Isentar TODAS as competências do ano (remove lançamentos de caixa vinculados)?",
    };
    if (!window.confirm(msgs[action])) return;
    bulkAction.mutate(action);
  }

  async function copyOpenList() {
    const rows = displayedMembers
      .map((m) => {
        const o = openByMember.get(m.id) ?? { count: 0, total: 0 };
        if (o.count <= 0) return null;
        const meses = o.count === 1 ? "1 mês" : `${o.count} meses`;
        return `${m.full_name} - ${meses} - ${formatBRL(o.total)}`;
      })
      .filter((line): line is string => Boolean(line));

    if (rows.length === 0) {
      toast.message("Nenhum membro com mensalidade em aberto na lista");
      return;
    }

    const now = new Date();
    const dateLabel = [
      String(now.getDate()).padStart(2, "0"),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getFullYear()),
    ].join("/");

    const text = [
      "Lista de Mensalidades em Aberto:",
      dateLabel,
      "",
      "*Nome - Meses - Total devido*",
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

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/mensalidades/${shareToken}`
    : "";

  const {
    data: includeData,
    isFetching: loadingCandidates,
    isError: candidatesError,
    error: candidatesErr,
  } = useQuery({
    queryKey: ["dues-include-candidates", chapterId, year],
    enabled: !!chapterId && includeOpen,
    queryFn: () =>
      listDuesInclusionCandidates({
        data: { chapterId: chapterId!, year },
      }) as Promise<{
        candidates: Array<{
          id: string;
          full_name: string;
          status: string;
          kind: string;
        }>;
        inTableCount: number;
        chapterMemberCount: number;
      }>,
  });

  const includeCandidates = includeData?.candidates ?? [];

  const filteredIncludeCandidates = useMemo(() => {
    const q = includeSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return includeCandidates.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.status ?? "").toLowerCase().includes(q) ||
        (m.kind ?? "").toLowerCase().includes(q),
    );
  }, [includeCandidates, includeSearch]);

  const includeEmptyHint = (() => {
    if (candidatesError) {
      return (
        (candidatesErr as Error)?.message ?? "Erro ao carregar candidatos."
      );
    }
    if (!includeData) return "Carregando…";
    if (includeData.chapterMemberCount === 0) {
      return "Nenhum membro cadastrado neste capítulo.";
    }
    if (includeCandidates.length === 0) {
      return "Todos os membros do capítulo já estão neste calendário.";
    }
    if (includeSearch.trim().length < 2) {
      return "Digite ao menos 2 letras do nome.";
    }
    return "Nenhum membro corresponde à busca.";
  })();

  const includeMember = useMutation({
    mutationFn: (memberId: string) =>
      includeMemberInYearDues({
        data: { chapterId: chapterId!, year, memberId },
      }),
    onSuccess: async () => {
      toast.success("Membro incluído no calendário");
      setIncludeOpen(false);
      setIncludeSearch("");
      ensuredYears.current.delete(year);
      await qc.invalidateQueries({ queryKey: duesYearKey(chapterId!, year) });
      await qc.invalidateQueries({ queryKey: ["dues-include-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao incluir"),
  });

  const removeManual = useMutation({
    mutationFn: (memberId: string) =>
      removeMemberFromYearDues({
        data: { chapterId: chapterId!, year, memberId },
      }),
    onSuccess: async () => {
      toast.success("Inclusão manual removida");
      await qc.invalidateQueries({ queryKey: duesYearKey(chapterId!, year) });
      await qc.invalidateQueries({ queryKey: ["dues-include-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const openShare = useMutation({
    mutationFn: async () => {
      const existing = await getDuesShareToken({
        data: { chapterId: chapterId! },
      });
      if (existing.token) return existing.token;
      const created = await ensureDuesShareToken({
        data: { chapterId: chapterId!, regenerate: false },
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
      ensureDuesShareToken({
        data: { chapterId: chapterId!, regenerate: true },
      }),
    onSuccess: (r) => {
      setShareToken(r.token);
      toast.success("Novo link gerado. O anterior deixou de funcionar.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao regenerar"),
  });

  const revokeShare = useMutation({
    mutationFn: () => revokeDuesShareToken({ data: { chapterId: chapterId! } }),
    onSuccess: () => {
      setShareToken(null);
      setShareOpen(false);
      toast.success("Link público revogado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao revogar"),
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

  const showLoading = isLoading && !data;

  return (
    <TooltipProvider delayDuration={250}>
      <div>
        <PageHeader
          title="Mensalidades"
          subtitle={`Calendário anual · valor único ${formatBRL(defaultAmount)}. Clique no mês para Em aberto, Pago, Isento ou Desligado.`}
          actions={
            writable ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void copyOpenList()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar lista
                </Button>
                <Button variant="outline" onClick={() => setIncludeOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Incluir membro
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openShare.mutate()}
                  disabled={openShare.isPending}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {openShare.isPending ? "Abrindo…" : "Compartilhar"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => void copyOpenList()}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar lista
              </Button>
            )
          }
        />

        {/* Desktop: ano, busca e ações de tesouraria */}
        <div className="mb-4 hidden flex-wrap items-end gap-2 lg:flex">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Ano
            </Label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
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
          </div>

          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Buscar
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 pr-8"
                placeholder="Nome do membro…"
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
          </div>

          {writable && (
            <>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Data do pagamento
                </Label>
                <Input
                  type="date"
                  className="w-44"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <label
                  htmlFor="skip-cash"
                  className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                >
                  <Switch
                    checked={skipCashEntry}
                    onCheckedChange={setSkipCashEntry}
                    id="skip-cash"
                  />
                  Sem fluxo de caixa
                </label>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" disabled={bulkAction.isPending}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    {bulkAction.isPending ? "Aplicando…" : "Ações em lote"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Mensalidades do ano</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={openCount === 0}
                    onSelect={() => runBulk("pay_all")}
                  >
                    Baixar todos ({openCount})
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => runBulk("pay_except_jan_dec")}
                  >
                    Baixar todos (exceto janeiro)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => runBulk("open_all")}>
                    Abrir todos
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => runBulk("exempt_all")}>
                    Isentar todos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {isFetching && data ? (
            <span className="mb-2.5 text-xs text-muted-foreground">
              Atualizando…
            </span>
          ) : null}
        </div>

        {/* Mobile: só pesquisa e ordenação */}
        <div className="mb-4 flex flex-col gap-2 lg:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 pr-8"
              placeholder="Pesquisar membro…"
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
            value={
              sortKey === "name" && sortDir === "asc"
                ? "name:asc"
                : sortKey === "name" && sortDir === "desc"
                  ? "name:desc"
                  : sortKey === "open_total" && sortDir === "desc"
                    ? "open_total:desc"
                    : "name:asc"
            }
            onValueChange={(v) => {
              if (v === "name:asc") {
                setSortKey("name");
                setSortDir("asc");
              } else if (v === "name:desc") {
                setSortKey("name");
                setSortDir("desc");
              } else {
                setSortKey("open_total");
                setSortDir("desc");
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name:asc">A–Z</SelectItem>
              <SelectItem value="name:desc">Z–A</SelectItem>
              <SelectItem value="open_total:desc">Maiores em aberto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Card className="rounded-[12px] p-5">
            <div className="text-sm text-muted-foreground">Recebido</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatBRL(totals.paid)}
            </div>
          </Card>
          <Card className="rounded-[12px] p-5">
            <div className="text-sm text-muted-foreground">Em aberto</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatBRL(totals.openAmount)}
            </div>
          </Card>
          <Card className="rounded-[12px] p-5">
            <div className="text-sm text-muted-foreground">
              Atrasado (após dia 15)
            </div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatBRL(totals.overdue)}
            </div>
          </Card>
        </div>

        {showLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : isError ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="Erro ao carregar mensalidades"
            description={
              (error as Error)?.message ??
              "Não foi possível carregar o calendário."
            }
            action={
              <Button
                variant="outline"
                onClick={() => {
                  ensuredYears.current.delete(year);
                  void refetchDues();
                }}
              >
                Tentar de novo
              </Button>
            }
          />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title="Nenhum membro neste ano"
            description="Entram Demolays regulares iniciados até o ano e que ainda não eram Senior no início dele. Use “Incluir membro” para seniors fora da regra, irregulares ou maçons."
            action={
              writable ? (
                <Button type="button" onClick={() => setIncludeOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Incluir membro
                </Button>
              ) : undefined
            }
          />
        ) : displayedMembers.length === 0 ? (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="Nenhum membro encontrado"
            description="Ajuste o termo de busca."
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Limpar busca
              </Button>
            }
          />
        ) : (
          <>
            <Card className="hidden overflow-hidden rounded-[12px] lg:block">
              <div className="w-full">
                <table className="w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    {Array.from({ length: 12 }, (_, i) => (
                      <col key={i} className="w-[5.5%]" />
                    ))}
                    <col className="w-[7%]" />
                    <col className="w-[9%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 hover:text-foreground ${
                            sortKey === "name"
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => toggleSort("name")}
                        >
                          Membro
                          <span className="text-[10px] opacity-70">
                            {sortKey === "name"
                              ? sortDir === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                      {MONTH_SHORT.map((label, i) => {
                        const month = i + 1;
                        const key = `month_${month}` as SortKey;
                        const activeSort = sortKey === key;
                        return (
                          <th
                            key={label}
                            className="px-1 py-3 text-center text-xs font-medium"
                          >
                            <button
                              type="button"
                              title={`Ordenar por ${MONTH_LONG[i]}`}
                              className={`inline-flex items-center justify-center gap-0.5 hover:text-foreground ${
                                activeSort
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                              onClick={() => toggleSort(key)}
                            >
                              {label}
                              <span className="text-[9px] opacity-70">
                                {activeSort
                                  ? sortDir === "asc"
                                    ? "↑"
                                    : "↓"
                                  : "↕"}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 text-center text-xs font-medium">
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center gap-1 hover:text-foreground ${
                            sortKey === "open_count"
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => toggleSort("open_count")}
                        >
                          Abertos
                          <span className="text-[10px] opacity-70">
                            {sortKey === "open_count"
                              ? sortDir === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium">
                        <button
                          type="button"
                          className={`ml-auto inline-flex items-center gap-1 hover:text-foreground ${
                            sortKey === "open_total"
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => toggleSort("open_total")}
                        >
                          Total em aberto
                          <span className="text-[10px] opacity-70">
                            {sortKey === "open_total"
                              ? sortDir === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMembers.map((m) => {
                      const open = openByMember.get(m.id) ?? {
                        count: 0,
                        total: 0,
                      };
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <td
                            className="truncate px-4 py-2.5 font-medium"
                            title={m.full_name}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{m.full_name}</span>
                              {m.manualInclude ? (
                                <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground">
                                  manual
                                </span>
                              ) : null}
                              {writable && m.manualInclude ? (
                                <button
                                  type="button"
                                  title="Remover inclusão manual"
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                                  disabled={removeManual.isPending}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Remover ${m.full_name} deste calendário? As competências de ${year} serão apagadas (lançamentos no fluxo de caixa, se houver, permanecem).`,
                                      )
                                    )
                                      return;
                                    removeManual.mutate(m.id);
                                  }}
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = i + 1;
                            const status =
                              (dueMap.get(`${m.id}:${month}`)
                                ?.status as DueStatus) ?? "em_aberto";
                            return (
                              <td
                                key={month}
                                className="px-1.5 py-2 text-center"
                              >
                                <StatusCell
                                  member={m}
                                  month={month}
                                  year={year}
                                  status={status}
                                  defaultAmount={defaultAmount}
                                  writable={writable}
                                  onSetStatus={onSetStatus}
                                />
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-center tabular-nums font-semibold">
                            {open.count}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                            {formatBRL(open.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-emerald-100 text-emerald-800">
                    P
                  </span>
                  Pago
                </span>
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-amber-100 text-amber-800">
                    O
                  </span>
                  Em aberto
                </span>
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-amber-100 text-amber-800 ring-1 ring-rose-500">
                    A
                  </span>
                  Atrasado
                </span>
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-zinc-100 text-zinc-500">
                    ·
                  </span>
                  Futuro
                </span>
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-[#c8e0f7] text-sky-900">
                    I
                  </span>
                  Isento
                </span>
                <span>
                  <span className="mr-1 inline-block rounded px-1.5 py-0.5 font-semibold uppercase bg-[#d3d3d3] text-stone-700">
                    D
                  </span>
                  Desligado
                </span>
              </div>
            </Card>

            <div className="space-y-3 lg:hidden">
              {displayedMembers.map((m) => {
                const open = openByMember.get(m.id) ?? { count: 0, total: 0 };
                return (
                  <Card key={m.id} className="rounded-[12px] p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{m.full_name}</div>
                        {m.manualInclude ? (
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              Inclusão manual
                            </span>
                            {writable ? (
                              <button
                                type="button"
                                className="text-[10px] text-destructive underline"
                                disabled={removeManual.isPending}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Remover ${m.full_name} deste calendário? As competências de ${year} serão apagadas (lançamentos no fluxo de caixa, se houver, permanecem).`,
                                    )
                                  )
                                    return;
                                  removeManual.mutate(m.id);
                                }}
                              >
                                Remover
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className="text-muted-foreground">
                          {open.count} abertos
                        </div>
                        <div className="font-semibold text-amber-700 dark:text-amber-400">
                          {formatBRL(open.total)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1;
                        const status =
                          (dueMap.get(`${m.id}:${month}`)
                            ?.status as DueStatus) ?? "em_aberto";
                        return (
                          <StatusCell
                            key={month}
                            member={m}
                            month={month}
                            year={year}
                            status={status}
                            defaultAmount={defaultAmount}
                            writable={writable}
                            compact
                            onSetStatus={onSetStatus}
                          />
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        <Dialog
          open={includeOpen}
          onOpenChange={(o) => {
            setIncludeOpen(o);
            if (!o) setIncludeSearch("");
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Incluir membro em {year}</DialogTitle>
              <DialogDescription>
                Busque pelo nome e clique no membro para incluir — inclusive
                irregulares, seniors fora da regra e maçons. Gera os 12 meses
                com status automático.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-sm">Buscar</Label>
                <Input
                  autoFocus
                  placeholder="Digite o nome do membro…"
                  value={includeSearch}
                  onChange={(e) => setIncludeSearch(e.target.value)}
                />
              </div>
              <div>
                {loadingCandidates ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : filteredIncludeCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {includeEmptyHint}
                  </p>
                ) : (
                  <ul className="max-h-72 divide-y divide-border overflow-auto rounded-md border border-border">
                    {filteredIncludeCandidates.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                          disabled={includeMember.isPending}
                          onClick={() => includeMember.mutate(m.id)}
                        >
                          <span className="font-medium text-foreground">
                            {m.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {statusLabel(m.status)} · {kindLabel(m.kind)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIncludeOpen(false)}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Link público de mensalidades</DialogTitle>
              <DialogDescription>
                Qualquer pessoa com o link pode ver o calendário anual (somente
                leitura), com busca e ordenação — sem login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>URL compartilhável</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyShareLink()}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Regenerar invalida o link atual. O anterior deixa de funcionar.
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
      </div>
    </TooltipProvider>
  );
}
