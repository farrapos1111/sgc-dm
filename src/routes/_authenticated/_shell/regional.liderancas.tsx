import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import {
  listOrgLeaderships,
  listRegions,
  listStates,
  saveOrgLeadership,
  setOrgLeadershipActive,
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

type Draft = {
  email: string;
  org_role: OrgRoleName;
  state_id: string;
  region_id: string;
};

const EMPTY: Draft = {
  email: "",
  org_role: "gme",
  state_id: "",
  region_id: "",
};

function ManageLeaderships() {
  return (
    <ScopeGuard>
      <LeadershipsContent />
    </ScopeGuard>
  );
}

function LeadershipsContent() {
  const { canManageOrg, isSuperAdmin, activeScope, leaderships } =
    useOrgScope();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const scopeStateId =
    leaderships.find((l) => l.org_role === "gme" && l.state_id)?.state_id ??
    leaderships.find((l) => l.state_id)?.state_id ??
    (activeScope?.type === "state" ? activeScope.id : null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["org-leaderships"],
    queryFn: () => listOrgLeaderships(),
    enabled: canManageOrg,
  });

  const { data: states } = useQuery({
    queryKey: ["states"],
    queryFn: () => listStates(),
    enabled: canManageOrg,
  });

  const selectedStateId = draft?.state_id || scopeStateId || "";

  const { data: regions } = useQuery({
    queryKey: ["regions", selectedStateId],
    queryFn: () => listRegions({ data: { stateId: selectedStateId } }),
    enabled: Boolean(selectedStateId),
  });

  const filtered = useMemo(() => {
    if (isSuperAdmin || !scopeStateId) return rows ?? [];
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
  }, [rows, isSuperAdmin, scopeStateId, regions]);

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveOrgLeadership({
        data: {
          email: d.email,
          org_role: d.org_role,
          state_id:
            d.org_role === "gme" || d.org_role === "mce" ? d.state_id : null,
          region_id:
            d.org_role === "mcr" || d.org_role === "oe" ? d.region_id : null,
        },
      }),
    onSuccess: () => {
      toast.success("Liderança salva");
      setDraft(null);
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

  if (!canManageOrg) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Apenas GME ou super administrador podem gerenciar lideranças.
      </Card>
    );
  }

  const needsRegion = draft?.org_role === "mcr" || draft?.org_role === "oe";
  const needsState = draft?.org_role === "gme" || draft?.org_role === "mce";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lideranças"
        subtitle="GME, MCE, MCR e Oficiais Executivos"
        actions={
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                ...EMPTY,
                state_id: scopeStateId && scopeStateId !== "00000000-0000-0000-0000-000000000000"
                  ? scopeStateId
                  : "",
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        }
      />

      {isLoading && (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma liderança cadastrada. A conta precisa existir no Auth antes
          (e-mail).
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((row) => (
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
            </div>
            <Switch
              checked={row.active}
              onCheckedChange={(v) =>
                toggle.mutate({ id: row.id, active: v })
              }
              aria-label="Liderança ativa"
            />
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova liderança</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="ld-email">E-mail da conta</Label>
                <Input
                  id="ld-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                  placeholder="pessoa@exemplo.com"
                />
              </div>
              <div>
                <Label>Cargo</Label>
                <Select
                  value={draft.org_role}
                  onValueChange={(v) =>
                    setDraft({ ...draft, org_role: v as OrgRoleName })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORG_ROLE_LABELS) as OrgRoleName[]).map(
                      (r) => (
                        <SelectItem key={r} value={r}>
                          {ORG_ROLE_LABELS[r]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              {needsState || needsRegion ? (
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={draft.state_id || undefined}
                    onValueChange={(v) =>
                      setDraft({ ...draft, state_id: v, region_id: "" })
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
              ) : null}
              {needsRegion ? (
                <div>
                  <Label>Região</Label>
                  <Select
                    value={draft.region_id || undefined}
                    onValueChange={(v) =>
                      setDraft({ ...draft, region_id: v })
                    }
                    disabled={!draft.state_id}
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
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !draft?.email ||
                (needsState && !draft.state_id) ||
                (needsRegion && !draft.region_id) ||
                save.isPending
              }
              onClick={() => draft && save.mutate(draft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
