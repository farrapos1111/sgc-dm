import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { listEvents } from "@/lib/events.functions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, PlusCircle } from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/eventos/")({
  head: () => ({ meta: [{ title: "Eventos — SG-CDM" }] }),
  component: EventosList,
});

const eventsQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["events", chapterId],
    queryFn: () => listEvents({ data: { chapterId } }),
  });

function EventosList() {
  const { active } = useActiveChapter();
  if (!active) return null;
  const { data: events } = useSuspenseQuery(eventsQO(active.chapter_id));

  return (
    <div>
      <PageHeader
        title="Eventos"
        subtitle={`${events.length} ${events.length === 1 ? "evento" : "eventos"} cadastrados`}
        actions={
          <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
            <Link to="/eventos/novo">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo evento
            </Link>
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-7 w-7" />}
          title="Nenhum evento ainda"
          description="Crie o primeiro evento do seu capítulo."
          action={
            <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
              <Link to="/eventos/novo">
                <PlusCircle className="mr-2 h-4 w-4" /> Criar evento
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {events.map((e) => {
            const pct = e.goal_amount > 0 ? Math.min(100, (Number(e.raised) / Number(e.goal_amount)) * 100) : 0;
            return (
              <Link key={e.id} to="/eventos/$id" params={{ id: e.id }}>
                <Card className="rounded-[12px] p-5 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTimeBR(e.starts_at)}</div>
                    </div>
                    <Badge variant="secondary" className="capitalize shrink-0">
                      {e.status}
                    </Badge>
                  </div>
                  {e.goal_amount > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatBRL(Number(e.raised))}</span>
                        <span>Meta: {formatBRL(Number(e.goal_amount))}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    {e.tickets_sold} {e.tickets_sold === 1 ? "ingresso vendido" : "ingressos vendidos"}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
