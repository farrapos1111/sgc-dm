import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { consoleOverview } from "@/lib/console/console.functions";
import {
  AuditList,
  ConsoleTitle,
  REALM_DOT,
  REALM_NAMES,
  STAGE_INFO,
  StatCard,
} from "@/components/console/console-ui";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/console/_app/")({
  component: Overview,
});

function Overview() {
  const { data, isPending, error } = useQuery({
    queryKey: ["console", "overview"],
    queryFn: () => consoleOverview(),
  });

  if (isPending) return <PageSkeleton />;
  if (error || !data) return <p className="text-sm text-destructive">{String(error)}</p>;

  const pending = (data.byStage.novo ?? 0) + (data.byStage.em_contato ?? 0);

  return (
    <div>
      <ConsoleTitle title="Visão geral" subtitle="A plataforma inteira, num relance." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Instituições" value={data.totalChapters} />
        <StatCard label="Contas" value={data.totalAccounts} />
        <StatCard label="Pedidos em aberto" value={pending} hint="Novos + em contato" />
        <StatCard
          label="E-mails de pedido com falha"
          value={data.failedEmails}
          hint={data.failedEmails ? "Confira em Pedidos" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Instituições por esfera</h2>
          <ul className="space-y-3">
            {Object.entries(data.byRealm)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([realm, v]) => (
                <li key={realm} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${REALM_DOT[realm] ?? REALM_DOT.outros}`}
                    />
                    {REALM_NAMES[realm] ?? realm}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <strong className="text-foreground">{v.active}</strong> ativas · {v.total} no
                    total
                  </span>
                </li>
              ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Funil de pedidos</h2>
            <Link
              to="/console/pedidos"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Abrir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {(Object.keys(STAGE_INFO) as (keyof typeof STAGE_INFO)[]).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_INFO[s].className}`}
                >
                  {STAGE_INFO[s].label}
                </span>
                <span className="tabular-nums">{data.byStage[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Atividade recente no Console</h2>
          <Link
            to="/console/auditoria"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <AuditList items={data.recentAudit} />
      </Card>
    </div>
  );
}
