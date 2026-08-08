import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import {
  createScopeMember,
  listScopeChapters,
  listScopeMembers,
  setScopeMemberStatus,
} from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, KIND_LABELS } from "@/lib/format";
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
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/_shell/regional/membros")({
  component: RegionalMembers,
  head: () => ({
    meta: [
      { title: "Membros do escopo | Templo Virtual" },
      {
        name: "description",
        content:
          "Consulta e gestão de membros das instituições da região ou do estado.",
      },
    ],
  }),
});

function RegionalMembers() {
  return (
    <ScopeGuard>
      <MembersContent />
    </ScopeGuard>
  );
}

function MembersContent() {
  const { activeScope, canManageChapters } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "regular" | "irregular">("all");
  const [kind, setKind] = useState<"all" | "demolay_ativo" | "senior" | "macom">(
    "all",
  );
  const [chapterFilter, setChapterFilter] = useState<Set<string> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDemolay, setNewDemolay] = useState("");
  const [newChapterId, setNewChapterId] = useState("");

  const { data: chapters } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () =>
      listScopeChapters({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
  });
  const chapterList = chapters ?? [];
  const chapterIds = useMemo(
    () => chapterList.map((c) => c.id),
    [chapterList],
  );

  useEffect(() => {
    setChapterFilter(null);
  }, [scope.key]);

  const selectedChapters = useMemo(() => {
    if (chapterFilter) return chapterFilter;
    return new Set(chapterIds);
  }, [chapterFilter, chapterIds]);

  const allChaptersSelected =
    chapterIds.length > 0 &&
    chapterIds.every((id) => selectedChapters.has(id));

  const chapterFilterLabel = (() => {
    if (allChaptersSelected || selectedChapters.size === 0) {
      return "Todas as instituições";
    }
    if (selectedChapters.size === 1) {
      const id = [...selectedChapters][0];
      const c = chapterList.find((ch) => ch.id === id);
      return c ? c.name : "1 instituição";
    }
    return `${selectedChapters.size} instituições`;
  })();

  const ids = useMemo(() => [...selectedChapters], [selectedChapters]);

  const { data: members, isLoading } = useQuery({
    queryKey: ["scope-members", scope.key, ids.join(","), search, status, kind],
    queryFn: () =>
      listScopeMembers({ data: { chapterIds: ids, search, status, kind } }),
    enabled: ids.length > 0,
  });

  const rows = members ?? [];
  const chapterMap = useMemo(() => {
    const m = new Map(chapterList.map((c) => [c.id, c]));
    return m;
  }, [chapterList]);

  function toggleChapter(id: string) {
    setChapterFilter((prev) => {
      const base = prev ?? new Set(chapterIds);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const create = useMutation({
    mutationFn: () =>
      createScopeMember({
        data: {
          chapterId: newChapterId,
          fullName: newName,
          demolayId: newDemolay || null,
        },
      }),
    onSuccess: () => {
      toast.success("Membro criado");
      setCreateOpen(false);
      setNewName("");
      setNewDemolay("");
      qc.invalidateQueries({ queryKey: ["scope-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: (v: { memberId: string; status: "regular" | "irregular" }) =>
      setScopeMemberStatus({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["scope-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Membros do escopo"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label}`}
        actions={
          canManageChapters ? (
            <Button
              size="sm"
              onClick={() => {
                setNewChapterId(
                  selectedChapters.size === 1
                    ? [...selectedChapters][0]
                    : (chapterList[0]?.id ?? ""),
                );
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_160px_minmax(200px,240px)]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou cargo…"
            aria-label="Buscar membros por nome ou cargo"
            className="pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
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

        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
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

        {chapterList.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 w-full justify-between font-normal"
              >
                <span className="truncate">{chapterFilterLabel}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[min(100vw-2rem,280px)] max-h-72 overflow-y-auto"
            >
              <DropdownMenuLabel>Filtrar instituições</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {chapterList.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={selectedChapters.has(c.id)}
                  onCheckedChange={() => toggleChapter(c.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.name} · Nº {c.number}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setChapterFilter(new Set(chapterIds))}
              >
                Selecionar todas
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setChapterFilter(new Set())}
                disabled={selectedChapters.size === 0}
              >
                Limpar seleção
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {isLoading
          ? "Carregando…"
          : `${rows.length} ${rows.length === 1 ? "membro" : "membros"}`}
      </div>

      {!isLoading && rows.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          {ids.length === 0
            ? "Selecione ao menos uma instituição para listar membros."
            : "Nenhum membro encontrado com estes filtros."}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {rows.map((m) => {
          const chapter = chapterMap.get(m.chapter_id);
          const memberKind = (m as { kind?: string }).kind;
          return (
            <Card
              key={m.id}
              className="flex items-start gap-3 rounded-[12px] p-4"
            >
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: chapter?.primary_color || "#9E1B32",
                }}
              >
                {m.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words text-sm font-medium leading-snug">
                      {m.full_name}
                    </span>
                    {(
                      (m as { current_positions?: { code: string; label: string }[] })
                        .current_positions ?? []
                    ).map((p) => (
                      <Badge
                        key={p.code}
                        variant="outline"
                        className="shrink-0 text-[10px] font-medium"
                        style={{
                          borderColor: chapter?.primary_color || undefined,
                          color: chapter?.primary_color || undefined,
                        }}
                      >
                        {p.label}
                      </Badge>
                    ))}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {chapter?.name ?? "—"}
                    {chapter?.number ? ` · Nº ${chapter.number}` : ""}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">
                    {STATUS_LABELS[m.status] ?? m.status}
                  </Badge>
                  <Badge variant="outline">
                    {(memberKind && KIND_LABELS[memberKind]) ||
                      memberKind ||
                      "—"}
                  </Badge>
                  {canManageChapters && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 text-xs"
                      disabled={toggleStatus.isPending}
                      onClick={() =>
                        toggleStatus.mutate({
                          memberId: m.id,
                          status:
                            m.status === "regular" ? "irregular" : "regular",
                        })
                      }
                    >
                      {m.status === "regular" ? "Inativar" : "Reativar"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Instituição</Label>
              <SearchableSelect
                value={newChapterId}
                onChange={setNewChapterId}
                placeholder="Selecione"
                searchPlaceholder="Buscar instituição…"
                emptyText="Nenhuma instituição encontrada."
                options={chapterList.map((c) => ({
                  value: c.id,
                  label: `${c.name} Nº ${c.number}`,
                }))}
              />
            </div>
            <div>
              <Label htmlFor="nm-name">Nome completo</Label>
              <Input
                id="nm-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nm-dm">ID DeMolay (opcional)</Label>
              <Input
                id="nm-dm"
                value={newDemolay}
                onChange={(e) => setNewDemolay(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !newName.trim() || !newChapterId || create.isPending
              }
              onClick={() => create.mutate()}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
