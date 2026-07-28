import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOngoing, setAttendance } from "@/lib/attendance.functions";
import { MinutesPanel } from "@/components/minutes/MinutesPanel";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import { canManageAttendance } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";
import { ArrowLeft, Check, Loader2, Search, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/ongoing/$id")({
  head: () => ({
    meta: [
      { title: "Sessão em andamento — SG-CDM" },
      { name: "description", content: "Chamada de presenças e ata da sessão em tempo real." },
    ],
  }),
  component: OngoingPage,
});

const ongoingQO = (id: string) =>
  queryOptions({
    queryKey: ["ongoing", id],
    queryFn: () => getOngoing({ data: { calendarEventId: id } }),
    refetchInterval: 30_000,
  });

function OngoingPage() {
  const { id } = Route.useParams();
  const { active } = useActiveChapter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(ongoingQO(id));
  const [search, setSearch] = useState("");

  const allowed = canManageAttendance(active?.role.name);
  const item = data.item as any;

  const recordMap = useMemo(() => {
    const m = new Map<string, { status: string; justification: string | null }>();
    for (const r of data.records as any[]) m.set(r.member_id, r);
    return m;
  }, [data.records]);

  const mark = useMutation({
    mutationFn: (v: { memberId: string; status: "presente" | "ausente"; justification?: string | null }) =>
      setAttendance({
        data: {
          chapterId: item.chapter_id,
          calendarEventId: id,
          memberId: v.memberId,
          status: v.status,
          justification: v.justification ?? recordMap.get(v.memberId)?.justification ?? null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ongoing", id] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar"),
  });

  if (!allowed) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Você não tem permissão para conduzir a chamada desta sessão.
      </Card>
    );
  }

  const meta = TYPE_META[item.event_type as CalendarType];
  const members = (data.members as any[]).filter((m) =>
    m.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const presentes = (data.records as any[]).filter((r) => r.status === "presente").length;
  const ausentes = (data.records as any[]).filter((r) => r.status === "ausente").length;
  const pendentes = (data.members as any[]).length - presentes - ausentes;

  return (
    <div>
      <PageHeader
        title={item.title}
        subtitle={`${meta?.label ?? item.event_type} · ${formatDateTimeBR(item.start_at)}${item.mandatory ? " · Obrigatório" : " · Facultativo"}`}
        actions={
          <Button variant="outline" onClick={() => navigate({ to: "/calendario" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Calendário
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Counter label="Presentes" value={presentes} color="#047857" />
        <Counter label="Ausentes" value={ausentes} color="#B91C1C" />
        <Counter label="Pendentes" value={Math.max(0, pendentes)} color="#6B6B6B" />
      </div>

      <Tabs defaultValue="chamada">
        <TabsList className="mb-4">
          <TabsTrigger value="chamada">Chamada</TabsTrigger>
          <TabsTrigger value="ata">Ata</TabsTrigger>
        </TabsList>

        <TabsContent value="chamada">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar membro…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Card className="rounded-[12px] p-0">
            <ul className="divide-y divide-border">
              {members.length === 0 && (
                <li className="p-5 text-sm text-muted-foreground">Nenhum membro ativo encontrado.</li>
              )}
              {members.map((m) => {
                const rec = recordMap.get(m.id);
                const pendingThis = mark.isPending && mark.variables?.memberId === m.id;
                return (
                  <li
                    key={m.id}
                    className="group p-3 transition-colors duration-200"
                    style={{
                      backgroundColor:
                        rec?.status === "presente"
                          ? "rgba(4,120,87,0.05)"
                          : rec?.status === "ausente"
                            ? "rgba(185,28,28,0.05)"
                            : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full transition-colors duration-200"
                          style={{
                            backgroundColor:
                              rec?.status === "presente"
                                ? "#047857"
                                : rec?.status === "ausente"
                                  ? "#B91C1C"
                                  : "var(--border)",
                          }}
                        />
                        <span className="min-w-0 truncate text-sm font-medium">{m.full_name}</span>
                        {pendingThis && (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        )}
                      </span>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          aria-label="Presente"
                          aria-pressed={rec?.status === "presente"}
                          disabled={pendingThis}
                          onClick={() => mark.mutate({ memberId: m.id, status: "presente" })}
                          className="grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#047857] hover:bg-[#ECFDF5] hover:text-[#047857] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 active:translate-y-0 active:scale-95 disabled:opacity-60"
                          style={
                            rec?.status === "presente"
                              ? {
                                  backgroundColor: "#D1FAE5",
                                  borderColor: "#047857",
                                  color: "#047857",
                                  boxShadow: "0 0 0 3px rgba(4,120,87,0.12)",
                                }
                              : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                          }
                        >
                          <Check
                            className={`h-5 w-5 transition-transform duration-200 ${
                              rec?.status === "presente" ? "scale-110" : "group-hover:scale-105"
                            }`}
                          />
                        </button>
                        <button
                          aria-label="Ausente"
                          aria-pressed={rec?.status === "ausente"}
                          disabled={pendingThis}
                          onClick={() => mark.mutate({ memberId: m.id, status: "ausente" })}
                          className="grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]/40 active:translate-y-0 active:scale-95 disabled:opacity-60"
                          style={
                            rec?.status === "ausente"
                              ? {
                                  backgroundColor: "#FEE2E2",
                                  borderColor: "#B91C1C",
                                  color: "#B91C1C",
                                  boxShadow: "0 0 0 3px rgba(185,28,28,0.12)",
                                }
                              : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                          }
                        >
                          <X
                            className={`h-5 w-5 transition-transform duration-200 ${
                              rec?.status === "ausente" ? "scale-110" : "group-hover:scale-105"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                    {rec?.status === "ausente" && (
                      <Input
                        className="mt-2 h-9 animate-fade-in text-xs"
                        placeholder="Justificativa (opcional)"
                        defaultValue={rec.justification ?? ""}
                        onBlur={(e) =>
                          mark.mutate({
                            memberId: m.id,
                            status: "ausente",
                            justification: e.target.value.trim() || null,
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}

            </ul>
          </Card>
          {!item.mandatory && (
            <p className="mt-3 text-xs text-muted-foreground">
              Este item é facultativo: as presenças ficam registradas, mas não impactam a frequência.
            </p>
          )}
        </TabsContent>

        <TabsContent value="ata">
          <MinutesPanel
            chapterId={item.chapter_id}
            calendarEventId={id}
            item={{ title: item.title, start_at: item.start_at, location: item.location, address: (item as any).address ?? null }}
            minutes={(data.minutes as any) ?? null}
            roleName={active?.role.name ?? null}
            onChanged={() => qc.invalidateQueries({ queryKey: ["ongoing", id] })}
          />
        </TabsContent>

      </Tabs>

      <div className="mt-4 text-xs text-muted-foreground">
        <Link to="/presencas" style={{ color: "var(--chapter-primary)" }}>
          Ver módulo de Presenças
        </Link>
      </div>
    </div>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="rounded-[12px] p-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
