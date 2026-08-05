import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import {
  listOrgLeaderships,
  listRegions,
  listStates,
  lookupRegionMemberByDemolay,
  saveOrgLeadership,
  setOrgLeadershipActive,
  transferRegionOffice,
  type OrgRoleName,
} from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute(
  "/_authenticated/_shell/regional/liderancas",
)({
  component: ManageLeaderships,
  head: () => ({
    meta: [{ title: "Lideranças — SG-CDM" }],
  }),
});

type StateDraft = {
  email: string;
  org_role: "gme" | "mce";
  state_id: string;
};

type InviteDraft = {
  org_role: "mcr" | "oe";
  region_id: string;
  demolayId: string;
};

function ManageLeaderships() {
  return (
    <ScopeGuard>
      <LeadershipsContent />
    </ScopeGuard>
  );
}

function LeadershipsContent() {
  const {
    canManageOrg,
    canManageLeaderships,
    canAppointMcr,
    canAppointOe,
    activeScope,
    leaderships,
  } = useOrgScope();
  const qc = useQueryClient();
  const [stateDraft, setStateDraft] = useState<StateDraft | null>(null);
  const [invite, setInvite] = useState<InviteDraft | null>(null);
  const [lookedUp, setLookedUp] = useState<{
    id: string;
    full_name: string;
    has_account: boolean;
    chapter_name: string | null;
  } | null>(null);

  const scopeStateId =
    leaderships.find((l) => l.org_role === "gme" && l.state_id)?.state_id ??
    leaderships.find((l) => l.state_id)?.state_id ??
    (activeScope?.type === "state" ? activeScope.id : null);

  const scopeRegionId =
    activeScope?.type === "region"
      ? activeScope.id
      : (leaderships.find((l) => l.region_id)?.region_id ?? null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["org-leaderships"],
    queryFn: () => listOrgLeaderships(),
    enabled: canManageLeaderships,
  });

  const { data: states } = useQuery({
    queryKey: ["states"],
    queryFn: () => listStates(),
    enabled: canManageOrg,
  });

  const inviteStateId =
    scopeStateId ||
    leaderships.find((l) => l.state_id)?.state_id ||
    "";

  const { data: regions } = useQuery({
    queryKey: ["regions", inviteStateId],
    queryFn: () => listRegions({ data: { stateId: inviteStateId } }),
    enabled: Boolean(inviteStateId) && (canAppointMcr || canAppointOe),
  });

  const filtered = useMemo(() => {
    if (canManageOrg && scopeStateId) {
      const regionIds = new Set(
        (regions ?? [])
          .filter((r) => r.state_id === scopeStateId)
          .map((r) => r.id),
      );
      return (rows ?? []).filter(
        (r) =>
          r.state_id === scopeStateId ||
          (r.region_id && regionIds.has(r.region_id)),
      );
    }
    if (scopeRegionId) {
      return (rows ?? []).filter((r) => r.region_id === scopeRegionId);
    }
    return rows ?? [];
  }, [rows, scopeStateId, scopeRegionId, regions, canManageOrg]);

  const saveStateLead = useMutation({
    mutationFn: (d: StateDraft) =>
      saveOrgLeadership({
        data: {
          email: d.email,
          org_role: d.org_role,
          state_id: d.state_id,
          region_id: null,
        },
      }),
    onSuccess: () => {
      toast.success("Liderança salva");
      setStateDraft(null);
      qc.invalidateQueries({ queryKey: ["org-leaderships"] });
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lookup = useMutation({
    mutationFn: async () => {
      if (!invite) throw new Error("Convite inválido");
      return lookupRegionMemberByDemolay({
        data: { demolayId: invite.demolayId, regionId: invite.region_id },
      });
    },
    onSuccess: (m) => {
      if (!m) {
        setLookedUp(null);
        toast.error("Membro não encontrado nesta região");
        return;
      }
      setLookedUp({
        id: m.id,
        full_name: m.full_name,
        has_account: m.has_account,
        chapter_name: m.chapter_name,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: async () => {
      if (!invite || !lookedUp) throw new Error("Busque o membro antes");
      if (!lookedUp.has_account) {
        throw new Error("O membro precisa ter conta vinculada");
      }
      return transferRegionOffice({
        data: {
          targetMemberId: lookedUp.id,
          orgRole: invite.org_role,
          regionId: invite.region_id,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cargo regional transferido");
      setInvite(null);
      setLookedUp(null);
      qc.invalidateQueries({ queryKey: ["org-leaderships"] });
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      setOrgLeadershipActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-leaderships"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManageLeaderships) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Sem permissão para gerenciar lideranças.
      </Card>
    );
  }

  const appointableRoles = (
    [
      canAppointMcr ? "mcr" : null,
      canAppointOe ? "oe" : null,
    ] as const
  ).filter(Boolean) as Array<"mcr" | "oe">;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lideranças"
        subtitle="GME/MCE por e-mail · MCR/OE por convite (ID DeMolay)"
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageOrg && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setStateDraft({
                    email: "",
                    org_role: "gme",
                    state_id: scopeStateId ?? "",
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> GME/MCE
              </Button>
            )}
            {appointableRoles.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setLookedUp(null);
                  setInvite({
                    org_role: appointableRoles[0],
                    region_id: scopeRegionId ?? "",
                    demolayId: "",
                  });
                }}
              >
                <UserPlus className="mr-1 h-4 w-4" /> Convidar MCR/OE
              </Button>
            )}
          </div>
        }
      />

      {isLoading && (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma liderança neste escopo.
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((row) => {
          const isRegional = row.org_role === "mcr" || row.org_role === "oe";
          return (
            <Card
              key={row.id}
              className="flex items-center gap-3 rounded-[12px] p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {row.full_name || row.email || "—"}
                  </span>
                  <Badge variant="secondary">
                    {ORG_ROLE_LABELS[row.org_role]}
                  </Badge>
                  {!row.active ? (
                    <Badge variant="destructive">Inativo</Badge>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {row.email}
                  {row.state_name ? ` · ${row.state_name}` : ""}
                  {row.region_name ? ` · ${row.region_name}` : ""}
                </div>
                {row.starts_on && row.ends_on && (
                    <div className="text-[10px] text-muted-foreground">
                      Vigência:{" "}
                      {row.starts_on.split("-").reverse().join("/")} –{" "}
                      {row.ends_on.split("-").reverse().join("/")}
                    </div>
                  )}
              </div>
              {!isRegional && canManageOrg ? (
                <Switch
                  checked={row.active}
                  onCheckedChange={(v) =>
                    toggle.mutate({ id: row.id, active: v })
                  }
                  aria-label="Liderança ativa"
                />
              ) : null}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!stateDraft} onOpenChange={(o) => !o && setStateDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova liderança estadual</DialogTitle>
          </DialogHeader>
          {stateDraft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="ld-email">E-mail da conta</Label>
                <Input
                  id="ld-email"
                  type="email"
                  value={stateDraft.email}
                  onChange={(e) =>
                    setStateDraft({ ...stateDraft, email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Select
                  value={stateDraft.org_role}
                  onValueChange={(v) =>
                    setStateDraft({
                      ...stateDraft,
                      org_role: v as "gme" | "mce",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gme">{ORG_ROLE_LABELS.gme}</SelectItem>
                    <SelectItem value="mce">{ORG_ROLE_LABELS.mce}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={stateDraft.state_id || undefined}
                  onValueChange={(v) =>
                    setStateDraft({ ...stateDraft, state_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(states ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.uf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStateDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !stateDraft?.email ||
                !stateDraft.state_id ||
                saveStateLead.isPending
              }
              onClick={() => stateDraft && saveStateLead.mutate(stateDraft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!invite}
        onOpenChange={(o) => {
          if (!o) {
            setInvite(null);
            setLookedUp(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar MCR / OE</DialogTitle>
          </DialogHeader>
          {invite && (
            <div className="space-y-3">
              <div>
                <Label>Cargo</Label>
                <Select
                  value={invite.org_role}
                  onValueChange={(v) => {
                    setLookedUp(null);
                    setInvite({ ...invite, org_role: v as "mcr" | "oe" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {appointableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ORG_ROLE_LABELS[r as OrgRoleName]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Região</Label>
                <Select
                  value={invite.region_id || undefined}
                  onValueChange={(v) => {
                    setLookedUp(null);
                    setInvite({ ...invite, region_id: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(regions ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inv-dm">ID DeMolay</Label>
                <div className="flex gap-2">
                  <Input
                    id="inv-dm"
                    value={invite.demolayId}
                    onChange={(e) => {
                      setLookedUp(null);
                      setInvite({ ...invite, demolayId: e.target.value });
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !invite.demolayId.trim() ||
                      !invite.region_id ||
                      lookup.isPending
                    }
                    onClick={() => lookup.mutate()}
                  >
                    Buscar
                  </Button>
                </div>
              </div>
              {lookedUp && (
                <Card className="rounded-[10px] p-3 text-sm">
                  <div className="font-medium">{lookedUp.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {lookedUp.chapter_name ?? "—"}
                    {lookedUp.has_account
                      ? " · conta vinculada"
                      : " · sem conta (vincule antes)"}
                  </div>
                </Card>
              )}
              <p className="text-xs text-muted-foreground">
                Só pode existir um titular ativo por região. Ao transferir, o
                anterior volta ao acesso do capítulo.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setInvite(null);
                setLookedUp(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!lookedUp?.has_account || transfer.isPending}
              onClick={() => transfer.mutate()}
            >
              Nomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
