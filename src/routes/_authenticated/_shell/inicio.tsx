import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  useActiveChapter,
  type Membership,
} from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Users,
  Calendar,
  Cake,
  PlusCircle,
  Radio,
  Copy,
  MapPin,
  Landmark,
  Receipt,
  Gavel,
} from "lucide-react";
import { listCalendarItems } from "@/lib/calendar.functions";
import { listOpenSindicanciasForMe } from "@/lib/investigations.functions";
import { resolveCalendarChaveText } from "@/lib/resolve-calendar-chave";
import { toast } from "sonner";
import { listEvents } from "@/lib/events.functions";
import { listMembers } from "@/lib/members.functions";
import { membersListKey } from "@/lib/query-keys";
import { listOngoingItems } from "@/lib/attendance.functions";
import { getDashboardFinance } from "@/lib/finance.functions";
import { canViewAttendanceAccess } from "@/lib/permissions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  parseDateOnly,
} from "@/lib/format";
import { datePartsInAppTz } from "@/lib/timezone";
import { MONTH_LONG, isChapterDuesEnabled } from "@/lib/dues-rules";
import { STATUS_LABELS } from "@/lib/investigation-labels";
import { Badge } from "@/components/ui/badge";

/** Idade que o membro completa no aniversário deste ano civil. */
function turningAgeThisYear(
  birthDate: string | null | undefined,
  year: number,
): number | null {
  const bd = parseDateOnly(birthDate);
  if (!bd) return null;
  return year - bd.getFullYear();
}

/**
 * Ordem do mês: hoje → dias futuros (crescente);
 * depois os já passados, do mais recente ao mais antigo.
 */
function birthdayProximityKey(birthDay: number, todayDay: number): number {
  if (birthDay >= todayDay) return birthDay - todayDay;
  return 100 + (todayDay - birthDay);
}

function birthdayDayMonthLabel(birthDate: string | null | undefined): string {
  const bd = parseDateOnly(birthDate);
  if (!bd) return "—";
  const dd = String(bd.getDate()).padStart(2, "0");
  const mm = String(bd.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}
export const Route = createFileRoute("/_authenticated/_shell/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Templo Virtual" },
      { name: "description", content: "Dashboard do capítulo ativo." },
    ],
  }),
  component: Inicio,
});

const eventsQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["events", chapterId],
    queryFn: () => listEvents({ data: { chapterId } }),
  });

const membersQO = (chapterId: string) =>
  queryOptions({
    queryKey: membersListKey(chapterId, "", "all"),
    queryFn: () =>
      listMembers({ data: { chapterId, search: "", status: "all" } }),
  });

const SALDO_ROTATE_MS = 30_000;
const MEMBROS_ROTATE_MS = 30_000;

function Inicio() {
  const { active } = useActiveChapter();
  if (!active) return null;
  return <InicioContent active={active} />;
}

