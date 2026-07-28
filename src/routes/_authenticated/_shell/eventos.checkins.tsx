import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { formatDateTimeBR } from "@/lib/format";
import { listCheckins } from "@/lib/hospitality.functions";

export const Route = createFileRoute("/_authenticated/_shell/eventos/checkins")({
  head: () => ({
    meta: [
      { title: "Check-ins — SG-CDM" },
      { name: "description", content: "Histórico de check-ins dos eventos do capítulo." },
    ],
  }),
  component: Checkins,
});

function Checkins() {
  const { active } = useActiveChapter();
  const [eventId, setEventId] = useState("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["checkins", active?.chapter_id],
    enabled: !!active,
    queryFn: () => listCheckins({ data: { chapterId: active!.chapter_id } }),
  });

  const events = data?.events ?? [];
  const checkins = data?.checkins ?? [];
  const eventName = useMemo(
    () => new Map(events.map((e) => [e.id, e.name])),
    [events],
  );
  const visible = checkins.filter((c) => eventId === "todos" || c.event_id === eventId);

  return (
    <div>
      <PageHeader title="Check-ins" subtitle="Entradas registradas nos eventos do capítulo." />

      <div className="mb-4">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os eventos</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-7 w-7" />}
          title="Nenhum check-in registrado"
          description="Os check-ins feitos por QR code ou busca aparecerão aqui."
        />
      ) : (
        <Card className="divide-y divide-border rounded-[12px]">
          {visible.map((c) => {
            const ticket = c.ticket as unknown as { buyer_name: string } | null;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{ticket?.buyer_name ?? "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {eventName.get(c.event_id) ?? "—"} · {formatDateTimeBR(c.checked_in_at)}
                  </div>
                </div>
                <Badge variant="secondary">{c.method === "qr" ? "QR" : "Busca"}</Badge>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
