import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckSquare,
  FilePlus2,
  FileText,
  LayoutGrid,
  Mail,
  Plus,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { useActiveChapter, type Membership } from "@/context/ActiveChapterContext";
import { listCalendarItems } from "@/lib/calendar.functions";
import { listOpenSindicanciasForMe } from "@/lib/investigations.functions";
import { resolveCalendarChaveText } from "@/lib/resolve-calendar-chave";
import { listEvents } from "@/lib/events.functions";
import { listMembers } from "@/lib/members.functions";
import { listChapterMinutes, MINUTE_STATUS_LABELS } from "@/lib/minutes.functions";
import { membersListKey } from "@/lib/query-keys";
import { listOngoingItems } from "@/lib/attendance.functions";
import { getDashboardFinance } from "@/lib/finance.functions";
import { canViewAttendanceAccess } from "@/lib/permissions";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { useNavGroups } from "@/hooks/useNavGroups";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import { formatBRL, formatDateBR, formatDateTimeBR, parseDateOnly } from "@/lib/format";
import { datePartsInAppTz } from "@/lib/timezone";
import { MONTH_LONG } from "@/lib/dues-rules";
import { STATUS_LABELS } from "@/lib/investigation-labels";
import { useChapterLogo } from "@/lib/chapter-logo";
import { HomeView, type HomeShortcut } from "@/components/home/HomeView";
import { initialsOf } from "@/components/shell/ShellNav";
import { ChapterSwitcher } from "@/components/home/ChapterSwitcher";
import { useOrgScope } from "@/context/OrgScopeContext";

/** Idade que o membro completa no aniversário deste ano civil. */
function turningAgeThisYear(birthDate: string | null | undefined, year: number): number | null {
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
    queryFn: () => listMembers({ data: { chapterId, search: "", status: "all" } }),
  });

const HIDE_KEY = "tv.hideValues";