function InicioContent({ active }: { active: Membership }) {
  const { profileFullName } = useActiveChapter();
  const { can, ctx } = useChapterAccess();
  const chapterId = active.chapter_id;
  const canFinance = can("tesouraria");
  const duesEnabled = isChapterDuesEnabled(
    active.chapter as { settings?: Record<string, unknown> } | undefined,
  );

  const { data: events } = useSuspenseQuery(eventsQO(chapterId));
  const { data: members } = useSuspenseQuery(membersQO(chapterId));

  const canAttendance = canViewAttendanceAccess(ctx);
  const { data: ongoing } = useQuery({
    queryKey: ["ongoing-items", chapterId],
    queryFn: () => listOngoingItems({ data: { chapterId } }),
    enabled: Boolean(chapterId),
    refetchInterval: 60_000,
  });

  const { data: openSindicancias = [] } = useQuery({
    queryKey: ["open-sindicancias", chapterId],
    queryFn: () => listOpenSindicanciasForMe({ data: { chapterId } }),
    enabled: Boolean(chapterId),
    staleTime: 30_000,
  });

  const {
    data: finance,
    isError: financeError,
    error: financeErr,
  } = useQuery({
    queryKey: ["dashboard-finance", chapterId],
    queryFn: () => getDashboardFinance({ data: { chapterId } }),
    enabled: Boolean(chapterId) && canFinance,
    staleTime: 60_000,
  });

  const [showBank, setShowBank] = useState(false);
  const [showReceivable, setShowReceivable] = useState(false);
  useEffect(() => {
    if (!canFinance) return;
    const saldoId = window.setInterval(
      () => setShowBank((v) => !v),
      SALDO_ROTATE_MS,
    );
    const membrosId = window.setInterval(
      () => setShowReceivable((v) => !v),
      MEMBROS_ROTATE_MS,
    );
    return () => {
      window.clearInterval(saldoId);
      window.clearInterval(membrosId);
    };
  }, [canFinance]);

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.starts_at) >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];

  // Calendário no fuso do app — evita mês/dia errados perto da meia-noite UTC
  const { year: birthdayYear, month: birthdayMonth1, day: todayDay } =
    datePartsInAppTz(now);
  const birthdayMonth = birthdayMonth1 - 1; // 0-based, igual a Date#getMonth()
  const birthdays = members
    .filter((m) => {
      const bd = parseDateOnly(m.birth_date);
      return bd != null && bd.getMonth() === birthdayMonth;
    })
    .sort((a, b) => {
      const dayA = parseDateOnly(a.birth_date)?.getDate() ?? 0;
      const dayB = parseDateOnly(b.birth_date)?.getDate() ?? 0;
      const key =
        birthdayProximityKey(dayA, todayDay) -
        birthdayProximityKey(dayB, todayDay);
      if (key !== 0) return key;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR");
    });

  const hasAnyData = members.length > 0 || events.length > 0;

  const firstName =
    profileFullName?.trim().split(/\s+/).filter(Boolean)[0] || "DeMolay";

  const monthLabel =
    finance != null
      ? `${MONTH_LONG[finance.month - 1] ?? ""} de ${finance.year}`
      : "mês atual";

  const financeUnavailable = canFinance && financeError;
  const saldoValue = financeUnavailable
    ? null
    : showBank
      ? (finance?.bankBalance ?? 0)
      : (finance?.monthBalance ?? 0);
  const saldoLabel = showBank ? "Saldo do banco" : "Saldo do mês";
  const saldoHint = financeUnavailable
    ? financeErr instanceof Error
      ? financeErr.message
      : "Não foi possível carregar o financeiro"
    : showBank
      ? "Saldo atual do caixa · todas as competências"
      : `${monthLabel} · resultado do fluxo`;

  const membrosLabel = showReceivable ? "A receber" : "Mensalidades pendentes";
  const membrosValue = financeUnavailable
    ? "—"
    : !finance
      ? "—"
      : showReceivable
        ? formatBRL(finance.receivableTotal ?? 0)
        : `${finance.pendingMembers} ${finance.pendingMembers === 1 ? "membro" : "membros"}`;
  const membrosHint = financeUnavailable
    ? "Erro ao carregar"
    : !finance
      ? "Carregando…"
      : showReceivable
        ? `Mensalidades ${formatBRL(finance.pendingAmount)} · cobranças ${formatBRL(finance.openChargesAmount ?? 0)}`
        : `${finance.pendingCompetences} competência${finance.pendingCompetences === 1 ? "" : "s"} · ${formatBRL(finance.pendingAmount)}`;
  const membrosTone =
    !financeUnavailable && showReceivable && (finance?.receivableTotal ?? 0) > 0
      ? "text-amber-600 dark:text-amber-400"
      : undefined;

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName}`}
        subtitle={`${active.chapter.name}${active.chapter.city ? ` · ${active.chapter.city}` : ""}`}
      />

      {(ongoing?.length ?? 0) > 0 && (
        <Card className="mb-5 rounded-[12px] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Radio
              className="h-5 w-5 animate-pulse"
              style={{ color: active.chapter.primary_color }}
            />
            Acontecendo agora
          </div>
          <ul className="space-y-2">
            {(ongoing ?? []).map((it: any) => {
              const meta = TYPE_META[it.event_type as CalendarType];
              return (
                <li key={it.id}>
                  <OngoingRow to={canAttendance ? it.id : null}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {it.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTimeBR(it.start_at)}
                        {it.mandatory ? " · Obrigatório" : " · Facultativo"}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: meta?.bg, color: meta?.color }}
                    >
                      {meta?.label ?? it.event_type}
                    </span>
                  </OngoingRow>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {openSindicancias.length > 0 && (
        <Card className="mb-5 rounded-[12px] p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Gavel
                className="h-5 w-5"
                style={{ color: active.chapter.primary_color }}
              />
              Sindicâncias em aberto
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/sindicancias/sindicarias">Ver todas</Link>
            </Button>
          </div>
          <ul className="space-y-2">
            {openSindicancias.map((s) => (
              <li key={s.calendar_event_id}>
                <Link
                  to="/sindicancias/sindicarias"
                  className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-2 no-underline transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {s.nominee_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.start_at ? formatDateTimeBR(s.start_at) : "Sem data"}
                      {s.needsMyVote ? " · Seu voto pendente" : ""}
                    </div>
                  </div>
                  <Badge variant={s.needsMyVote ? "default" : "secondary"}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <NextItemCard chapterId={chapterId} />

      {!hasAnyData ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhum lançamento ainda"
          description="Cadastre o primeiro membro ou crie um evento para começar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                asChild
                style={{ backgroundColor: active.chapter.primary_color }}
              >
                <Link to="/membros/novo">
                  <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar membro
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/eventos/novo">Criar evento</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {canFinance ? (
            <>
              <Link to="/tesouraria/fluxo" className="block">
                <MetricCard
                  icon={
                    showBank ? (
                      <Landmark className="h-5 w-5" />
                    ) : (
                      <Wallet className="h-5 w-5" />
                    )
                  }
                  label={saldoLabel}
                  value={saldoValue == null ? "—" : formatBRL(saldoValue)}
                  hint={saldoHint}
                  tone={
                    saldoValue == null
                      ? undefined
                      : saldoValue < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : saldoValue > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : undefined
                  }
                  fadeKey={showBank ? "bank" : "month"}
                />
              </Link>
              {duesEnabled ? (
                <Link to="/tesouraria/mensalidades" className="block">
                  <MetricCard
                    icon={
                      showReceivable ? (
                        <Receipt className="h-5 w-5" />
                      ) : (
                        <Users className="h-5 w-5" />
                      )
                    }
                    label={membrosLabel}
                    value={membrosValue}
                    hint={membrosHint}
                    tone={membrosTone}
                    fadeKey={showReceivable ? "receivable" : "members"}
                  />
                </Link>
              ) : null}
            </>
          ) : null}
          <MetricCard
            icon={<Calendar className="h-5 w-5" />}
            label="Próximo evento"
            value={upcoming?.name ?? "Nenhum"}
            hint={
              upcoming ? (
                <>
                  <div>{formatDateBR(upcoming.starts_at)}</div>
                  <div className="mt-0.5">
                    {upcoming.tickets_sold}{" "}
                    {upcoming.tickets_sold === 1 ? "convidado" : "convidados"}
                    {" · "}
                    {formatBRL(upcoming.raised)} arrecadado
                    {" · "}
                    {formatBRL(upcoming.spent)} gasto
                  </div>
                </>
              ) : (
                "—"
              )
            }
          />
          <Card className="rounded-[12px] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Cake className="h-5 w-5" /> Aniversariantes do mês
            </div>
            {birthdays.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum neste mês.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {birthdays.map((m) => {
                  const age = turningAgeThisYear(m.birth_date, birthdayYear);
                  const day = parseDateOnly(m.birth_date)?.getDate() ?? 0;
                  const alreadyPassed = day < todayDay;
                  const when = birthdayDayMonthLabel(m.birth_date);
                  return (
                    <li
                      key={m.id}
                      className={`flex items-baseline justify-between gap-3 text-sm leading-snug ${
                        alreadyPassed
                          ? "text-muted-foreground line-through decoration-muted-foreground/70"
                          : ""
                      }`}
                    >
                      <span className="min-w-0 truncate font-medium">
                        {m.full_name}
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted-foreground">
                        {age !== null
                          ? `${alreadyPassed ? "fez" : "faz"} ${age} ${age === 1 ? "ano" : "anos"} em ${when}`
                          : when}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function OngoingRow({
  to,
  children,
}: {
  to: string | null;
  children: React.ReactNode;
}) {
  const cls =
    "flex items-center justify-between gap-3 rounded-[8px] border border-border p-3";
  if (!to) return <div className={cls}>{children}</div>;
  return (
    <Link
      to="/ongoing/$id"
      params={{ id: to }}
      search={{ tab: "chamada" }}
      className={`${cls} hover:bg-muted`}
    >
      {children}
    </Link>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
  fadeKey,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: string;
  fadeKey?: string;
}) {
  return (
    <Card className="rounded-[12px] p-5 transition-colors hover:bg-muted/40">
      <div key={fadeKey ?? label} className="animate-in fade-in duration-500">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {label}
        </div>
        <div className={`mt-2 text-2xl font-bold ${tone ?? ""}`}>{value}</div>
        {hint != null && hint !== "" && (
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        )}
      </div>
    </Card>
  );
}

function NextItemCard({ chapterId }: { chapterId: string }) {
  const { active: activeChapter } = useActiveChapter();
  const { data } = useQuery({
    queryKey: ["calendar-next", chapterId],
    queryFn: () =>
      listCalendarItems({
        data: { chapterIds: [chapterId], from: new Date().toISOString() },
      }) as Promise<any[]>,
    enabled: Boolean(chapterId),
  });

  const next = (data ?? [])[0];

  const { data: chaveText } = useQuery({
    queryKey: [
      "calendar-chave-text",
      next?.id,
      activeChapter?.chapter_id,
      next?.dress_code,
      next?.location,
      next?.address,
      next?.title,
      next?.description,
      next?.start_at,
      next?.end_at,
      next?.event_type,
    ],
    queryFn: () => {
      if (!next) throw new Error("Sem próximo compromisso");
      return resolveCalendarChaveText(next, activeChapter?.chapter);
    },
    enabled: Boolean(next?.id),
  });

  if (!next) return null;

  const meta = TYPE_META[next.event_type as CalendarType];

  function copyChave() {
    try {
      if (!chaveText) {
        throw new Error("Aguarde o carregamento da chave.");
      }
      const isSindicancia = next.event_type === "sindicancia";
      void navigator.clipboard.writeText(chaveText).then(
        () =>
          toast.success(
            isSindicancia
              ? "Chave de sindicância copiada!"
              : "Chave do dia copiada!",
          ),
        (e: unknown) =>
          toast.error(
            e instanceof Error
              ? e.message
              : "Não foi possível copiar. Copie manualmente.",
          ),
      );
    } catch (e: unknown) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Não foi possível copiar. Copie manualmente.",
      );
    }
  }

  return (
    <Card className="mb-5 rounded-[12px] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Próximo compromisso
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: meta?.bg, color: meta?.color }}
        >
          {meta?.label ?? next.event_type}
        </span>
      </div>
      <div className="text-base font-semibold">{next.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatDateTimeBR(next.start_at)}
      </div>
      {next.location && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {next.location}
        </div>
      )}
      <div className="mt-4">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={copyChave}
          disabled={!chaveText}
        >
          <Copy className="mr-2 h-4 w-4" />{" "}
          {next.event_type === "sindicancia"
            ? "Copiar chave de sindicância"
            : "Copiar chave do dia"}
        </Button>
      </div>
    </Card>
  );
}
