import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOngoing, setAttendance } from "@/lib/attendance.functions";
import { MinutesPanel } from "@/components/minutes/MinutesPanel";
import {
  TYPE_META,
  supportsAttendance,
  supportsMinutes,
  type CalendarType,
} from "@/lib/calendar-types";
import { canManageAttendanceAccess } from "@/lib/permissions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { formatDateTimeBR } from "@/lib/format";
import { useOngoingRealtime } from "@/hooks/useOngoingRealtime";
import { ArrowLeft, Check, Radio, Search, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/ongoing/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "ata" ? ("ata" as const) : ("chamada" as const),
  }),
  head: () => ({
    meta: [
      { title: "Sessão em andamento — Templo Virtual" },
      {
        name: "description",
        content: "Chamada de presenças e ata da sessão em tempo real.",
      },
    ],
  }),
  component: OngoingPage,
});

const ongoingQO = (id: string) =>
  queryOptions({
    queryKey: ["ongoing", id],
    queryFn: () => getOngoing({ data: { calendarEventId: id } }),
  });

function OngoingPage() {
  const { id } = Route.useParams();
  const { tab: searchTab } = Route.useSearch();
  const { active } = useActiveChapter();
  const { ctx } = useChapterAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(ongoingQO(id));
  const [search, setSearch] = useState("");
  const hasAttendance = supportsAttendance(
    (data.item as { event_type: string }).event_type,
  );
  const hasAta = supportsMinutes(
    (data.item as { event_type: string }).event_type,
  );
  const [tab, setTab] = useState<"chamada" | "ata">(() =>
    hasAta && searchTab === "ata" ? "ata" : "chamada",
  );
  const flushAtaSaveRef = useRef<(() => Promise<void>) | null>(null);

  async function flushAtaBeforeLeave() {
    try {
      await flushAtaSaveRef.current?.();
      return true;
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao salvar rascunho da ata",
      );
      return false;
    }
  }

  async function leaveWithAtaFlush(to: "/atas" | "/presencas") {
    if (tab === "ata") {
      const ok = await flushAtaBeforeLeave();
      if (!ok) return;
    }
    navigate({ to });
  }

  const allowed = canManageAttendanceAccess(ctx);
  const item = data.item as {
    chapter_id: string;
    title: string;
    event_type: string;
    start_at: string;
    mandatory: boolean;
    location: string | null;
    address?: string | null;
  };

  const { live } = useOngoingRealtime({
    calendarEventId: id,
    chapterId: item.chapter_id,
    enabled: allowed && hasAttendance,
  });

  type OngoingRecord = {
    member_id: string;
    status: string;
    justification: string | null;
  };

  const recordMap = useMemo(() => {
    const m = new Map<
      string,
      { status: string; justification: string | null }
    >();
    for (const r of data.records as OngoingRecord[]) m.set(r.member_id, r);
    return m;
  }, [data.records]);

  type OngoingCache = {
    records: OngoingRecord[];
    [key: string]: unknown;
  };

  const mark = useMutation({
    mutationFn: (v: {
      memberId: string;
      status: "presente" | "ausente" | null;
      justification?: string | null;
    }) =>
      setAttendance({
        data: {
          chapterId: item.chapter_id,
          calendarEventId: id,
          memberId: v.memberId,
          status: v.status,
          justification:
            v.status === null
              ? null
              : (v.justification ??
                recordMap.get(v.memberId)?.justification ??
                null),
        },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["ongoing", id] });
      const prev = qc.getQueryData<OngoingCache>(["ongoing", id]);
      const justification =
        v.status === null
          ? null
          : (v.justification ??
            recordMap.get(v.memberId)?.justification ??
            null);
      qc.setQueryData<OngoingCache>(["ongoing", id], (old) => {
        if (!old) return old;
        const records = [...(old.records ?? [])];
        const idx = records.findIndex((r) => r.member_id === v.memberId);
        if (v.status === null) {
          if (idx >= 0) records.splice(idx, 1);
        } else if (idx >= 0) {
          records[idx] = {
            ...records[idx],
            status: v.status,
            justification,
          };
        } else {
          records.push({
            member_id: v.memberId,
            status: v.status,
            justification,
          });
        }
        return { ...old, records };
      });
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["ongoing", id], ctx.prev);
      toast.error(e instanceof Error ? e.message : "Erro ao marcar presença");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["ongoing", id] });
    },
  });

  if (!hasAttendance && !hasAta) {
    return (
      <div>
        <PageHeader
          title={item.title}
          subtitle="Sindicância — sem chamada de presença nem ata de sessão."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/sindicancias/sindicarias">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar às sindicâncias
              </Link>
            </Button>
          }
        />
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          A ata desta sindicância é preenchida no módulo{" "}
          <Link
            to="/sindicancias/sindicarias"
            className="font-medium text-foreground underline"
          >
            Sindicâncias
          </Link>
          .
        </Card>
      </div>
    );
  }

  function toggleMark(memberId: string, status: "presente" | "ausente") {
    const current = recordMap.get(memberId)?.status;
    mark.mutate({
      memberId,
      status: current === status ? null : status,
    });
  }

  if (!allowed) {
    return (
      <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
        Você não tem permissão para conduzir a chamada desta sessão.
      </Card>
    );
  }

  const meta = TYPE_META[item.event_type as CalendarType];
  type OngoingMember = { id: string; full_name: string };
  const allMembers = data.members as OngoingMember[];
  const allRecords = data.records as OngoingRecord[];
  const members = allMembers.filter((m) =>
    m.full_name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const eligibleIds = new Set(allMembers.map((m) => m.id));
  const presentes = allRecords.filter(
    (r) => r.status === "presente" && eligibleIds.has(r.member_id),
  ).length;
  const ausentes = allRecords.filter(
    (r) => r.status === "ausente" && eligibleIds.has(r.member_id),
  ).length;
  const pendentes = allMembers.length - presentes - ausentes;

  return (
    <div>
      <PageHeader
        title={item.title}
        subtitle={`${meta?.label ?? item.event_type} · ${formatDateTimeBR(item.start_at)}${item.mandatory ? " · Obrigatório" : " · Facultativo"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                title="Presenças e ata sincronizam em tempo real"
              >
                <Radio className="h-3 w-3 animate-pulse" />
                Ao vivo
              </span>
            ) : null}
            <Button
              variant="outline"
              onClick={() =>
                void leaveWithAtaFlush(
                  tab === "ata" && hasAta ? "/atas" : "/presencas",
                )
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tab === "ata" && hasAta ? "Atas" : "Presenças"}
            </Button>
          </div>
        }
      />

      {tab !== "ata" ? (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Counter label="Presentes" value={presentes} color="#047857" />
          <Counter label="Ausentes" value={ausentes} color="#B91C1C" />
          <Counter
            label="Pendentes"
            value={Math.max(0, pendentes)}
            color="#6B6B6B"
          />
        </div>
      ) : null}

      <Tabs
        value={hasAta ? tab : "chamada"}
        onValueChange={(v) => {
          if (v !== "ata" && v !== "chamada") return;
          if (tab === "ata" && v === "chamada") {
            void (async () => {
              const ok = await flushAtaBeforeLeave();
              if (!ok) return;
              setTab(v);
            })();
            return;
          }
          setTab(v);
        }}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="chamada">Chamada</TabsTrigger>
          {hasAta ? <TabsTrigger value="ata">Ata</TabsTrigger> : null}
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
                <li className="p-5 text-sm text-muted-foreground">
                  Nenhum membro elegível nesta data (iniciação / Senior).
                </li>
              )}
              {members.map((m) => {
                const rec = recordMap.get(m.id);
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
                        <span className="min-w-0 truncate text-sm font-medium">
                          {m.full_name}
                        </span>
                      </span>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          aria-label={
                            rec?.status === "presente"
                              ? "Desmarcar presente"
                              : "Presente"
                          }
                          aria-pressed={rec?.status === "presente"}
                          onClick={() => toggleMark(m.id, "presente")}
                          className="grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#047857] hover:bg-[#ECFDF5] hover:text-[#047857] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 active:translate-y-0 active:scale-95"
                          style={
                            rec?.status === "presente"
                              ? {
                                  backgroundColor: "#D1FAE5",
                                  borderColor: "#047857",
                                  color: "#047857",
                                  boxShadow: "0 0 0 3px rgba(4,120,87,0.12)",
                                }
                              : {
                                  borderColor: "var(--border)",
                                  color: "var(--muted-foreground)",
                                }
                          }
                        >
                          <Check
                            className={`h-5 w-5 transition-transform duration-200 ${
                              rec?.status === "presente"
                                ? "scale-110"
                                : "group-hover:scale-105"
                            }`}
                          />
                        </button>
                        <button
                          aria-label={
                            rec?.status === "ausente"
                              ? "Desmarcar ausente"
                              : "Ausente"
                          }
                          aria-pressed={rec?.status === "ausente"}
                          onClick={() => toggleMark(m.id, "ausente")}
                          className="grid h-11 w-11 place-items-center rounded-[8px] border transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#B91C1C] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]/40 active:translate-y-0 active:scale-95"
                          style={
                            rec?.status === "ausente"
                              ? {
                                  backgroundColor: "#FEE2E2",
                                  borderColor: "#B91C1C",
                                  color: "#B91C1C",
                                  boxShadow: "0 0 0 3px rgba(185,28,28,0.12)",
                                }
                              : {
                                  borderColor: "var(--border)",
                                  color: "var(--muted-foreground)",
                                }
                          }
                        >
                          <X
                            className={`h-5 w-5 transition-transform duration-200 ${
                              rec?.status === "ausente"
                                ? "scale-110"
                                : "group-hover:scale-105"
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
              Este item é facultativo: as presenças ficam registradas, mas não
              impactam a frequência.
            </p>
          )}
        </TabsContent>

        {hasAta ? (
          <TabsContent value="ata">
            <MinutesPanel
              chapterId={item.chapter_id}
              calendarEventId={id}
              item={{
                title: item.title,
                start_at: item.start_at,
                location: item.location,
                address: item.address ?? null,
              }}
              minutes={(data.minutes as any) ?? null}
              roleName={active?.role.name ?? null}
              flushSaveRef={flushAtaSaveRef}
              onChanged={() =>
                qc.invalidateQueries({ queryKey: ["ongoing", id] })
              }
              onDeleted={() => navigate({ to: "/atas" })}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <div className="mt-4 text-xs text-muted-foreground">
        {tab === "ata" && hasAta ? (
          <Link
            to="/atas"
            style={{ color: "var(--chapter-primary)" }}
            onClick={(e) => {
              e.preventDefault();
              void leaveWithAtaFlush("/atas");
            }}
          >
            Ver módulo de Atas
          </Link>
        ) : (
          <Link to="/presencas" style={{ color: "var(--chapter-primary)" }}>
            Ver módulo de Presenças
          </Link>
        )}
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="rounded-[12px] p-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}
