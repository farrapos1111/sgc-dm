import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  listCatalog,
  listChapterPositions,
  listCommissionMembers,
  assignPosition,
  removePosition,
  assignCommissionMember,
  removeCommissionMember,
} from "@/lib/organization.functions";
import { listMembers } from "@/lib/members.functions";
import { membersListKey } from "@/lib/query-keys";
import { currentTerm, termLabel, termOptions } from "@/lib/terms";
import { can } from "@/lib/permissions";
import { grauOf, is21OrOlder } from "@/lib/format";
import { Trash2, UserPlus } from "lucide-react";

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

const catalogQO = queryOptions({ queryKey: ["org-catalog"], queryFn: () => listCatalog() });

function GestaoPage() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const [term, setTerm] = useState(currentTerm());
  const chapterId = active?.chapter_id ?? "";
  const canEdit = can(active?.role.name, "secretaria");
  const canEditCommissions = can(active?.role.name, "comissoes");

  const { data: catalog } = useSuspenseQuery(catalogQO);
  const { data: members } = useSuspenseQuery(
    queryOptions({
      queryKey: membersListKey(chapterId, "", "all"),
      queryFn: () => listMembers({ data: { chapterId, search: "", status: "all" } }),
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

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["chapter-positions"] });
    qc.invalidateQueries({ queryKey: ["commission-members"] });
  }

  const assignPos = useMutation({
    mutationFn: (v: { memberId: string; positionId: number }) =>
      assignPosition({
        data: { chapterId, year: term.year, semester: term.semester, ...v },
      }),
    onSuccess: () => {
      toast.success("Cargo designado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível designar"),
  });
  const delPos = useMutation({
    mutationFn: (id: string) => removePosition({ data: { id } }),
    onSuccess: () => {
      toast.success("Designação removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const assignCom = useMutation({
    mutationFn: (v: { memberId: string; commissionId: number; role: any }) =>
      assignCommissionMember({
        data: { chapterId, year: term.year, semester: term.semester, ...v },
      }),
    onSuccess: () => {
      toast.success("Participação registrada");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delCom = useMutation({
    mutationFn: (id: string) => removeCommissionMember({ data: { id } }),
    onSuccess: () => {
      toast.success("Participação removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const byPosition = useMemo(() => {
    const map = new Map<number, (typeof positions)[number]>();
    positions.forEach((p) => map.set(p.position_id, p));
    return map;
  }, [positions]);

  const eligibleForChapter = members.filter((m) => grauOf(m).code === "DM");
  const eligibleForConselho = members.filter((m) => is21OrOlder(m.birth_date));

  return (
    <div>
      <PageHeader
        title="Gestão"
        subtitle="Cargos do capítulo e comissões por vigência."
        actions={
          <Select
            value={`${term.year}-${term.semester}`}
            onValueChange={(v) => {
              const [y, s] = v.split("-");
              setTerm({ year: Number(y), semester: Number(s) as 1 | 2 });
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {termOptions().map((t) => (
                <SelectItem key={`${t.year}-${t.semester}`} value={`${t.year}-${t.semester}`}>
                  {termLabel(t.year, t.semester)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Tabs defaultValue="cargos">
        <TabsList className="mb-4">
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="cargos">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["capitulo", "consultivo"] as const).map((scope) => (
              <Card key={scope} className="rounded-[12px] p-5">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                  {scope === "capitulo" ? "Cargos do Capítulo" : "Conselho Consultivo"}
                </h3>
                <ul className="divide-y divide-border text-sm">
                  {catalog.positions
                    .filter((p) => p.scope === scope)
                    .map((p) => {
                      const assigned = byPosition.get(p.id);
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="font-medium">{p.label}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {assigned?.member?.full_name ?? "Vago"}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 items-center gap-1">
                              <AssignDialog
                                title={`Designar ${p.label}`}
                                members={
                                  scope === "consultivo" ? eligibleForConselho : eligibleForChapter
                                }
                                emptyHint={
                                  scope === "consultivo"
                                    ? "Nenhum membro com 21 anos ou mais."
                                    : "Nenhum membro com grau DM."
                                }
                                onConfirm={(memberId) =>
                                  assignPos.mutate({ memberId, positionId: p.id })
                                }
                              />
                              {assigned && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => delPos.mutate(assigned.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="comissoes">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {catalog.commissions.map((c) => {
              const rows = commissionMembers.filter((cm) => cm.commission_id === c.id);
              return (
                <Card key={c.id} className="rounded-[12px] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{c.label}</h3>
                    {canEditCommissions && (
                      <AssignDialog
                        title={`Adicionar em ${c.label}`}
                        members={members}
                        withRole
                        onConfirm={(memberId, role) =>
                          assignCom.mutate({ memberId, commissionId: c.id, role })
                        }
                      />
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum participante nesta vigência.</p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                          <span className="min-w-0 truncate">{r.member?.full_name}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">
                              {COMMISSION_ROLES.find((x) => x.value === r.role)?.label ?? r.role}
                            </Badge>
                            {canEditCommissions && (
                              <Button size="icon" variant="ghost" onClick={() => delCom.mutate(r.id)}>
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
        </TabsContent>
      </Tabs>
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
          <p className="text-sm text-muted-foreground">{emptyHint ?? "Nenhum membro elegível."}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Membro</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {withRole && (
              <div>
                <Label className="mb-1.5 block text-sm">Cargo na comissão</Label>
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
