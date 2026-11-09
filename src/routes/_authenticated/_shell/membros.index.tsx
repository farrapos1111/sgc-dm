import { createFileRoute, Link } from "@tanstack/react-router";
import { getRealmForOrgType } from "@/lib/realm";
import { FdjMembersList } from "@/components/fdj/FdjMembers";
import { keepPreviousData, useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listMembers } from "@/lib/members.functions";
import { listChapterPositions } from "@/lib/organization.functions";
import { membersListKey } from "@/lib/query-keys";
import { currentTerm } from "@/lib/terms";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Plus, Search, Users, X, Inbox } from "lucide-react";
import { initialsOf } from "@/components/shell/ShellNav";
import { formatDateBR, statusLabel, kindLabel, grauOf, isAptoGrauDemolay, ageFrom } from "@/lib/format";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { countPendingMemberRequests } from "@/lib/member-change-requests.functions";

export const Route = createFileRoute("/_authenticated/_shell/membros/")({
  head: () => ({ meta: [{ title: "Membros — Templo Virtual" }] }),
  component: MembrosList,
});

type StatusFilter = "all" | "regular" | "irregular";
type KindFilter = "all" | "demolay_ativo" | "senior" | "macom";
type MemberFilter = "todos" | "sem_cargo" | "sem_exame_dm" | "apto_gd";

type MembrosFilters = {
  q: string;
  status: StatusFilter;
  kind: KindFilter;
  filtro: MemberFilter;
};

const DEFAULT_FILTERS: MembrosFilters = {
  q: "",
  status: "all",
  kind: "all",
  filtro: "todos",
};

const STATUS_VALUES = new Set<string>(["all", "regular", "irregular"]);
const KIND_VALUES = new Set<string>(["all", "demolay_ativo", "senior", "macom"]);
const FILTRO_VALUES = new Set<string>(["todos", "sem_cargo", "sem_exame_dm", "apto_gd"]);

function filtersKey(chapterId: string) {
  return `sgcdm:membros-filters:${chapterId}`;
}

