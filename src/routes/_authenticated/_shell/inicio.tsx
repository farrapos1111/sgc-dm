import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";

import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Users, Calendar, Cake, PlusCircle, Radio, Copy, MapPin } from "lucide-react";
import { listCalendarItems } from "@/lib/calendar.functions";
import { buildChaveDoDia } from "@/lib/chave-do-dia";
import { toast } from "sonner";
import { listEvents } from "@/lib/events.functions";
import { listMembers } from "@/lib/members.functions";
import { membersListKey } from "@/lib/query-keys";
import { listOngoingItems } from "@/lib/attendance.functions";
import { canManageAttendance } from "@/lib/permissions";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/_shell/inicio")({
  head: () => ({
    meta: [
      { title: "Início — SG-CDM" },
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

function Inicio() {
  const { active } = useActiveChapter();
  if (!active) return null;
  const chapterId = active.chapter_id;

  const { data: events } = useSuspenseQuery(eventsQO(chapterId));
  const { data: members } = useSuspenseQuery(membersQO(chapterId));

  const canAttendance = canManageAttendance(active.role.name);
  const { data: ongoing } = useQuery({
    queryKey: ["ongoing-items", chapterId],
    queryFn: () => listOngoingItems({ data: { chapterId } }),
    enabled: Boolean(chapterId),
    refetchInterval: 60_000,
  });


  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at) >= now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];

  const birthdayMonth = now.getMonth();
  const birthdays = members
    .filter((m) => m.birth_date && new Date(m.birth_date).getMonth() === birthdayMonth)
    .slice(0, 5);

  // Sem tabelas financeiras ainda: consideramos vazio quando não há eventos e não há membros
  const hasAnyData = members.length > 0 || events.length > 0;

  const firstName =
    (typeof window !== "undefined" && (window as any).__demolayName) || active.role.label;

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName}`}
        subtitle={`${active.chapter.name}${active.chapter.city ? ` · ${active.chapter.city}` : ""}`}
      />

      {(ongoing?.length ?? 0) > 0 && (
        <Card className="mb-5 rounded-[12px] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Radio className="h-5 w-5 animate-pulse" style={{ color: active.chapter.primary_color }} />
            Acontecendo agora
          </div>
          <ul className="space-y-2">
            {(ongoing ?? []).map((it: any) => {
              const meta = TYPE_META[it.event_type as CalendarType];
              return (
                <li key={it.id}>
                  <OngoingRow to={canAttendance ? it.id : null}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{it.title}</div>
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


      <NextItemCard chapterId={chapterId} />

      {!hasAnyData ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="Nenhum lançamento ainda"
          description="Cadastre o primeiro membro ou crie um evento para começar."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild style={{ backgroundColor: active.chapter.primary_color }}>
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
          <MetricCard
            icon={<Wallet className="h-5 w-5" />}
            label="Saldo do mês"
            value={formatBRL(0)}
            hint="Em breve — integração financeira"
          />
          <Link to="/membros" className="block">
            <MetricCard
              icon={<Users className="h-5 w-5" />}
              label="Mensalidades pendentes"
              value={`${Math.max(0, Math.floor(members.length * 0.2))} membros`}
              hint="Toque para ver a lista"
            />
          </Link>
          <MetricCard
            icon={<Calendar className="h-5 w-5" />}
            label="Próximo evento"
            value={upcoming?.name ?? "Nenhum"}
            hint={upcoming ? formatDateBR(upcoming.starts_at) : "—"}
          />
          <Card className="rounded-[12px] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Cake className="h-5 w-5" /> Aniversariantes do mês
            </div>
            {birthdays.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum neste mês.</div>
            ) : (
              <ul className="space-y-1.5">
                {birthdays.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{m.full_name}</span>
                    <span className="text-muted-foreground">{formatDateBR(m.birth_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function OngoingRow({ to, children }: { to: string | null; children: React.ReactNode }) {
  const cls =
    "flex items-center justify-between gap-3 rounded-[8px] border border-border p-3";
  if (!to) return <div className={cls}>{children}</div>;
  return (
    <Link to="/ongoing/$id" params={{ id: to }} className={`${cls} hover:bg-muted`}>
      {children}
    </Link>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-[12px] p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
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
  if (!next) return null;

  const meta = TYPE_META[next.event_type as CalendarType];

  async function copyChave() {
    const text = buildChaveDoDia(next, {
      template: (activeChapter?.chapter as any)?.settings?.chave_template ?? null,
      chapterName: activeChapter?.chapter.name ?? null,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Chave do dia copiada!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
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
      <div className="mt-1 text-xs text-muted-foreground">{formatDateTimeBR(next.start_at)}</div>
      {next.location && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {next.location}
        </div>
      )}
      <div className="mt-4">
        <Button variant="outline" className="w-full sm:w-auto" onClick={copyChave}>
          <Copy className="mr-2 h-4 w-4" /> Copiar chave do dia
        </Button>
      </div>
    </Card>
  );
}
