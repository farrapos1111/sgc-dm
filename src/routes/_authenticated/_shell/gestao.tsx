import { createFileRoute } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useActiveChapter,
  type Membership,
} from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  listCatalog,
  listChapterPositions,
  listCommissionMembers,
  assignPosition,
  assignCommissionMember,
  removeCommissionMember,
  createChapterCommission,
  updateChapterCommission,
  deleteChapterCommission,
  compareCommissionMembersByRoleName,
} from "@/lib/organization.functions";
import { listMembers } from "@/lib/members.functions";
import { membersListKey } from "@/lib/query-keys";
import { currentTerm, termOptions, chapterFoundedAt } from "@/lib/terms";
import { TermSelect } from "@/components/TermSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import { can } from "@/lib/permissions";
import { is21OrOlder } from "@/lib/format";
import { Pencil, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão de cargos e comissões — SG-CDM" },
      {
        name: "description",
        content: "Quadro de cargos do capítulo e comissões por vigência.",
      },
    ],
  }),
  component: GestaoPage,
});

const COMMISSION_ROLES = [
  { value: "presidente", label: "Presidente" },
  { value: "vice", label: "Vice" },
  { value: "membro", label: "Membro" },
  { value: "auxiliar_senior", label: "Auxiliar Sênior" },
] as const;

type SortKey = "name_asc" | "name_desc" | "default";

