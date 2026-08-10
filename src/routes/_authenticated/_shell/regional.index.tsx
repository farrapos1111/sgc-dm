import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Building2,
  Users,
  CalendarDays,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { listScopeChapters } from "@/lib/org.functions";
import {
  ORG_TYPES,
  ORG_TYPE_LABELS,
  compareOrgNumbers,
  normalizeOrgType,
} from "@/lib/org-types";
import { matchesLooseSearch } from "@/lib/utils";
import { ChapterLogoAvatar } from "@/components/ChapterLogoAvatar";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeBR } from "@/lib/format";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";

export const Route = createFileRoute("/_authenticated/_shell/regional/")({
  component: RegionalPanorama,
  head: () => ({
    meta: [
      { title: "Panorama regional | Templo Virtual" },
      {
        name: "description",
        content:
          "Panorama das instituições da região ou do estado: membros ativos e próximas atividades.",
      },
      { property: "og:title", content: "Panorama regional | Templo Virtual" },
      {
        property: "og:description",
        content: "Acompanhe as instituições do seu escopo em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SortKey = "numero" | "tipo" | "nome";

export function ScopeGuard({ children }: { children: React.ReactNode }) {
  const { activeScope, loading } = useOrgScope();
  if (loading)
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!activeScope)
    return (
      <Card className="flex items-center gap-3 rounded-[12px] p-5 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        Selecione um escopo regional ou estadual no seletor acima.
      </Card>
    );
  return <>{children}</>;
}

function RegionalPanorama() {
  return (
    <ScopeGuard>
      <PanoramaContent />
    </ScopeGuard>
  );
}

function PanoramaContent() {
  const { activeScope } = useOrgScope();
  const scope = activeScope!;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("numero");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () =>
      listScopeChapters({
        data: { scopeType: scope.type, scopeId: scope.id },
      }),
  });

  const chapters = data ?? [];
  const totalActive = chapters.reduce((s, c) => s + c.active_members, 0);

  const visible = useMemo(() => {
    const q = search.trim();
    const filtered = q
      ? chapters.filter((c) => {
          const orgType = normalizeOrgType(
            (c as { org_type?: string | null }).org_type,
          );
          if (matchesLooseSearch(c.name, q)) return true;
          if (matchesLooseSearch(c.number, q)) return true;
          if (c.city && matchesLooseSearch(c.city, q)) return true;
          if (c.region_name && matchesLooseSearch(c.region_name, q)) return true;
          if (matchesLooseSearch(ORG_TYPE_LABELS[orgType], q)) return true;
          return false;
        })
      : chapters;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "numero") {
        const cmp = compareOrgNumbers(a.number, b.number);
        if (cmp !== 0) return cmp * dir;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * dir;
      }
      if (sortKey === "tipo") {
        const at = normalizeOrgType(
          (a as { org_type?: string | null }).org_type,
        );
        const bt = normalizeOrgType(
          (b as { org_type?: string | null }).org_type,
        );
        const ai = ORG_TYPES.indexOf(at);
        const bi = ORG_TYPES.indexOf(bt);
        if (ai !== bi) return (ai - bi) * dir;
        const byNum = compareOrgNumbers(a.number, b.number);
        if (byNum !== 0) return byNum * dir;
        return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) * dir;
      }
      const byName = a.name.localeCompare(b.name, "pt-BR", {
        sensitivity: "base",
      });
      if (byName !== 0) return byName * dir;
      return compareOrgNumbers(a.number, b.number) * dir;
    });
  }, [chapters, search, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Panorama"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={Building2}
          label="Instituições"
          value={String(chapters.length)}
        />
        <MetricCard
          icon={Users}
          label="Membros ativos"
          value={String(totalActive)}
        />
        <MetricCard
          icon={CalendarDays}
          label="Com atividade agendada"
          value={String(chapters.filter((c) => c.next_item).length)}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 pr-9"
            placeholder="Buscar por nome, número, tipo ou cidade…"
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
            <SelectItem value="numero">Número</SelectItem>
            <SelectItem value="tipo">Tipo</SelectItem>
            <SelectItem value="nome">Nome</SelectItem>
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

      {isLoading && (
        <div className="text-sm text-muted-foreground">
          Carregando instituições…
        </div>
      )}

      {!isLoading && chapters.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma instituição vinculada a este escopo ainda.
        </Card>
      )}

      {!isLoading && chapters.length > 0 && visible.length === 0 && (
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Nenhuma instituição encontrada com essa busca.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((c) => {
          const orgType = normalizeOrgType(
            (c as { org_type?: string | null }).org_type,
          );
          return (
            <Card key={c.id} className="rounded-[12px] p-4">
              <div className="flex items-start gap-3">
                <ChapterLogoAvatar
                  logoPath={c.logo_url}
                  number={c.number}
                  color={c.primary_color}
                  className="h-10 w-10 rounded-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {c.name}
                    </span>
                    {!c.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ORG_TYPE_LABELS[orgType]} · Nº {c.number}
                    {c.city ? ` · ${c.city}` : ""}
                    {c.region_name ? ` · ${c.region_name}` : ""}
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-medium">{c.active_members}</span>{" "}
                    <span className="text-muted-foreground">
                      membros ativos de {c.total_members}
                    </span>
                  </div>
                  {c.next_item ? (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor:
                            TYPE_META[c.next_item.event_type as CalendarType]
                              .bg,
                          color:
                            TYPE_META[c.next_item.event_type as CalendarType]
                              .color,
                        }}
                      >
                        {
                          TYPE_META[c.next_item.event_type as CalendarType]
                            .label
                        }
                      </span>
                      <span className="truncate">{c.next_item.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatDateTimeBR(c.next_item.start_at)}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Nenhuma atividade agendada
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          to="/regional/calendario"
          className="rounded-[8px] border border-border px-3 py-2 hover:bg-muted"
        >
          Ver calendário unificado
        </Link>
        <Link
          to="/regional/membros"
          className="rounded-[8px] border border-border px-3 py-2 hover:bg-muted"
        >
          Buscar membros do escopo
        </Link>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-[12px] p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
