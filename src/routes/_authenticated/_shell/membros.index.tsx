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
import { PlusCircle, Search, Users } from "lucide-react";
import { formatDateBR, statusLabel, grauOf, isAptoGrauDemolay } from "@/lib/format";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/_shell/membros/")({
  head: () => ({ meta: [{ title: "Membros — SG-CDM" }] }),
  component: MembrosList,
});

type StatusFilter = "all" | "ativo" | "inativo" | "senior" | "macom";
type MemberFilter = "todos" | "sem_cargo" | "sem_exame_dm" | "apto_gd";

const MEMBER_FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "sem_cargo", label: "DeMolays sem cargo" },
  { value: "sem_exame_dm", label: "Sem exame de Grau DeMolay" },
  { value: "apto_gd", label: "Aptos a receber o Grau DeMolay" },
];

const membersQO = (chapterId: string, search: string, status: StatusFilter) =>
  queryOptions({
    queryKey: membersListKey(chapterId, search, status),
    queryFn: () => listMembers({ data: { chapterId, search, status } }),
  });

function MembrosList() {
  const { active } = useActiveChapter();
  if (!active) return null;
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("todos");
  const term = currentTerm();

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchDebounced(searchInput), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const { data: members = [], isPending, isFetching } = useQuery({
    ...membersQO(active.chapter_id, searchDebounced, status),
    placeholderData: keepPreviousData,
  });

  const needsPositions = memberFilter === "sem_cargo";
  const { data: positions = [] } = useQuery({
    queryKey: ["chapter-positions", active.chapter_id, term.year, term.semester],
    queryFn: () =>
      listChapterPositions({
        data: { chapterId: active.chapter_id, year: term.year, semester: term.semester },
      }),
    enabled: needsPositions,
  });

  const memberIdsWithCargo = useMemo(
    () => new Set(positions.map((p) => p.member_id)),
    [positions],
  );

  const filteredMembers = useMemo(() => {
    switch (memberFilter) {
      case "sem_cargo":
        return members.filter((m) => m.status === "ativo" && !memberIdsWithCargo.has(m.id));
      case "sem_exame_dm":
        return members.filter((m) => m.status === "ativo" && !m.exam_grau_demolay);
      case "apto_gd":
        return members.filter((m) => m.status === "ativo" && isAptoGrauDemolay(m));
      default:
        return members;
    }
  }, [memberFilter, members, memberIdsWithCargo]);

  const isAdmin =
    can(active.role.name, "secretaria") ||
    can(active.role.name, "conselho") ||
    can(active.role.name, "admin");

  if (isPending && members.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className={isFetching ? "opacity-80 transition-opacity" : undefined}>
      <PageHeader
        title="Membros"
        subtitle={`${filteredMembers.length} ${filteredMembers.length === 1 ? "membro" : "membros"}`}
        actions={
          <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
            <Link to="/membros/novo">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo membro
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_minmax(200px,280px)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="senior">Senior DeMolay</SelectItem>
            <SelectItem value="macom">Maçom</SelectItem>
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as MemberFilter)}>
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
            memberFilter !== "todos"
              ? "Nenhum membro corresponde a este filtro."
              : "Cadastre o primeiro membro do capítulo."
          }
          action={
            memberFilter === "todos" ? (
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
            return (
              <Link key={m.id} to="/membros/$id" params={{ id: m.id }}>
                <Card className="rounded-[12px] p-4 transition-colors hover:bg-muted/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.email || m.phone || "—"} · Nasc. {formatDateBR(m.birth_date)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isAdmin && isAptoGrauDemolay(m) && (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/20">
                          Apto a G∴D∴
                        </Badge>
                      )}
                      {grau.code && <Badge variant="outline">{grau.code}</Badge>}
                      <Badge variant="secondary">{statusLabel(m.status)}</Badge>
                    </div>
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
