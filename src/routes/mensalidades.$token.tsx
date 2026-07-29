import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import { Loader2, Receipt, Search, X } from "lucide-react";
import { getPublicYearDues } from "@/lib/dues-share.functions";
import {
  isDueOverdue,
  MONTH_LONG,
  MONTH_SHORT,
  type DueMemberLite,
} from "@/lib/dues-rules";
import { formatBRL } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/mensalidades/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mensalidades — SG-CDM" },
      {
        name: "description",
        content: "Visualização pública do calendário de mensalidades.",
      },
    ],
  }),
  component: PublicMensalidadesPage,
});

type DueStatus = "em_aberto" | "pago" | "isento" | "desligado";
type SortKey = "name" | "open_count" | "open_total" | `month_${number}`;

const STATUS_STYLE: Record<DueStatus, string> = {
  em_aberto: "bg-amber-100 text-amber-800",
  pago: "bg-emerald-100 text-emerald-800",
  isento: "bg-slate-100 text-slate-600",
  desligado: "bg-stone-200 text-stone-700",
};
const FUTURE_OPEN_STYLE = "bg-zinc-100 text-zinc-500";

function isFutureMonth(year: number, month: number, today = new Date()) {
  const cy = today.getFullYear();
  const cm = today.getMonth() + 1;
  if (year > cy) return true;
  if (year < cy) return false;
  return month > cm;
}