type CalItem = Parameters<typeof resolveCalendarChaveText>[0] & {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  location?: string | null;
  mandatory?: boolean | null;
};
type MinuteRow = {
  id: string;
  status: string;
  opened_at: string;
  calendar_event?: { title?: string | null; start_at?: string | null } | null;
  approvals?: unknown[];
};

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function inDaysLabel(start: Date, now: Date): string {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const d = Math.round((+b - +a) / 86_400_000);
  if (d <= 0) return "hoje";
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

function Inicio() {
  const { active } = useActiveChapter();
  if (!active) return null;
  return <InicioContent active={active} />;
}

function InicioContent({ active }: { active: Membership }) {
  const navigate = useNavigate();
  const { profileFullName, memberships } = useActiveChapter();
  const { scopes } = useOrgScope();
  const hasOtherViews = new Set(memberships.map((m) => m.chapter_id)).size > 1 || scopes.length > 0;
  const { can, ctx, positionLabels } = useChapterAccess();
  const { canSee, duesEnabled } = useNavGroups();
  const chapterId = active.chapter_id;
  const canFinance = can("tesouraria");
  const canAttendance = canViewAttendanceAccess(ctx);
  const logoUrl = useChapterLogo(active.chapter.logo_url);

  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(readHidden()), []);
  function toggleHidden() {
    setHidden((v) => {
      try {
        window.localStorage.setItem(HIDE_KEY, v ? "0" : "1");
      } catch {
        /* sem armazenamento: só nesta sessão */
      }
      return !v;
    });
  }

  const { data: events } = useSuspenseQuery(eventsQO(chapterId));
  const { data: members } = useSuspenseQuery(membersQO(chapterId));

  const { data: ongoing } = useQuery({
    queryKey: ["ongoing-items", chapterId],
    queryFn: () => listOngoingItems({ data: { chapterId } }),
    refetchInterval: 60_000,
  });
  const { data: openSindicancias = [] } = useQuery({
    queryKey: ["open-sindicancias", chapterId],
    queryFn: () => listOpenSindicanciasForMe({ data: { chapterId } }),
    staleTime: 30_000,
  });
  const { data: finance, error: financeErr } = useQuery({
    queryKey: ["dashboard-finance", chapterId],
    queryFn: () => getDashboardFinance({ data: { chapterId } }),
    enabled: canFinance,
    staleTime: 60_000,
  });
  const { data: nextItems } = useQuery({
    queryKey: ["calendar-next", chapterId],
    queryFn: () =>
      listCalendarItems({
        data: { chapterIds: [chapterId], from: new Date().toISOString() },
      }) as Promise<CalItem[]>,
  });
  const canMinutes = canSee("/atas");
  const { data: minutes } = useQuery({
    queryKey: ["home-minutes", chapterId],
    queryFn: () => listChapterMinutes({ data: { chapterId } }),
    enabled: canMinutes,
    staleTime: 60_000,
  });

  const next = (nextItems ?? [])[0];
  const { data: chaveText } = useQuery({
    queryKey: ["calendar-chave-text", next?.id, chapterId, next?.dress_code, next?.start_at],
    queryFn: () => resolveCalendarChaveText(next, active.chapter),
    enabled: Boolean(next?.id),
  });

  function copyChave() {
    if (!chaveText) {
      toast.error("Aguarde o carregamento da chave.");
      return;
    }
    const isSindicancia = next?.event_type === "sindicancia";
    void navigator.clipboard.writeText(chaveText).then(
      () =>
        toast.success(isSindicancia ? "Chave de sindicância copiada!" : "Chave do dia copiada!"),
      () => toast.error("Não foi possível copiar. Copie manualmente."),
    );
  }

  const now = new Date();
  const { year: birthdayYear, month: birthdayMonth1, day: todayDay } = datePartsInAppTz(now);
  const birthdays = members
    .filter((m) => parseDateOnly(m.birth_date)?.getMonth() === birthdayMonth1 - 1)
    .sort((a, b) => {
      const key =
        birthdayProximityKey(parseDateOnly(a.birth_date)?.getDate() ?? 0, todayDay) -
        birthdayProximityKey(parseDateOnly(b.birth_date)?.getDate() ?? 0, todayDay);
      return key !== 0 ? key : (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR");
    })
    .map((m) => {
      const day = parseDateOnly(m.birth_date)?.getDate() ?? 0;
      const age = turningAgeThisYear(m.birth_date, birthdayYear);
      const today = day === todayDay;
      const past = day < todayDay;
      const when = birthdayDayMonthLabel(m.birth_date);
      const info =
        age === null
          ? when
          : today
            ? `Faz ${age} anos hoje, ${when}`
            : `${past ? "Fez" : "Faz"} ${age} anos em ${when}`;
      return { id: m.id, initials: initialsOf(m.full_name), name: m.full_name, info, today, past };
    });

  const upcomingEvent = events
    .filter((e) => new Date(e.starts_at) >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];

  const cargo = positionLabels.length ? positionLabels.map((x) => x.label).join(" · ") : "Membro";
  const firstName = profileFullName?.trim().split(/\s+/)[0] || "Irmão";
  const chapterLabel = `${active.chapter.name}${active.chapter.number ? ` nº ${active.chapter.number}` : ""}`;
  const weekday = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const shortcut = (to: string, label: string, icon: HomeShortcut["icon"]): HomeShortcut | null =>
    canSee(to) ? { to, label, icon } : null;
  const shortcutsMobile = [
    shortcut("/presencas", "Chamada", CheckSquare),
    duesEnabled ? shortcut("/tesouraria/mensalidades", "Mensali\u00addades", Receipt) : null,
    shortcut("/membros", "Membros", Users),
    shortcut("/atas", "Atas", FileText),
    shortcut("/tesouraria/fluxo", "Caixa", Wallet),
    shortcut("/eventos", "Eventos", CalendarDays),
    shortcut("/oficios", "Ofícios", Mail),
  ]
    .filter((x): x is HomeShortcut => x !== null)
    .slice(0, 7);
  shortcutsMobile.push({ to: "/mais", label: "Mais", icon: LayoutGrid });
  const shortcutsDesktop = [
    shortcut("/presencas", "Chamada", CheckSquare),
    duesEnabled ? shortcut("/tesouraria/mensalidades", "Mensalidades", Receipt) : null,
    canSee("/membros") ? { to: "/membros/novo", label: "Novo membro", icon: UserPlus } : null,
    shortcut("/atas", "Nova ata", FilePlus2),
    shortcut("/tesouraria/fluxo", "Lançamento", Plus),
    shortcut("/oficios", "Ofício", Mail),
  ].filter((x): x is HomeShortcut => x !== null);

  const nextMeta = next ? TYPE_META[next.event_type as CalendarType] : null;
  const isSindicancia = next?.event_type === "sindicancia";

  return (
    <HomeView
      greeting={greetingFor(now)}
      firstName={firstName}
      roleLine={`${cargo}${active.chapter.city ? ` · ${active.chapter.city}` : ""}`}
      dateLine={`${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${chapterLabel}${active.chapter.city ? `, ${active.chapter.city}` : ""}`}
      chapterLabel={chapterLabel}
      chapterMark={
        logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
        ) : (
          (active.chapter.name?.[0] ?? "T").toUpperCase()
        )
      }
      switchLabel={hasOtherViews ? "Trocar instituição" : "Menu e opções"}
      onSwitchChapter={hasOtherViews ? undefined : () => navigate({ to: "/mais" })}
      wrapSwitcher={hasOtherViews ? (trigger) => <ChapterSwitcher trigger={trigger} /> : undefined}
      hidden={hidden}
      onToggleHidden={toggleHidden}
      ongoing={((ongoing ?? []) as CalItem[]).map((it) => ({
        id: it.id,
        title: it.title,
        when: `${formatDateTimeBR(it.start_at)} · ${it.mandatory ? "Obrigatório" : "Facultativo"}`,
        typeLabel: TYPE_META[it.event_type as CalendarType]?.label ?? it.event_type,
        to: canAttendance ? `/ongoing/${it.id}` : null,
      }))}
      sindicancias={openSindicancias.map((s) => ({
        id: s.calendar_event_id,
        title: s.nominee_name,
        when: `${s.start_at ? formatDateTimeBR(s.start_at) : "Sem data"}${s.needsMyVote ? " · Seu voto pendente" : ""}`,
        badge: STATUS_LABELS[s.status] ?? s.status,
        highlight: Boolean(s.needsMyVote),
      }))}
      next={
        next
          ? {
              title: next.title,
              typeLabel: nextMeta?.label ?? next.event_type,
              when: whenLabel(next.start_at),
              inDays: inDaysLabel(new Date(next.start_at), now),
              location: next.location ?? null,
              copyLabel: isSindicancia ? "Copiar chave de sindicância" : "Copiar chave do dia",
              canCopy: Boolean(chaveText),
              onCopy: copyChave,
              chamadaTo: canSee("/presencas") ? "/presencas" : null,
            }
          : null
      }
      shortcutsMobile={shortcutsMobile}
      shortcutsDesktop={shortcutsDesktop}
      finance={
        canFinance && finance
          ? {
              saldo: formatBRL(finance.bankBalance ?? 0),
              resultado: formatBRL(finance.monthBalance ?? 0),
              resultadoNegative: (finance.monthBalance ?? 0) < 0,
              monthName: MONTH_LONG[finance.month - 1]?.toLowerCase() ?? "este mês",
              entradas: formatBRL(finance.monthIncome ?? 0),
              saidas: formatBRL(finance.monthExpense ?? 0),
            }
          : null
      }
      financeError={
        canFinance && financeErr
          ? financeErr instanceof Error
            ? financeErr.message
            : "Não foi possível carregar o financeiro."
          : null
      }
      dues={
        canFinance && duesEnabled && finance
          ? {
              aberto: formatBRL(finance.pendingAmount ?? 0),
              pendentes: finance.pendingMembers ?? 0,
              pendingMembersLabel: `${finance.pendingMembers} ${finance.pendingMembers === 1 ? "pendente" : "pendentes"}`,
            }
          : null
      }
      birthdays={birthdays}
      birthdayMonth={(MONTH_LONG[birthdayMonth1 - 1] ?? "").toLowerCase()}
      nextEvent={
        upcomingEvent
          ? {
              name: upcomingEvent.name,
              when: formatDateBR(upcomingEvent.starts_at),
              info: `${upcomingEvent.tickets_sold} ${upcomingEvent.tickets_sold === 1 ? "convidado" : "convidados"}`,
            }
          : null
      }
      canCreateEvent={canSee("/eventos")}
      minutes={
        canMinutes
          ? ((minutes ?? []) as MinuteRow[])
              .filter((m) => m.status !== "aprovada")
              .slice(0, 3)
              .map((m) => ({
                id: m.id,
                title: m.calendar_event?.title ?? "Ata",
                date: `${m.calendar_event?.start_at ? formatDateBR(m.calendar_event.start_at) : formatDateBR(m.opened_at)} · ${m.approvals?.length ?? 0} de 3 assinaturas`,
                status: MINUTE_STATUS_LABELS[m.status] ?? m.status,
              }))
          : null
      }
    />
  );
}
