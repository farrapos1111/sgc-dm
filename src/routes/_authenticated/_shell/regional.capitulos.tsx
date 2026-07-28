import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope } from "@/context/OrgScopeContext";
import { listRegions, listScopeChapters, saveChapter, setChapterActive } from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/_shell/regional/capitulos")({
  component: ManageChapters,
  head: () => ({
    meta: [
      { title: "Gestão de instituições | SG-CDM" },
      {
        name: "description",
        content: "Cadastro e edição das instituições do estado: nome, número, cidade e região.",
      },
      { property: "og:title", content: "Gestão de instituições | SG-CDM" },
      {
        property: "og:description",
        content: "Grande Mestre Estadual gerencia instituições e suas regiões.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = {
  id?: string;
  name: string;
  number: string;
  city: string;
  region_id: string | null;
};

const EMPTY: Draft = { name: "", number: "", city: "", region_id: null };

function ManageChapters() {
  return (
    <ScopeGuard>
      <ChaptersContent />
    </ScopeGuard>
  );
}

function ChaptersContent() {
  const { activeScope, leaderships } = useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const stateId =
    leaderships.find((l) => l.org_role === "gme")?.state_id ??
    leaderships.find((l) => (l.region_id ?? l.state_id) === scope.id)?.state_id ??
    null;
  const canManage = leaderships.some((l) => l.org_role === "gme");

  const { data: chapters, isLoading } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () => listScopeChapters({ data: { scopeType: scope.type, scopeId: scope.id } }),
  });

  const { data: regions } = useQuery({
    queryKey: ["regions", stateId],
    queryFn: () => listRegions({ data: { stateId: stateId! } }),
    enabled: !!stateId,
  });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveChapter({
        data: {
          id: d.id,
          state_id: stateId!,
          region_id: d.region_id,
          name: d.name,
          number: d.number,
          city: d.city || null,
        },
      }),
    onSuccess: () => {
      toast.success("Instituição salva");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["scope-chapters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setChapterActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope-chapters"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Apenas o Grande Mestre Estadual pode gerenciar instituições.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Instituições"
        subtitle={scope.label}
        actions={
          <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        }
      />

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      <div className="space-y-2">
        {(chapters ?? []).map((c) => (
          <Card key={c.id} className="flex items-center gap-3 rounded-[12px] p-4">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xs font-bold text-white"
              style={{ backgroundColor: c.primary_color || "#9E1B32" }}
            >
              {c.number.slice(-3)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                Nº {c.number}
                {c.city ? ` · ${c.city}` : ""}
                {c.region_name ? ` · ${c.region_name}` : " · sem região"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={c.active}
                onCheckedChange={(v) => toggleActive.mutate({ id: c.id, active: v })}
                aria-label="Instituição ativa"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({
                    id: c.id,
                    name: c.name,
                    number: c.number,
                    city: c.city ?? "",
                    region_id: c.region_id,
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar instituição" : "Nova instituição"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="ch-name">Nome</Label>
                <Input
                  id="ch-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ch-number">Número</Label>
                  <Input
                    id="ch-number"
                    value={draft.number}
                    onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ch-city">Cidade</Label>
                  <Input
                    id="ch-city"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Região</Label>
                <Select
                  value={draft.region_id ?? "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, region_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem região</SelectItem>
                    {(regions ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!draft?.name || !draft?.number || !stateId || save.isPending}
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
