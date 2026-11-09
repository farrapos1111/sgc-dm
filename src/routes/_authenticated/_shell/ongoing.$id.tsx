import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { useConfirmDialog } from "@/components/ConfirmDialog";
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
import {
  canManageAttendanceAccess,
  canViewAttendanceAccess,
} from "@/lib/permissions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { formatDateTimeBR } from "@/lib/format";
import { useOngoingRealtime } from "@/hooks/useOngoingRealtime";
import { ArrowLeft, Check, Plus, Radio, Search, X } from "lucide-react";
import { EMPTY_LIST } from "@/lib/utils";

type SessionMinute = {
  id: string;
  content: string;
  opened_at: string;
  updated_at: string;
  status: string;
  title: string | null;
  kind?: string | null;
  rejection_note?: string | null;
  rejected_at?: string | null;
};

const NEW_MINUTE_KEY = "__new__";

function minuteTabLabel(m: SessionMinute, index: number) {
  const title = m.title?.trim();
  return title || `Ata ${index + 1}`;
}
type OngoingSearch = {
  tab: "ata" | "chamada";
  minute?: string;
};

export const Route = createFileRoute("/_authenticated/_shell/ongoing/$id")({
  validateSearch: (search: Record<string, unknown>): OngoingSearch => {
    const result: OngoingSearch = {
      tab: search.tab === "ata" ? "ata" : "chamada",
    };
    if (typeof search.minute === "string" && search.minute.length > 0) {
      result.minute = search.minute;
    }
    return result;
  },
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
  const { tab: searchTab, minute: searchMinute } = Route.useSearch();
  const { active } = useActiveChapter();
  const { ctx, canScreen } = useChapterAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(ongoingQO(id));
  const [search, setSearch] = useState("");
  const [rollFilter, setRollFilter] = useState<"todos" | "sem_marcar">("todos");
  const { confirm: confirmFinish, dialog: finishDialog } = useConfirmDialog();
  const minutesList = (data.minutes as SessionMinute[]) ?? EMPTY_LIST;
  const canEditAtas = canScreen("atas", "edit");
  const [selectedMinuteKey, setSelectedMinuteKey] = useState<string>(() => {
    if (searchMinute && minutesList.some((m) => m.id === searchMinute)) {
      return searchMinute;
    }
    if (minutesList[0]?.id) return minutesList[0].id;
    return canEditAtas ? NEW_MINUTE_KEY : "";
  });

  useEffect(() => {
    if (selectedMinuteKey === NEW_MINUTE_KEY) {
      if (!canEditAtas) {
        setSelectedMinuteKey(minutesList[0]?.id ?? NEW_MINUTE_KEY);
      }
      return;
    }
    if (minutesList.some((m) => m.id === selectedMinuteKey)) return;
    setSelectedMinuteKey(minutesList[0]?.id ?? (canEditAtas ? NEW_MINUTE_KEY : ""));
  }, [minutesList, selectedMinuteKey, canEditAtas]);

  const selectedMinute =
    selectedMinuteKey === NEW_MINUTE_KEY
      ? null
      : (minutesList.find((m) => m.id === selectedMinuteKey) ?? null);

  const hasAttendance = supportsAttendance(
    (data.item as { event_type: string }).event_type,
  );
  const hasAta = supportsMinutes(
    (data.item as { event_type: string }).event_type,
  );
  const [tab, setTab] = useState<"chamada" | "ata">(() =>
    hasAta && searchTab === "ata" ? "ata" : "chamada",
  );
  // Só sessões e filantropia têm chamada; os demais itens com ata abrem na ata.
  const effectiveTab: "chamada" | "ata" = !hasAttendance
    ? "ata"
    : hasAta
      ? tab
      : "chamada";
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

  async function selectMinuteTab(key: string) {
    if (key === selectedMinuteKey) return;
    const ok = await flushAtaBeforeLeave();
    if (!ok) return;
    setSelectedMinuteKey(key);
  }

  async function leaveWithAtaFlush(to: "/atas" | "/presencas") {
    if (effectiveTab === "ata") {
      const ok = await flushAtaBeforeLeave();
      if (!ok) return;
    }
    navigate({ to });
  }

  const canView = canViewAttendanceAccess(ctx);
  const canManage = canManageAttendanceAccess(ctx);
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
    enabled: canView && hasAttendance,
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
    if (item.event_type !== "sindicancia") {
      return (
        <div>
          <PageHeader
            title={item.title}
            subtitle={`${TYPE_META[item.event_type as CalendarType]?.label ?? item.event_type} — sem chamada de presença nem ata de sessão.`}
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/calendario">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao calendário
                </Link>
              </Button>
            }
          />
          <Card className="p-6 text-sm text-muted-foreground">
            Só sessões ritualísticas, sessões administrativas e filantropias
            têm chamada de presença.
          </Card>
        </div>
      );
    }
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
        <Card className="p-6 text-sm text-muted-foreground">
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
    if (!canManage) return;
    const current = recordMap.get(memberId)?.status;
    mark.mutate({
      memberId,
      status: current === status ? null : status,
    });
  }

  if (!canView) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Você não tem permissão para ver a chamada desta sessão.
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

  function markAllPresent() {
    for (const m of allMembers) {
      if (!recordMap.get(m.id)) {
        mark.mutate({ memberId: m.id, status: "presente", justification: null });
      }
    }
  }

  /** As marcações já são salvas na hora; encerrar só confirma pendências e volta. */
  async function finishRollCall() {
    if (pendentes > 0) {
      const ok = await confirmFinish({
        title: "Encerrar chamada?",
        description: `${pendentes} ${pendentes === 1 ? "membro ainda não foi marcado" : "membros ainda não foram marcados"}. As marcações feitas já estão salvas.`,
        confirmLabel: "Encerrar",
        destructive: false,
      });
      if (!ok) return;
    }
    void leaveWithAtaFlush("/presencas");
  }

  return (
    <div>
      <PageHeader
        eyebrow={effectiveTab === "ata" ? "Atas" : "Chamada"}
        title={item.title}
        subtitle={`${meta?.label ?? item.event_type} · ${formatDateTimeBR(item.start_at)}${item.mandatory ? " · Obrigatório" : " · Facultativo"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-tv-in-bg px-3 py-1.5 text-[13px] font-bold text-tv-in"
                title="Presenças e ata sincronizam em tempo real"
              >
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                {effectiveTab === "ata" ? "Ao vivo" : "Chamada aberta"}
              </span>
            ) : null}
            <Button
              variant="outline"
              onClick={() =>
                void leaveWithAtaFlush(
                  effectiveTab === "ata" ? "/atas" : "/presencas",
                )
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {effectiveTab === "ata" ? "Atas" : "Presenças"}
            </Button>
          </div>
        }
      />


      <Tabs
        value={effectiveTab}
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
          {hasAttendance ? (
            <TabsTrigger value="chamada">Chamada</TabsTrigger>
          ) : null}
          {hasAta ? <TabsTrigger value="ata">Ata</TabsTrigger> : null}
        </TabsList>

        {hasAttendance ? (
        <TabsContent value="chamada">
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <label className="flex min-h-12 flex-1 items-center gap-2.5 rounded-[14px] border border-tv-border bg-tv-surface px-3.5 md:min-h-[46px] md:rounded-[12px]">
                  <Search className="h-5 w-5 shrink-0 text-tv-text-2" />
                  <span className="sr-only">Buscar membro</span>
                  <input
                    type="search"
                    className="min-w-0 flex-1 bg-transparent text-base outline-none md:text-[15px]"
                    placeholder="Buscar membro"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  {(["todos", "sem_marcar"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={rollFilter === f}
                      onClick={() => setRollFilter(f)}
                      className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${
                        rollFilter === f
                          ? "border-tv-text bg-tv-text text-tv-surface"
                          : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] dark:border-tv-border dark:text-tv-text"
                      }`}
                    >
                      {f === "todos" ? "Todos" : `Faltam marcar (${Math.max(0, pendentes)})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Celular: resumo compacto */}
              <div className="mb-3 grid grid-cols-3 gap-2 md:hidden">
                <SummaryNumber value={presentes} label="Presentes" tone="in" />
                <SummaryNumber value={ausentes} label="Faltaram" tone="out" />
                <SummaryNumber value={Math.max(0, pendentes)} label="Faltam marcar" tone="neutral" />
              </div>

              <ul className="grid gap-2.5 md:grid-cols-2">
                {members.length === 0 && (
                  <li className="rounded-[16px] bg-tv-surface p-5 text-[15px] text-tv-text-2 md:col-span-2">
                    Nenhum membro elegível nesta data (iniciação / Senior).
                  </li>
                )}
                {members
                  .filter((m) => rollFilter === "todos" || !recordMap.get(m.id))
                  .map((m) => {
                    const rec = recordMap.get(m.id);
                    const isP = rec?.status === "presente";
                    const isA = rec?.status === "ausente";
                    return (
                      <li
                        key={m.id}
                        className={`rounded-[16px] border-2 bg-tv-surface p-3.5 ${
                          rec ? "border-transparent" : "border-[#E9D58A] dark:border-amber-700/70"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 text-base font-semibold leading-snug md:text-[15px]">
                            {m.full_name}
                            {!rec ? (
                              <span className="block text-[13px] font-medium text-tv-warn">Falta marcar</span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            disabled={!canManage}
                            aria-pressed={isP}
                            aria-label={isP ? `Desmarcar presença de ${m.full_name}` : `${m.full_name} veio`}
                            onClick={() => toggleMark(m.id, "presente")}
                            className={`flex min-h-11 items-center gap-1.5 rounded-[12px] border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                              isP
                                ? "border-tv-in bg-tv-in-bg text-tv-in"
                                : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] hover:border-tv-in hover:text-tv-in dark:border-tv-border dark:text-tv-text"
                            }`}
                          >
                            <Check className="h-4 w-4" />
                            Veio
                          </button>
                          <button
                            type="button"
                            disabled={!canManage}
                            aria-pressed={isA}
                            aria-label={isA ? `Desmarcar falta de ${m.full_name}` : `${m.full_name} faltou`}
                            onClick={() => toggleMark(m.id, "ausente")}
                            className={`flex min-h-11 items-center gap-1.5 rounded-[12px] border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                              isA
                                ? "border-tv-out bg-tv-out-bg text-tv-out"
                                : "border-[#DCDCD8] bg-tv-surface text-[#2A2C31] hover:border-tv-out hover:text-tv-out dark:border-tv-border dark:text-tv-text"
                            }`}
                          >
                            <X className="h-4 w-4" />
                            Faltou
                          </button>
                        </div>
                        {isA && (
                          <Input
                            className="mt-2 animate-fade-in"
                            aria-label="Justificativa da falta"
                            placeholder="Motivo da falta (opcional)"
                            defaultValue={rec?.justification ?? ""}
                            readOnly={!canManage}
                            disabled={!canManage}
                            onBlur={(e) => {
                              if (!canManage) return;
                              mark.mutate({
                                memberId: m.id,
                                status: "ausente",
                                justification: e.target.value.trim() || null,
                              });
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
              </ul>
              {canManage ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 md:hidden">
                  <Button
                    variant="secondary"
                    className="min-h-12"
                    disabled={mark.isPending || pendentes <= 0}
                    onClick={markAllPresent}
                  >
                    Todos presentes
                  </Button>
                  <Button className="min-h-12" onClick={finishRollCall}>
                    Encerrar chamada
                  </Button>
                </div>
              ) : null}
              {!item.mandatory && (
                <p className="mt-3 text-[13px] text-tv-text-2">
                  Este item é facultativo: as presenças ficam registradas, mas não impactam a
                  frequência.
                </p>
              )}
            </div>

            {/* Desktop: resumo e sessão */}
            <aside className="hidden flex-col gap-4 md:flex">
              <div className="rounded-[20px] bg-tv-surface p-5">
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2">
                  Resumo
                </span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <SummaryNumber value={presentes} label="Presentes" tone="in" />
                  <SummaryNumber value={ausentes} label="Faltaram" tone="out" />
                  <SummaryNumber value={Math.max(0, pendentes)} label="Faltam marcar" tone="neutral" />
                </div>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[#EEEEEA] dark:bg-tv-line">
                  <div
                    className="bg-tv-in"
                    style={{ width: `${allMembers.length ? (presentes / allMembers.length) * 100 : 0}%` }}
                  />
                  <div
                    className="bg-tv-out"
                    style={{ width: `${allMembers.length ? (ausentes / allMembers.length) * 100 : 0}%` }}
                  />
                </div>
                {canManage && pendentes > 0 ? (
                  <Button
                    className="mt-4 w-full"
                    variant="secondary"
                    disabled={mark.isPending}
                    onClick={markAllPresent}
                  >
                    Todos presentes
                  </Button>
                ) : null}
                {canManage ? (
                  <Button className="mt-2 w-full" onClick={finishRollCall}>
                    Encerrar chamada
                  </Button>
                ) : null}
                <p className="mt-3 text-center text-[13px] text-tv-text-2">
                  Cada marcação é salva na hora
                </p>
              </div>
              <div className="flex flex-col gap-1.5 rounded-[20px] bg-tv-surface p-5 text-[15px]">
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2">
                  Sessão
                </span>
                {item.location ? <span>Local: {item.location}</span> : null}
                <span>{formatDateTimeBR(item.start_at)}</span>
                {hasAta ? (
                  <button
                    type="button"
                    onClick={() => setTab("ata")}
                    className="mt-1 text-left font-semibold text-tv-primary"
                  >
                    Abrir a ata desta sessão
                  </button>
                ) : null}
              </div>
            </aside>
          </div>
        </TabsContent>
        ) : null}

        {hasAta ? (
          <TabsContent value="ata">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {minutesList.map((m, index) => (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  variant={selectedMinuteKey === m.id ? "default" : "outline"}
                  style={
                    selectedMinuteKey === m.id
                      ? { backgroundColor: "var(--chapter-primary)" }
                      : undefined
                  }
                  onClick={() => void selectMinuteTab(m.id)}
                >
                  {minuteTabLabel(m, index)}
                </Button>
              ))}
              {canEditAtas ? (
                <Button
                  type="button"
                  size="sm"
                  variant={selectedMinuteKey === NEW_MINUTE_KEY ? "default" : "outline"}
                  style={
                    selectedMinuteKey === NEW_MINUTE_KEY
                      ? { backgroundColor: "var(--chapter-primary)" }
                      : undefined
                  }
                  onClick={() => void selectMinuteTab(NEW_MINUTE_KEY)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova ata
                </Button>
              ) : null}
            </div>
            {selectedMinute || canEditAtas ? (
              <MinutesPanel
                key={selectedMinuteKey || "empty"}
                chapterId={item.chapter_id}
                calendarEventId={id}
                item={{
                  title: item.title,
                  start_at: item.start_at,
                  location: item.location,
                  address: item.address ?? null,
                }}
                minutes={selectedMinute}
                roleName={active?.role.name ?? null}
                flushSaveRef={flushAtaSaveRef}
                onChanged={(info) => {
                  if (info?.minuteId) setSelectedMinuteKey(info.minuteId);
                  void qc.invalidateQueries({ queryKey: ["ongoing", id] });
                }}
                onDeleted={() => {
                  const remaining = minutesList.filter(
                    (m) => m.id !== selectedMinuteKey,
                  );
                  setSelectedMinuteKey(
                    remaining[0]?.id ?? (canEditAtas ? NEW_MINUTE_KEY : ""),
                  );
                  void qc.invalidateQueries({ queryKey: ["ongoing", id] });
                }}
              />
            ) : (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">
                  Nenhuma ata nesta sessão. Somente o Escrivão pode criar e
                  redigir atas.
                </p>
              </Card>
            )}
          </TabsContent>
        ) : null}
      </Tabs>
      {finishDialog}

      <div className="mt-4 text-xs text-muted-foreground">
        {effectiveTab === "ata" ? (
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

function SummaryNumber({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "in" | "out" | "neutral";
}) {
  const cls =
    tone === "in"
      ? "bg-tv-in-bg text-tv-in"
      : tone === "out"
        ? "bg-tv-out-bg text-tv-out"
        : "bg-tv-line text-[#3F4249] dark:text-tv-text";
  return (
    <div className={`rounded-[14px] px-2 py-2.5 text-center ${cls}`}>
      <div className="font-display text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs font-semibold">{label}</div>
    </div>
  );
}
