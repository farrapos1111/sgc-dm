import { createFileRoute, Link } from "@tanstack/react-router";
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
import { PlusCircle, Search, Users, X, Inbox } from "lucide-react";
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

function MembrosList() {
  const { active } = useActiveChapter();
  const { can, canScreen } = useChapterAccess();
  if (!active) return null;

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

  return (
    <div className={isFetching ? "opacity-80 transition-opacity" : undefined}>
      <PageHeader
        title="Membros"
        subtitle={`${filteredMembers.length} ${filteredMembers.length === 1 ? "membro" : "membros"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" asChild>
                <Link to="/membros/solicitacoes">
                  <Inbox className="mr-2 h-4 w-4" />
                  Solicitações
                  {(pendingReq?.count ?? 0) > 0 && (
                    <Badge className="ml-2" variant="destructive">
                      {pendingReq!.count}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}
            <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
              <Link to="/membros/novo">
                <PlusCircle className="mr-2 h-4 w-4" /> Novo membro
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px_minmax(200px,280px)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            className="pl-9 pr-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as StatusFilter }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="irregular">Irregular</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.kind}
          onValueChange={(v) => setFilters((f) => ({ ...f, kind: v as KindFilter }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="demolay_ativo">Demolay Ativo</SelectItem>
            <SelectItem value="senior">Senior Demolay</SelectItem>
            <SelectItem value="macom">Maçom</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.filtro}
          onValueChange={(v) => setFilters((f) => ({ ...f, filtro: v as MemberFilter }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            {MEMBER_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Nenhum membro encontrado"
          description={
            filters.filtro !== "todos"
              ? "Nenhum membro corresponde a este filtro."
              : "Cadastre o primeiro membro do capítulo."
          }
          action={
            filters.filtro === "todos" ? (
              <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
                <Link to="/membros/novo">
                  <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar membro
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {filteredMembers.map((m) => {
            const grau = grauOf(m);
            const kind = (m as { kind?: string }).kind;
            const showGrauTag = kind !== "senior" && kind !== "macom";
            return (
              <Link key={m.id} to="/membros/$id" params={{ id: m.id }} className="h-full">
                <Card className="flex h-full flex-col items-stretch gap-2 rounded-[12px] p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="break-words font-medium leading-snug">{m.full_name}</div>
                    <div className="break-all text-xs text-muted-foreground">{m.email || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {(() => {
                        const nasc = formatDateBR(m.birth_date);
                        const age = ageFrom(m.birth_date);
                        if (!m.birth_date) return "Nasc. —";
                        return age !== null
                          ? `Nasc. ${nasc} · ${age} ${age === 1 ? "Ano" : "Anos"}`
                          : `Nasc. ${nasc}`;
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                    {isAdmin && isAptoGrauDemolay(m) && (
                      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/20">
                        Apto a G∴D∴
                      </Badge>
                    )}
                    {showGrauTag && grau.code && <Badge variant="outline">{grau.code}</Badge>}
                    <Badge variant="outline">{kindLabel(kind)}</Badge>
                    <Badge variant="secondary">{statusLabel(m.status)}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
