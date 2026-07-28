import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { listScopeChapters, listScopeMembers } from "@/lib/org.functions";
import { ScopeGuard } from "./regional.index";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_shell/regional/membros")({
  component: RegionalMembers,
  head: () => ({
    meta: [
      { title: "Membros do escopo | SG-CDM" },
      {
        name: "description",
        content: "Consulta de membros das instituições da região ou do estado, somente leitura.",
      },
      { property: "og:title", content: "Membros do escopo | SG-CDM" },
      {
        property: "og:description",
        content: "Busque membros de todas as instituições sob sua liderança.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  senior: "Senior",
  macom: "Maçom",
};

function RegionalMembers() {
  return (
    <ScopeGuard>
      <MembersContent />
    </ScopeGuard>
  );
}

function MembersContent() {
  const { activeScope } = useOrgScope();
  const scope = activeScope!;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "ativo" | "inativo" | "senior" | "macom">("all");
  const [chapterId, setChapterId] = useState<string | null>(null);

  const { data: chapters } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () => listScopeChapters({ data: { scopeType: scope.type, scopeId: scope.id } }),
  });
  const chapterList = chapters ?? [];
  const ids = chapterId ? [chapterId] : chapterList.map((c) => c.id);

  const { data: members, isLoading } = useQuery({
    queryKey: ["scope-members", scope.key, ids.join(","), search, status],
    queryFn: () => listScopeMembers({ data: { chapterIds: ids, search, status } }),
    enabled: ids.length > 0,
  });

  const rows = members ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Membros do escopo"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label} · somente leitura`}
      />

      <Card className="space-y-3 rounded-[12px] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "ativo", "senior", "macom", "inativo"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? "default" : "outline"}
              className="h-8 rounded-full text-xs"
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "Todos" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={chapterId === null ? "default" : "outline"}
            className="h-8 rounded-full text-xs"
            onClick={() => setChapterId(null)}
          >
            Todas as instituições
          </Button>
          {chapterList.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={chapterId === c.id ? "default" : "outline"}
              className="h-8 rounded-full text-xs"
              onClick={() => setChapterId(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </Card>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando membros…</div>}

      {!isLoading && rows.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhum membro encontrado com estes filtros.
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((m) => {
          const chapter = chapterList.find((c) => c.id === m.chapter_id);
          return (
            <Card key={m.id} className="flex items-center gap-3 rounded-[12px] p-3">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: chapter?.primary_color || "#9E1B32" }}
              >
                {m.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {chapter?.name ?? "—"}
                  {m.phone ? ` · ${m.phone}` : ""}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {STATUS_LABEL[m.status] ?? m.status}
              </span>
            </Card>
          );
        })}
      </div>
      {rows.length >= 500 && (
        <p className="text-xs text-muted-foreground">
          Exibindo os primeiros 500 resultados — refine a busca.
        </p>
      )}
    </div>
  );
}
