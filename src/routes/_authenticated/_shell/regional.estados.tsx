import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope } from "@/context/OrgScopeContext";
import { deleteState, listStates, saveState } from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { useConfirmDialog } from "@/components/ConfirmDialog";
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

export const Route = createFileRoute("/_authenticated/_shell/regional/estados")({
  component: ManageStates,
  head: () => ({
    meta: [{ title: "Estados — SG-CDM" }],
  }),
});

type Draft = { id?: string; name: string; uf: string };

function ManageStates() {
  return (
    <ScopeGuard>
      <StatesContent />
    </ScopeGuard>
  );
}

function StatesContent() {
  const { isSuperAdmin } = useOrgScope();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: states, isLoading } = useQuery({
    queryKey: ["states"],
    queryFn: () => listStates(),
    enabled: isSuperAdmin,
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveState({ data: { id: d.id, name: d.name, uf: d.uf } }),
    onSuccess: () => {
      toast.success("Estado salvo");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["states"] });
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteState({ data: { id } }),
    onSuccess: () => {
      toast.success("Estado removido");
      qc.invalidateQueries({ queryKey: ["states"] });
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperAdmin) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Apenas o super administrador pode gerenciar estados.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estados"
        subtitle="Cadastro de jurisdições estaduais"
        actions={
          <Button size="sm" onClick={() => setDraft({ name: "", uf: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        }
      />

      {isLoading && (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      )}

      {!isLoading && (states ?? []).length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhum estado cadastrado. Crie o primeiro para organizar regiões e
          capítulos.
        </Card>
      )}

      <div className="space-y-2">
        {(states ?? []).map((s) => (
          <Card
            key={s.id}
            className="flex items-center gap-3 rounded-[12px] p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">UF {s.uf}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft({ id: s.id, name: s.name, uf: s.uf })
              }
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "Excluir estado?",
                  description: `Excluir o estado ${s.name}? Regiões vinculadas serão removidas em cascata.`,
                  confirmLabel: "Excluir",
                });
                if (ok) remove.mutate(s.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar estado" : "Novo estado"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="st-name">Nome</Label>
                <Input
                  id="st-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="st-uf">UF</Label>
                <Input
                  id="st-uf"
                  maxLength={2}
                  value={draft.uf}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      uf: e.target.value.toUpperCase().slice(0, 2),
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !draft?.name ||
                !draft?.uf ||
                draft.uf.length !== 2 ||
                save.isPending
              }
              onClick={() => draft && save.mutate(draft)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}
