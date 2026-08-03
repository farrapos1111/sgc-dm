import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope } from "@/context/OrgScopeContext";
import { deleteRegion, listRegions, listScopeChapters, saveRegion } from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_shell/regional/regioes")({
  component: ManageRegions,
  head: () => ({
    meta: [
      { title: "Gestão de regiões | SG-CDM" },
      {
        name: "description",
        content: "Criação e edição das regiões do estado e das instituições vinculadas a cada uma.",
      },
      { property: "og:title", content: "Gestão de regiões | SG-CDM" },
      {
        property: "og:description",
        content: "Organize as regiões do estado e acompanhe suas instituições.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = { id?: string; name: string; code: string };

function ManageRegions() {
  return (
    <ScopeGuard>
      <RegionsContent />
    </ScopeGuard>
  );
}

function RegionsContent() {
  const { activeScope, leaderships, canManageOrg } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const gme = leaderships.find((l) => l.org_role === "gme" && l.state_id);
  const stateId =
    gme?.state_id ??
    (scope.type === "state" &&
    scope.id !== "00000000-0000-0000-0000-000000000000"
      ? scope.id
      : null);

  const { data: regions, isLoading } = useQuery({
    queryKey: ["regions", stateId],
    queryFn: () => listRegions({ data: { stateId: stateId! } }),
    enabled: !!stateId,
  });

  const { data: chapters } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () =>
      listScopeChapters({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveRegion({
        data: {
          id: d.id,
          state_id: stateId!,
          name: d.name,
          code: d.code || null,
        },
      }),
    onSuccess: () => {
      toast.success("Região salva");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRegion({ data: { id } }),
    onSuccess: () => {
      toast.success("Região removida");
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["scope-chapters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManageOrg) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Apenas o Grande Mestre Estadual ou super administrador podem gerenciar
        regiões.
      </Card>
    );
  }

  if (!stateId) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Cadastre um estado e selecione o escopo estadual para gerenciar regiões.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regiões"
        subtitle={gme?.state_name ?? scope.label}
        actions={
          <Button size="sm" onClick={() => setDraft({ name: "", code: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        }
      />

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {!isLoading && (regions ?? []).length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma região cadastrada.
        </Card>
      )}

      <div className="space-y-2">
        {(regions ?? []).map((r) => {
          const count = (chapters ?? []).filter((c) => c.region_id === r.id).length;
          return (
            <Card key={r.id} className="flex items-center gap-3 rounded-[12px] p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.code ? `${r.code} · ` : ""}
                  {count} instituição(ões)
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft({ id: r.id, name: r.name, code: r.code ?? "" })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={count > 0}
                title={count > 0 ? "Remova as instituições da região primeiro" : "Excluir região"}
                onClick={() => remove.mutate(r.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar região" : "Nova região"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="rg-name">Nome</Label>
                <Input
                  id="rg-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rg-code">Sigla / código</Label>
                <Input
                  id="rg-code"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!draft?.name || !stateId || save.isPending}
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
