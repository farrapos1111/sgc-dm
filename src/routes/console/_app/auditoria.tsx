import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { consoleListAudit } from "@/lib/console/console.functions";
import { AuditList, ConsoleTitle } from "@/components/console/console-ui";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/console/_app/auditoria")({
  component: AuditPage,
});

function AuditPage() {
  const { data, isPending } = useQuery({
    queryKey: ["console", "audit"],
    queryFn: () => consoleListAudit({ data: { limit: 300 } }),
  });
  if (isPending) return <PageSkeleton />;
  return (
    <div>
      <ConsoleTitle
        title="Auditoria"
        subtitle="Tudo o que foi feito pelo Console, do mais recente ao mais antigo."
      />
      <Card className="px-5 py-2">
        <AuditList items={data?.items ?? []} />
      </Card>
    </div>
  );
}
