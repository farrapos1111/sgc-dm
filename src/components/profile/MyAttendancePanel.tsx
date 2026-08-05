import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getMyMemberAttendance } from "@/lib/profile.functions";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import { formatDateTimeBR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MyAttendancePanel({ memberId }: { memberId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-attendance", memberId],
    queryFn: () => getMyMemberAttendance({ data: { memberId } }),
    enabled: !!memberId,
  });

  const attendance = data ?? [];

  const { mandatoryRecs, mandatoryPresent, mandatoryPct, rows } = useMemo(() => {
    const mandatory = attendance.filter(
      (r: any) => r.calendar_event?.mandatory,
    );
    const present = mandatory.filter((r: any) => r.status === "presente").length;
    const pct =
      mandatory.length === 0
        ? null
        : Math.round((present / mandatory.length) * 100);
    return {
      mandatoryRecs: mandatory,
      mandatoryPresent: present,
      mandatoryPct: pct,
      rows: attendance,
    };
  }, [attendance]);

  if (isLoading) {
    return (
      <Card className="flex justify-center rounded-[12px] p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[12px] p-5 text-sm text-destructive">
        {error instanceof Error ? error.message : "Erro ao carregar frequência"}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[12px] p-5">
        <div className="text-sm font-medium text-muted-foreground">
          Frequência em itens obrigatórios
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span
            className="text-3xl font-bold"
            style={{
              color:
                mandatoryPct === null
                  ? "var(--muted-foreground)"
                  : mandatoryPct >= 75
                    ? "#047857"
                    : "#B91C1C",
            }}
          >
            {mandatoryPct === null ? "—" : `${mandatoryPct}%`}
          </span>
          <span className="text-sm text-muted-foreground">
            {mandatoryPresent} de {mandatoryRecs.length} contabilizáveis
          </span>
        </div>
      </Card>

      <Card className="rounded-[12px] p-0">
        {rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">
            Nenhum registro de presença ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r: any) => {
              const ev = r.calendar_event;
              const meta = ev
                ? TYPE_META[ev.event_type as CalendarType]
                : undefined;
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {ev?.title ?? "Item removido"}
                    </span>
                    {meta ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: meta.bg,
                          color: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    ) : null}
                    <Badge variant={ev?.mandatory ? "default" : "secondary"}>
                      {ev?.mandatory ? "Contabilizável" : "Facultativo"}
                    </Badge>
                    <span
                      className="ml-auto text-xs font-semibold"
                      style={{
                        color:
                          r.status === "presente"
                            ? "#047857"
                            : r.status === "pendente"
                              ? "#D97706"
                              : "#B91C1C",
                      }}
                    >
                      {r.status === "presente"
                        ? "Presente"
                        : r.status === "pendente"
                          ? "Pendente"
                          : "Ausente"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTimeBR(ev?.start_at)}
                    {r.justification
                      ? ` · Justificativa: ${r.justification}`
                      : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
