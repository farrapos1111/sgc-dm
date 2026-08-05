import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useOrgScope } from "@/context/OrgScopeContext";
import { listRegions, listScopeChapters, saveChapter, setChapterActive } from "@/lib/org.functions";
import { matchesLooseSearch } from "@/lib/utils";
import { ChapterLogoAvatar } from "@/components/ChapterLogoAvatar";
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

type SortKey = "nome" | "numero" | "cidade";

const EMPTY: Draft = { name: "", number: "", city: "", region_id: null };

function ManageChapters() {
  return (
    <ScopeGuard>
      <ChaptersContent />
    </ScopeGuard>
  );
}

function ChaptersContent() {
  const { activeScope, leaderships, canManageChapters, canManageOrg } =
    useOrgScope();
  const scope = activeScope!;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const regionScopeId = scope.type === "region" ? scope.id : null;

  const stateId =
    leaderships.find((l) => l.org_role === "gme" && l.state_id)?.state_id ??
    (scope.type === "state" ? scope.id : null) ??
    leaderships.find((l) => l.state_id)?.state_id ??
    null;

  const { data: chapters, isLoading } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () =>
      listScopeChapters({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
  });

  const { data: regions } = useQuery({
    queryKey: ["regions", stateId],
    queryFn: () => listRegions({ data: { stateId: stateId! } }),
    enabled: !!stateId && canManageOrg,
  });

  const resolvedStateId = stateId;

  const visible = useMemo(() => {
    const rows = chapters ?? [];
    const q = search.trim();
    const filtered = q
      ? rows.filter((c) => {
          if (matchesLooseSearch(c.name, q)) return true;
          if (matchesLooseSearch(c.number, q)) return true;
          if (c.city && matchesLooseSearch(c.city, q)) return true;
          if (c.region_name && matchesLooseSearch(c.region_name, q)) return true;
          return false;
        })
      : rows;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "numero") {
        const an = Number(a.number.replace(/\D/g, ""));
        const bn = Number(b.number.replace(/\D/g, ""));
        if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) {
          return (an - bn) * dir;
        }
        return a.number.localeCompare(b.number, "pt-BR", { numeric: true }) * dir;
      }
      const av = sortKey === "cidade" ? (a.city ?? "") : a.name;
      const bv = sortKey === "cidade" ? (b.city ?? "") : b.name;
      const cmp = av.localeCompare(bv, "pt-BR", { sensitivity: "base" });
      if (cmp !== 0) return cmp * dir;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * dir;
    });
  }, [chapters, search, sortKey, sortDir]);

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveChapter({
        data: {
          id: d.id,
          state_id: resolvedStateId!,
          region_id: regionScopeId ?? d.region_id,
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
    mutationFn: (v: { id: string; active: boolean }) =>
      setChapterActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scope-chapters"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManageChapters) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Apenas GME, Mestre Conselheiro Regional ou Oficial Executivo podem
        gerenciar instituições.
      </Card>
    );
  }

  if (!resolvedStateId) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Selecione um escopo estadual ou regional para gerenciar instituições.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Instituições"
        subtitle={scope.label}
        actions={
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                ...EMPTY,
                region_id: regionScopeId,
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Nova
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 pr-9"
            placeholder="Buscar por nome, número ou cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar instituições"
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
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger className="w-[7.5rem] sm:w-40">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome</SelectItem>
            <SelectItem value="numero">Número</SelectItem>
            <SelectItem value="cidade">Cidade</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Inverter ordenação"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? (
            <ArrowUpAZ className="h-4 w-4" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {!isLoading && visible.length === 0 && (
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          {(chapters ?? []).length === 0
            ? "Nenhuma instituição neste escopo."
            : "Nenhuma instituição encontrada com essa busca."}
        </Card>
      )}

      <div className="space-y-2">
        {visible.map((c) => (
          <Card key={c.id} className="flex items-center gap-3 rounded-[12px] p-4">
            <ChapterLogoAvatar
              logoPath={c.logo_url}
              number={c.number}
              color={c.primary_color}
              className="h-10 w-10 rounded-[10px]"
            />
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
              {canManageOrg && !regionScopeId ? (
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
              ) : (
                <p className="text-xs text-muted-foreground">
                  Região fixa do escopo: {scope.label}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !draft?.name ||
                !draft?.number ||
                !resolvedStateId ||
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

