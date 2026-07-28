import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, CalendarDays, AlertCircle } from "lucide-react";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { listScopeChapters } from "@/lib/org.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatDateTimeBR } from "@/lib/format";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";

export const Route = createFileRoute("/_authenticated/_shell/regional/")({
  component: RegionalPanorama,
  head: () => ({
    meta: [
      { title: "Panorama regional | SG-CDM" },
      {
        name: "description",
        content: "Panorama das instituições da região ou do estado: membros ativos e próximas atividades.",
      },
      { property: "og:title", content: "Panorama regional | SG-CDM" },
      {
        property: "og:description",
        content: "Acompanhe as instituições do seu escopo em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export function ScopeGuard({ children }: { children: React.ReactNode }) {
  const { activeScope, loading } = useOrgScope();
  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
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

  const { data, isLoading } = useQuery({
    queryKey: ["scope-chapters", scope.key],
    queryFn: () => listScopeChapters({ data: { scopeType: scope.type, scopeId: scope.id } }),
  });

  const chapters = data ?? [];
  const totalActive = chapters.reduce((s, c) => s + c.active_members, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Panorama"
        subtitle={`${ORG_ROLE_LABELS[scope.orgRole]} · ${scope.label}`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={Building2} label="Instituições" value={String(chapters.length)} />
        <MetricCard icon={Users} label="Membros ativos" value={String(totalActive)} />
        <MetricCard
          icon={CalendarDays}
          label="Com atividade agendada"
          value={String(chapters.filter((c) => c.next_item).length)}
        />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando instituições…</div>}

      {!isLoading && chapters.length === 0 && (
        <Card className="rounded-[12px] p-8 text-center text-sm text-muted-foreground">
          Nenhuma instituição vinculada a este escopo ainda.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {chapters.map((c) => (
          <Card key={c.id} className="rounded-[12px] p-4">
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xs font-bold text-white"
                style={{ backgroundColor: c.primary_color || "#9E1B32" }}
              >
                {c.number.slice(-3)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  {!c.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Nº {c.number}
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
                        backgroundColor: TYPE_META[c.next_item.event_type as CalendarType].bg,
                        color: TYPE_META[c.next_item.event_type as CalendarType].color,
                      }}
                    >
                      {TYPE_META[c.next_item.event_type as CalendarType].label}
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
        ))}
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