function loadFilters(chapterId: string): MembrosFilters {
  try {
    const raw = sessionStorage.getItem(filtersKey(chapterId));
    if (!raw) return { ...DEFAULT_FILTERS };
    const parsed = JSON.parse(raw) as Partial<MembrosFilters>;
    return {
      q: typeof parsed.q === "string" ? parsed.q : "",
      status: STATUS_VALUES.has(parsed.status ?? "") ? (parsed.status as StatusFilter) : "all",
      kind: KIND_VALUES.has(parsed.kind ?? "") ? (parsed.kind as KindFilter) : "all",
      filtro: FILTRO_VALUES.has(parsed.filtro ?? "") ? (parsed.filtro as MemberFilter) : "todos",
    };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function saveFilters(chapterId: string, filters: MembrosFilters) {
  try {
    sessionStorage.setItem(filtersKey(chapterId), JSON.stringify(filters));
  } catch {
    /* ignore quota / private mode */
  }
}

const MEMBER_FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sem_cargo", label: "DeMolays sem cargo" },
  { value: "sem_exame_dm", label: "Sem exame de Grau DeMolay" },
  { value: "apto_gd", label: "Aptos a receber o Grau DeMolay" },
];

const membersQO = (chapterId: string, search: string, status: StatusFilter, kind: KindFilter) =>
  queryOptions({
    queryKey: membersListKey(chapterId, search, status, kind),
    queryFn: () => listMembers({ data: { chapterId, search, status, kind } }),
  });

type ActiveChapter = NonNullable<ReturnType<typeof useActiveChapter>["active"]>;

// Hooks só no filho: o capítulo ativo pode estar nulo no primeiro render.
function MembrosList() {
  const { active } = useActiveChapter();
  if (!active) return null;
  // Bethel (FDJ) usa fichas próprias em fdj_members.
  if (getRealmForOrgType(active.chapter.org_type) === "fdj") {
    return <FdjMembersList key={active.chapter_id} chapterId={active.chapter_id} />;
  }
  return <MembrosListContent key={active.chapter_id} active={active} />;
}

function MembrosListContent({ active }: { active: ActiveChapter }) {
  const { can, canScreen } = useChapterAccess();

  const chapterId = active.chapter_id;
  const [filters, setFilters] = useState<MembrosFilters>(() => loadFilters(chapterId));
  const [searchInput, setSearchInput] = useState(() => loadFilters(chapterId).q);
  const term = currentTerm();

  // Capítulos diferentes: recarrega filtros salvos
  useEffect(() => {
    const next = loadFilters(chapterId);
    setFilters(next);
    setSearchInput(next.q);
  }, [chapterId]);

  useEffect(() => {
    saveFilters(chapterId, filters);
  }, [chapterId, filters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput }));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const { data: members = [], isPending, isFetching } = useQuery({
    ...membersQO(chapterId, filters.q, filters.status, filters.kind),
    placeholderData: keepPreviousData,
  });

  const needsPositions = filters.filtro === "sem_cargo";
  const { data: positions = [] } = useQuery({
    queryKey: ["chapter-positions", chapterId, term.year, term.semester],
    queryFn: () =>
      listChapterPositions({
        data: { chapterId, year: term.year, semester: term.semester },
      }),
    enabled: needsPositions,
  });

  const memberIdsWithCargo = useMemo(
    () => new Set(positions.map((p) => p.member_id)),
    [positions],
  );

  const isDemolayAtivoRegular = (m: { status: string; kind?: string | null }) =>
    m.status === "regular" && m.kind === "demolay_ativo";

  const filteredMembers = useMemo(() => {
    switch (filters.filtro) {
      case "sem_cargo":
        return members.filter((m) => isDemolayAtivoRegular(m) && !memberIdsWithCargo.has(m.id));
      case "sem_exame_dm":
        return members.filter((m) => isDemolayAtivoRegular(m) && !m.exam_grau_demolay);
      case "apto_gd":
        return members.filter((m) => isDemolayAtivoRegular(m) && isAptoGrauDemolay(m));
      default:
        return members;
    }
  }, [filters.filtro, members, memberIdsWithCargo]);

  const isAdmin =
    canScreen("membros", "edit") ||
    can("secretaria") ||
    can("conselho") ||
    can("admin");

  const { data: pendingReq } = useQuery({
    queryKey: ["member-change-requests-count", chapterId],
    queryFn: () =>
      countPendingMemberRequests({ data: { originChapterId: chapterId } }),
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  function clearSearch() {
    setSearchInput("");
    setFilters((f) => ({ ...f, q: "" }));
  }

  if (isPending && members.length === 0) {
    return <PageSkeleton />;
  }

  const chips: { key: string; label: string; on: boolean; pick: () => void }[] = [
    {
      key: "todos",
      label: "Todos",
      on: filters.kind === "all" && filters.status === "all",
      pick: () => setFilters((f) => ({ ...f, kind: "all", status: "all" })),
    },
    ...(["demolay_ativo", "senior", "macom"] as const).map((k) => ({
      key: k,
      label: kindLabel(k),
      on: filters.kind === k && filters.status === "all",
      pick: () => setFilters((f) => ({ ...f, kind: k, status: "all" })),
    })),
    {
      key: "irregulares",
      label: "Irregulares",
      on: filters.status === "irregular" && filters.kind === "all",
      pick: () => setFilters((f) => ({ ...f, kind: "all", status: "irregular" })),
    },
  ];
  const pendingCount = pendingReq?.count ?? 0;

  return (
    <div className={isFetching ? "opacity-80 transition-opacity" : undefined}>
      <PageHeader
        eyebrow="Secretaria"
        title="Membros"
        subtitle={`${filteredMembers.length} ${filteredMembers.length === 1 ? "membro" : "membros"}${
          filters.kind !== "all" || filters.status !== "all" || filters.filtro !== "todos" || filters.q
            ? " neste filtro"
            : ` cadastrados no ${active.chapter.name}`
        }`}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" asChild className="hidden sm:inline-flex">
                <Link to="/membros/solicitacoes">
                  <Inbox className="h-[18px] w-[18px]" />
                  Solicitações
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-tv-warn-bg px-2 py-0.5 text-xs font-bold text-tv-warn">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              </Button>
            )}
            <Button asChild className="flex-1 sm:flex-none">
              <Link to="/membros/novo">
                <Plus className="h-[18px] w-[18px]" /> Novo membro
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <label className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-tv-border bg-tv-surface px-3.5 lg:min-h-[46px] lg:max-w-[420px] lg:flex-1 lg:rounded-[12px]">
          <Search className="h-5 w-5 shrink-0 text-tv-text-2" />
          <span className="sr-only">Buscar membro</span>
          <input
            type="search"
            placeholder="Buscar por nome"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#6B6E75] lg:text-[15px]"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              aria-label="Limpar busca"
              className="grid h-8 w-8 place-items-center rounded-full text-tv-text-2 hover:bg-tv-bg"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.pick}
              aria-pressed={c.on}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                c.on
                  ? "border-tv-primary bg-tv-primary text-white"
                  : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text"
              }`}
            >
              {c.label}
            </button>
          ))}
          {isAdmin && (
            <Select
              value={filters.filtro}
              onValueChange={(v) => setFilters((f) => ({ ...f, filtro: v as MemberFilter }))}
            >
              <SelectTrigger
                className={`min-h-10 w-auto shrink-0 gap-2 rounded-full px-3.5 text-sm font-semibold ${
                  filters.filtro !== "todos" ? "border-tv-primary bg-tv-soft text-tv-ink" : ""
                }`}
              >
                <SelectValue placeholder="Mais filtros" />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.value === "todos" ? "Mais filtros" : f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isAdmin && pendingCount > 0 && (
        <Link
          to="/membros/solicitacoes"
          className="mt-3 flex items-center gap-3 rounded-2xl bg-tv-soft p-3.5 text-tv-ink sm:hidden"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tv-surface">
            <Inbox className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">
              {pendingCount} {pendingCount === 1 ? "solicitação aguardando" : "solicitações aguardando"}
            </span>
            <span className="block text-[13px]">Cadastros e alterações para aprovar</span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}

      {filteredMembers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="Nenhum membro encontrado"
            description={
              filters.filtro !== "todos" || filters.kind !== "all" || filters.status !== "all" || filters.q
                ? "Nenhum membro corresponde a esta busca ou filtro."
                : "Cadastre o primeiro membro do capítulo."
            }
            action={
              filters.filtro === "todos" && !filters.q ? (
                <Button asChild>
                  <Link to="/membros/novo">
                    <Plus className="h-[18px] w-[18px]" /> Cadastrar membro
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Celular: lista */}
          <ul className="mt-4 overflow-hidden rounded-[20px] bg-tv-surface lg:hidden">
            {filteredMembers.map((m) => {
              const kind = (m as { kind?: string }).kind;
              return (
                <li key={m.id} className="border-b border-tv-line last:border-0">
                  <Link
                    to="/membros/$id"
                    params={{ id: m.id }}
                    className="flex min-h-14 items-center gap-3 px-3.5 py-3"
                  >
                    <Avatar name={m.full_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold">{m.full_name}</span>
                      <span className="block text-[13px] text-tv-text-2">{kindLabel(kind)}</span>
                    </span>
                    <StatusChip status={m.status} />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop: tabela */}
          <div className="mt-4 hidden overflow-x-auto rounded-[20px] bg-tv-surface lg:block">
            <div className="min-w-[760px] text-[15px]">
              <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_110px_120px] gap-3 border-b border-[#EEEEEA] px-5 py-3.5 text-[13px] font-semibold text-tv-text-2 dark:border-tv-line">
                <span>Membro</span>
                <span>Tipo</span>
                <span>Grau</span>
                <span>Situação</span>
                <span className="text-right">Ações</span>
              </div>
              {filteredMembers.map((m) => {
                const grau = grauOf(m);
                const kind = (m as { kind?: string }).kind;
                const showGrau = kind !== "senior" && kind !== "macom";
                const age = ageFrom(m.birth_date);
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_110px_120px] items-center gap-3 border-b border-[#F3F3EF] px-5 py-2.5 last:border-0 dark:border-tv-line"
                  >
                    <Link to="/membros/$id" params={{ id: m.id }} className="flex min-w-0 items-center gap-3">
                      <Avatar name={m.full_name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{m.full_name}</span>
                        <span className="block truncate text-[13px] text-tv-text-2">
                          {[m.email, age !== null ? `${age} anos` : null].filter(Boolean).join(" · ") ||
                            (m.birth_date ? `Nasc. ${formatDateBR(m.birth_date)}` : "—")}
                        </span>
                      </span>
                    </Link>
                    <span className="text-[#3F4249] dark:text-tv-text-2">{kindLabel(kind)}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[#3F4249] dark:text-tv-text-2">
                      {showGrau ? grau.label.replace(/^(DM|GI) — /, "") : kind === "macom" ? "Tio Maçom" : "DeMolay"}
                      {isAdmin && isAptoGrauDemolay(m) && (
                        <span className="rounded-full bg-tv-warn-bg px-2 py-0.5 text-xs font-bold text-tv-warn">
                          apto ao DeMolay
                        </span>
                      )}
                    </span>
                    <span>
                      <StatusChip status={m.status} />
                    </span>
                    <span className="text-right">
                      <Link
                        to="/membros/$id"
                        params={{ id: m.id }}
                        className="inline-flex min-h-[38px] items-center rounded-[10px] border border-tv-border px-3 text-sm font-semibold hover:bg-tv-bg"
                      >
                        Ver perfil
                      </Link>
                    </span>
                  </div>
                );
              })}
              <div className="px-5 py-3.5 text-sm text-tv-text-2">
                {filteredMembers.length} {filteredMembers.length === 1 ? "membro" : "membros"}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-tv-soft font-bold text-tv-ink ${
        size === "sm" ? "h-[38px] w-[38px] text-[13px]" : "h-11 w-11 text-[15px]"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const regular = status === "regular";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${
        regular ? "bg-tv-in-bg text-tv-in" : "bg-tv-warn-bg text-tv-warn"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}