function cellClass(status: DueStatus, year: number, month: number) {
  if (status === "em_aberto" && isFutureMonth(year, month)) return FUTURE_OPEN_STYLE;
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

function monthFromSortKey(key: SortKey): number | null {
  if (!key.startsWith("month_")) return null;
  const m = Number(key.slice(6));
  return m >= 1 && m <= 12 ? m : null;
}

function monthStatusRank(status: DueStatus, year: number, month: number) {
  if (status === "pago") return 0;
  if (status === "desligado") return 5;
  if (status === "isento") return 4;
  if (isFutureMonth(year, month)) return 3;
  if (isDueOverdue(year, month, status)) return 1;
  return 2;
}

function PublicMensalidadesPage() {
  const { token } = Route.useParams();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["public-year-dues", token, year],
    queryFn: () => getPublicYearDues({ data: { token, year } }),
    retry: false,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const chapter = data?.chapter;
  const defaultAmount = data?.defaultAmount ?? 50;
  const members = (data?.members ?? []) as DueMemberLite[];
  const dues = data?.dues ?? [];

  const availableYears = useMemo(() => {
    const founded = chapter?.founded_at;
    const start = founded ? Number(founded.slice(0, 4)) : now.getFullYear() - 2;
    const years: number[] = [];
    for (let y = now.getFullYear() + 1; y >= start; y--) years.push(y);
    return years;
  }, [chapter?.founded_at]);

  const dueMap = useMemo(() => {
    const map = new Map<string, (typeof dues)[number]>();
    for (const d of dues) map.set(`${d.member_id}:${d.competence_month}`, d);
    return map;
  }, [dues]);

  const openByMember = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const m of members) {
      let count = 0;
      let total = 0;
      for (let month = 1; month <= 12; month++) {
        if (isFutureMonth(year, month)) continue;
        const status = (dueMap.get(`${m.id}:${month}`)?.status as DueStatus) ?? "em_aberto";
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
    if (q) list = list.filter((m) => m.full_name.toLowerCase().includes(q));
    const mul = sortDir === "asc" ? 1 : -1;
    const sortMonth = monthFromSortKey(sortKey);
    return [...list].sort((a, b) => {
      if (sortMonth != null) {
        const sa = (dueMap.get(`${a.id}:${sortMonth}`)?.status as DueStatus) ?? "em_aberto";
        const sb = (dueMap.get(`${b.id}:${sortMonth}`)?.status as DueStatus) ?? "em_aberto";
        const cmp =
          monthStatusRank(sa, year, sortMonth) - monthStatusRank(sb, year, sortMonth);
        if (cmp !== 0) return cmp * mul;
        return a.full_name.localeCompare(b.full_name, "pt-BR");
      }
      if (sortKey === "name") {
        return a.full_name.localeCompare(b.full_name, "pt-BR", { sensitivity: "base" }) * mul;
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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
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

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error).message ||
              "Este link de mensalidades é inválido ou foi revogado."}
          </p>
        </Card>
      </div>
    );
  }

  const accent = chapter?.primary_color || "#9E1B32";

  return (
    <div className="min-h-svh bg-background">
      <header
        className="border-b border-border px-4 py-5 sm:px-6"
        style={{ borderTop: `3px solid ${accent}` }}
      >
        <div className="mx-auto max-w-[1680px]">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mensalidades · visualização pública
          </p>
          <h1 className="text-xl font-semibold sm:text-2xl">
            {chapter
              ? `${chapter.name} nº ${chapter.number}`
              : isLoading
                ? "Carregando…"
                : "Mensalidades"}
          </h1>
          {chapter?.city ? (
            <p className="text-sm text-muted-foreground">{chapter.city}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            Valor padrão {formatBRL(defaultAmount)} · somente leitura
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Ano</p>
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
          </div>
          <div className="min-w-[200px] flex-1 sm:max-w-xs">
            <p className="mb-1.5 text-xs text-muted-foreground">Buscar</p>
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
          {isFetching && !isLoading ? (
            <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
          </div>
        ) : members.length === 0 ? (
          <Card className="rounded-[12px] p-10 text-center text-sm text-muted-foreground">
            <Receipt className="mx-auto mb-2 h-7 w-7" />
            Nenhum membro elegível neste ano.
          </Card>
        ) : displayedMembers.length === 0 ? (
          <Card className="rounded-[12px] p-10 text-center text-sm text-muted-foreground">
            Nenhum membro encontrado.
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                Limpar busca
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Card className="rounded-[12px] p-5">
                <div className="text-sm text-muted-foreground">Recebido</div>
                <div className="text-xl font-bold text-emerald-600">{formatBRL(totals.paid)}</div>
              </Card>
              <Card className="rounded-[12px] p-5">
                <div className="text-sm text-muted-foreground">Em aberto</div>
                <div className="text-xl font-bold text-amber-600">{formatBRL(totals.openAmount)}</div>
              </Card>
              <Card className="rounded-[12px] p-5">
                <div className="text-sm text-muted-foreground">Atrasado</div>
                <div className="text-xl font-bold text-rose-600">{formatBRL(totals.overdue)}</div>
              </Card>
            </div>

            <Card className="hidden overflow-hidden rounded-[12px] lg:block">
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
                        className={`inline-flex items-center gap-1 ${
                          sortKey === "name" ? "text-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => toggleSort("name")}
                      >
                        Membro
                        <span className="text-[10px] opacity-70">
                          {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    {MONTH_SHORT.map((label, i) => {
                      const key = `month_${i + 1}` as SortKey;
                      const activeSort = sortKey === key;
                      return (
                        <th key={label} className="px-1 py-3 text-center text-xs font-medium">
                          <button
                            type="button"
                            className={`inline-flex items-center gap-0.5 ${
                              activeSort ? "text-foreground" : "text-muted-foreground"
                            }`}
                            onClick={() => toggleSort(key)}
                          >
                            {label}
                            <span className="text-[9px] opacity-70">
                              {activeSort ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-center text-xs">
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 ${
                          sortKey === "open_count" ? "text-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => toggleSort("open_count")}
                      >
                        Abertos
                        <span className="text-[10px] opacity-70">
                          {sortKey === "open_count" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right text-xs">
                      <button
                        type="button"
                        className={`ml-auto inline-flex items-center gap-1 ${
                          sortKey === "open_total" ? "text-foreground" : "text-muted-foreground"
                        }`}
                        onClick={() => toggleSort("open_total")}
                      >
                        Total em aberto
                        <span className="text-[10px] opacity-70">
                          {sortKey === "open_total" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMembers.map((m) => {
                    const open = openByMember.get(m.id) ?? { count: 0, total: 0 };
                    return (
                      <tr key={m.id} className="border-b border-border last:border-b-0">
                        <td className="truncate px-4 py-2.5 font-medium" title={m.full_name}>
                          {m.full_name}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const month = i + 1;
                          const status =
                            (dueMap.get(`${m.id}:${month}`)?.status as DueStatus) ??
                            "em_aberto";
                          const future = isFutureMonth(year, month);
                          const overdue = !future && isDueOverdue(year, month, status);
                          return (
                            <td key={month} className="px-1.5 py-2 text-center">
                              <div
                                title={`${MONTH_LONG[i]} — ${status}`}
                                className={`flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold uppercase ${cellClass(
                                  status,
                                  year,
                                  month,
                                )} ${overdue ? "ring-1 ring-rose-500" : ""}`}
                              >
                                {cellLetter(status, overdue, future && status === "em_aberto")}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold">
                          {open.count}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-700">
                          {formatBRL(open.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span>P Pago</span>
                <span>O Em aberto</span>
                <span>A Atrasado</span>
                <span>· Futuro</span>
                <span>I Isento</span>
                <span>D Desligado</span>
              </div>
            </Card>

            <div className="space-y-3 lg:hidden">
              {displayedMembers.map((m) => {
                const open = openByMember.get(m.id) ?? { count: 0, total: 0 };
                return (
                  <Card key={m.id} className="rounded-[12px] p-3">
                    <div className="mb-2 flex justify-between gap-2">
                      <div className="text-sm font-medium">{m.full_name}</div>
                      <div className="text-right text-xs">
                        <div className="text-muted-foreground">{open.count} abertos</div>
                        <div className="font-semibold text-amber-700">{formatBRL(open.total)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1;
                        const status =
                          (dueMap.get(`${m.id}:${month}`)?.status as DueStatus) ??
                          "em_aberto";
                        const future = isFutureMonth(year, month);
                        const overdue = !future && isDueOverdue(year, month, status);
                        return (
                          <div
                            key={month}
                            className={`rounded-md px-1 py-2 text-center ${cellClass(
                              status,
                              year,
                              month,
                            )} ${overdue ? "ring-1 ring-rose-500" : ""}`}
                          >
                            <div className="text-[10px] opacity-70">{MONTH_SHORT[i]}</div>
                            <div className="text-[10px] font-semibold uppercase">
                              {future && status === "em_aberto"
                                ? "Fut"
                                : status === "pago"
                                  ? "Pag"
                                  : status === "isento"
                                    ? "Ise"
                                    : status === "desligado"
                                      ? "Des"
                                      : "Abe"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