function normalizeSearch(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function catalogQO(chapterId: string) {
  return queryOptions({
    queryKey: ["org-catalog", chapterId],
    queryFn: () => listCatalog({ data: { chapterId } }),
  });
}

function GestaoPage() {
  const { active } = useActiveChapter();
  if (!active) {
    return (
      <div>
        <PageHeader
          title="Gestão"
          subtitle="Cargos e comissões conforme o perfil dos membros, por vigência."
        />
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Nenhum capítulo ativo"
          description="Selecione um capítulo para gerenciar cargos e comissões."
        />
      </div>
    );
  }
  return <GestaoContent active={active} />;
}

function GestaoContent({ active }: { active: Membership }) {
  const qc = useQueryClient();
  const [term, setTerm] = useState(currentTerm());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [tab, setTab] = useState("cargos");
  const chapterId = active.chapter_id;
  const foundedAt = chapterFoundedAt(active.chapter);
  const terms = useMemo(() => termOptions({ foundedAt }), [foundedAt]);
  const canEdit = can(active.role.name, "secretaria");
  const canEditCommissions = can(active.role.name, "comissoes");

  const { data: catalog } = useSuspenseQuery(catalogQO(chapterId));
  const { data: members } = useSuspenseQuery(
    queryOptions({
      queryKey: membersListKey(chapterId, "", "all"),
      queryFn: () =>
        listMembers({ data: { chapterId, search: "", status: "all" } }),
    }),
  );
  const { data: positions } = useSuspenseQuery(
    queryOptions({
      queryKey: ["chapter-positions", chapterId, term.year, term.semester],
      queryFn: () =>
        listChapterPositions({
          data: { chapterId, year: term.year, semester: term.semester },
        }),
    }),
  );
  const { data: commissionMembers } = useSuspenseQuery(
    queryOptions({
      queryKey: ["commission-members", chapterId, term.year, term.semester],
      queryFn: () =>
        listCommissionMembers({
          data: { chapterId, year: term.year, semester: term.semester },
        }),
    }),
  );

  const [commissionForm, setCommissionForm] = useState<{
    open: boolean;
    id?: number;
    label: string;
  }>({ open: false, label: "" });
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    label: string;
  } | null>(null);

  function invalidateMembers() {
    qc.invalidateQueries({ queryKey: ["chapter-positions"] });
    qc.invalidateQueries({ queryKey: ["commission-members"] });
    qc.invalidateQueries({ queryKey: ["member-org"] });
  }

  function invalidateCatalog() {
    qc.invalidateQueries({ queryKey: ["org-catalog", chapterId] });
    invalidateMembers();
  }

  const assignPos = useMutation({
    mutationFn: (v: { memberId: string; positionId: number }) =>
      assignPosition({
        data: { chapterId, year: term.year, semester: term.semester, ...v },
      }),
    onSuccess: () => {
      toast.success("Cargo designado");
      invalidateMembers();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível designar"),
  });
  const assignCom = useMutation({
    mutationFn: (v: { memberId: string; commissionId: number; role: any }) =>
      assignCommissionMember({
        data: { chapterId, year: term.year, semester: term.semester, ...v },
      }),
    onSuccess: () => {
      toast.success("Participação registrada");
      invalidateMembers();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delCom = useMutation({
    mutationFn: (id: string) =>
      removeCommissionMember({ data: { id, chapterId } }),
    onSuccess: () => {
      toast.success("Participação removida");
      invalidateMembers();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const saveCommission = useMutation({
    mutationFn: async () => {
      const label = commissionForm.label.trim();
      if (commissionForm.id) {
        return updateChapterCommission({
          data: { chapterId, id: commissionForm.id, label },
        });
      }
      return createChapterCommission({ data: { chapterId, label } });
    },
    onSuccess: () => {
      toast.success(
        commissionForm.id ? "Comissão atualizada" : "Comissão criada",
      );
      setCommissionForm({ open: false, label: "" });
      invalidateCatalog();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar comissão"),
  });

  const removeCommission = useMutation({
    mutationFn: (id: number) =>
      deleteChapterCommission({ data: { chapterId, id } }),
    onSuccess: () => {
      toast.success("Comissão excluída");
      setDeleteTarget(null);
      invalidateCatalog();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const byPosition = useMemo(() => {
    const map = new Map<number, (typeof positions)[number][]>();
    for (const p of positions) {
      const list = map.get(p.position_id) ?? [];
      list.push(p);
      map.set(p.position_id, list);
    }
    return map;
  }, [positions]);

  const q = normalizeSearch(search);

  const filteredPositions = useMemo(() => {
    let list = catalog.positions.slice();
    if (q) {
      list = list.filter((p) => {
        if (normalizeSearch(p.label).includes(q)) return true;
        const assigned = byPosition.get(p.id) ?? [];
        return assigned.some((a) =>
          normalizeSearch(a.member?.full_name ?? "").includes(q),
        );
      });
    }
    if (sortKey === "name_asc") {
      list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    } else if (sortKey === "name_desc") {
      list.sort((a, b) => b.label.localeCompare(a.label, "pt-BR"));
    } else {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return list;
  }, [catalog.positions, byPosition, q, sortKey]);

  const filteredCommissions = useMemo(() => {
    let list = catalog.commissions.slice();
    if (q) {
      list = list.filter((c) => {
        if (normalizeSearch(c.label).includes(q)) return true;
        const rows = commissionMembers.filter(
          (cm) => cm.commission_id === c.id,
        );
        return rows.some((r) => {
          if (normalizeSearch(r.member?.full_name ?? "").includes(q))
            return true;
          const roleLabel =
            COMMISSION_ROLES.find((x) => x.value === r.role)?.label ?? r.role;
          return normalizeSearch(String(roleLabel)).includes(q);
        });
      });
    }
    if (sortKey === "name_asc") {
      list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    } else if (sortKey === "name_desc") {
      list.sort((a, b) => b.label.localeCompare(a.label, "pt-BR"));
    } else {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
    return list;
  }, [catalog.commissions, commissionMembers, q, sortKey]);

  const eligibleForConselho = members.filter((m) => is21OrOlder(m.birth_date));

  function commissionRows(commissionId: number) {
    let rows = commissionMembers.filter(
      (cm) => cm.commission_id === commissionId,
    );
    if (q) {
      const matchCommission = filteredCommissions.some(
        (c) => c.id === commissionId && normalizeSearch(c.label).includes(q),
      );
      if (!matchCommission) {
        rows = rows.filter((r) => {
          if (normalizeSearch(r.member?.full_name ?? "").includes(q))
            return true;
          const roleLabel =
            COMMISSION_ROLES.find((x) => x.value === r.role)?.label ?? r.role;
          return normalizeSearch(String(roleLabel)).includes(q);
        });
      }
    }
    return rows.sort(compareCommissionMembersByRoleName);
  }

  function positionAssignees(positionId: number) {
    let assigned = byPosition.get(positionId) ?? [];
    if (q) {
      const pos = catalog.positions.find((p) => p.id === positionId);
      const matchCargo = pos && normalizeSearch(pos.label).includes(q);
      if (!matchCargo) {
        assigned = assigned.filter((a) =>
          normalizeSearch(a.member?.full_name ?? "").includes(q),
        );
      }
    }
    return assigned;
  }

  return (
    <div>
      <PageHeader
        title="Gestão"
        subtitle="Cargos e comissões conforme o perfil dos membros, por vigência."
        actions={
          <TermSelect
            className="w-auto"
            value={term}
            terms={terms}
            onChange={setTerm}
          />
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar membro, cargo ou comissão…"
            aria-label="Buscar membro, cargo ou comissão"
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
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Ordem padrão</SelectItem>
            <SelectItem value="name_asc">Nome A–Z</SelectItem>
            <SelectItem value="name_desc">Nome Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="cargos">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["capitulo", "consultivo"] as const).map((scope) => {
              const scopePositions = filteredPositions.filter(
                (p) => p.scope === scope,
              );
              return (
                <Card key={scope} className="rounded-[12px] p-5">
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    {scope === "capitulo"
                      ? "Cargos do Capítulo"
                      : "Conselho Consultivo"}
                  </h3>
                  {scopePositions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum cargo correspondente à busca.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {scopePositions.map((p) => {
                        const assigned = positionAssignees(p.id);
                        const allAssigned = byPosition.get(p.id) ?? [];
                        const occupied = allAssigned.length > 0;
                        return (
                          <li
                            key={p.id}
                            className="flex items-start justify-between gap-2 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="font-medium">{p.label}</div>
                              {assigned.length > 0 ? (
                                <ul className="mt-0.5 space-y-0.5">
                                  {assigned.map((a) => (
                                    <li
                                      key={a.id}
                                      className="truncate text-xs text-muted-foreground"
                                    >
                                      {a.member?.full_name}
                                    </li>
                                  ))}
                                </ul>
                              ) : occupied && q ? (
                                <div className="text-xs text-muted-foreground">
                                  Ocupado (sem membro na busca)
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  Vago
                                </div>
                              )}
                            </div>
                            {canEdit && !occupied && (
                              <AssignDialog
                                title={`Designar ${p.label}`}
                                members={
                                  scope === "consultivo"
                                    ? eligibleForConselho
                                    : members
                                }
                                emptyHint={
                                  scope === "consultivo"
                                    ? "Nenhum membro com 21 anos ou mais."
                                    : "Nenhum membro cadastrado."
                                }
                                onConfirm={(memberId) =>
                                  assignPos.mutate({
                                    memberId,
                                    positionId: p.id,
                                  })
                                }
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="comissoes">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canEditCommissions && (
              <Button
                onClick={() => setCommissionForm({ open: true, label: "" })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova comissão
              </Button>
            )}
          </div>
          {filteredCommissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma comissão correspondente à busca.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredCommissions.map((c) => {
                const rows = commissionRows(c.id);
                return (
                  <Card key={c.id} className="rounded-[12px] p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="min-w-0 truncate text-sm font-semibold">
                        {c.label}
                      </h3>
                      {canEditCommissions && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Editar ${c.label}`}
                            onClick={() =>
                              setCommissionForm({
                                open: true,
                                id: c.id,
                                label: c.label,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Excluir ${c.label}`}
                            onClick={() =>
                              setDeleteTarget({ id: c.id, label: c.label })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <AssignDialog
                            title={`Adicionar em ${c.label}`}
                            members={members}
                            withRole
                            onConfirm={(memberId, role) =>
                              assignCom.mutate({
                                memberId,
                                commissionId: c.id,
                                role,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    {rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum participante nesta vigência.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border text-sm">
                        {rows.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 py-2"
                          >
                            <span className="min-w-0 truncate">
                              {r.member?.full_name}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge variant="secondary">
                                {COMMISSION_ROLES.find(
                                  (x) => x.value === r.role,
                                )?.label ?? r.role}
                              </Badge>
                              {canEditCommissions && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => delCom.mutate(r.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={commissionForm.open}
        onOpenChange={(open) =>
          setCommissionForm((prev) => ({
            ...prev,
            open,
            ...(open ? {} : { id: undefined, label: "" }),
          }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {commissionForm.id ? "Editar comissão" : "Nova comissão"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Nome</Label>
              <Input
                value={commissionForm.label}
                onChange={(e) =>
                  setCommissionForm((prev) => ({
                    ...prev,
                    label: e.target.value,
                  }))
                }
                placeholder="Ex.: Captação de recursos"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              disabled={
                commissionForm.label.trim().length < 2 ||
                saveCommission.isPending
              }
              onClick={() => saveCommission.mutate()}
            >
              {commissionForm.id ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comissão?</AlertDialogTitle>
            <AlertDialogDescription>
              A comissão “{deleteTarget?.label}” e todas as participações
              vinculadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) removeCommission.mutate(deleteTarget.id);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignDialog({
  title,
  members,
  withRole,
  emptyHint,
  onConfirm,
}: {
  title: string;
  members: { id: string; full_name: string }[];
  withRole?: boolean;
  emptyHint?: string;
  onConfirm: (memberId: string, role?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<string>("membro");

  const options = members.map((m) => ({ value: m.id, label: m.full_name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={title}>
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyHint ?? "Nenhum membro elegível."}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Membro</Label>
              <SearchableSelect
                value={memberId}
                options={options}
                onChange={setMemberId}
                placeholder="Selecione um membro"
                searchPlaceholder="Buscar membro…"
              />
            </div>
            {withRole && (
              <div>
                <Label className="mb-1.5 block text-sm">
                  Cargo na comissão
                </Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMISSION_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => {
                if (!memberId) return;
                onConfirm(memberId, withRole ? role : undefined);
                setOpen(false);
                setMemberId("");
              }}
            >
              Confirmar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
