import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import {
  Cake,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Gavel,
  MapPin,
  Radio,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Início — Main.dc.html (mobile) e D-Inicio.dc.html (desktop). Só apresentação. */

export type HomeShortcut = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

export type HomeViewProps = {
  greeting: string;
  firstName: string;
  roleLine: string;
  dateLine: string;
  chapterLabel: string;
  chapterMark: ReactNode;
  onSwitchChapter?: () => void;
  switchLabel?: string;
  hidden: boolean;
  onToggleHidden: () => void;
  ongoing: { id: string; title: string; when: string; typeLabel: string; to?: string | null }[];
  sindicancias: { id: string; title: string; when: string; badge: string; highlight: boolean }[];
  next: {
    title: string;
    typeLabel: string;
    when: string;
    inDays: string;
    location: string | null;
    copyLabel: string;
    canCopy: boolean;
    onCopy: () => void;
    chamadaTo: string | null;
  } | null;
  shortcutsMobile: HomeShortcut[];
  shortcutsDesktop: HomeShortcut[];
  finance: {
    saldo: string;
    resultado: string;
    resultadoNegative: boolean;
    monthName: string;
    entradas: string;
    saidas: string;
  } | null;
  financeError?: string | null;
  dues: { aberto: string; pendentes: number; pendingMembersLabel: string } | null;
  birthdays: {
    id: string;
    initials: string;
    name: string;
    info: string;
    today: boolean;
    past: boolean;
  }[];
  birthdayMonth: string;
  nextEvent: { name: string; when: string; info: string } | null;
  canCreateEvent: boolean;
  minutes: { id: string; title: string; date: string; status: string }[] | null;
};

const money = (hidden: boolean, v: string) => (hidden ? "R$ ••••" : v);

export function HomeView(p: HomeViewProps) {
  const EyeIcon = p.hidden ? EyeOff : Eye;
  const eyeLabel = p.hidden ? "Mostrar valores" : "Ocultar valores";

  return (
    <div className="pb-4">
      {/* ---------- Mobile: hero colorido ---------- */}
      <section className="-mx-4 -mt-4 bg-tv-primary px-5 pb-[76px] pt-4 text-white sm:-mx-6 sm:px-7 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={p.onSwitchChapter}
            className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-full bg-white/15 py-1.5 pl-1.5 pr-3 text-left"
          >
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full bg-white text-[15px] font-bold text-tv-primary">
              {p.chapterMark}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{p.chapterLabel}</span>
              <span className="block text-xs opacity-85">{p.switchLabel ?? "Trocar capítulo"}</span>
            </span>
            <ChevronDown className="h-[18px] w-[18px] shrink-0" />
          </button>
          <button
            type="button"
            onClick={p.onToggleHidden}
            aria-label={eyeLabel}
            title={eyeLabel}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15"
          >
            <EyeIcon className="h-[22px] w-[22px]" />
          </button>
        </div>
        <p className="mt-6 text-base opacity-90">{p.greeting},</p>
        <h1 className="mt-0.5 font-display text-[30px] font-extrabold tracking-[-0.02em]">
          {p.firstName}
        </h1>
        <p className="mt-1 text-sm opacity-90">{p.roleLine}</p>
      </section>

      {/* ---------- Desktop: cabeçalho ---------- */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={p.onToggleHidden}
            className="flex min-h-[46px] items-center gap-2 rounded-[12px] border border-tv-border bg-tv-surface px-3.5 text-sm font-semibold text-[#2A2C31] dark:text-tv-text"
          >
            <EyeIcon className="h-[18px] w-[18px]" />
            {eyeLabel}
          </button>
        </div>
        <h1 className="mt-2 font-display text-[32px] font-extrabold tracking-[-0.02em]">
          {p.greeting}, {p.firstName}
        </h1>
        <p className="mt-1 text-[15px] text-tv-text-2">{p.dateLine}</p>
      </div>

      <div className="flex flex-col gap-4 lg:mt-5 lg:gap-5">
        {/* Próximo compromisso + Caixa */}
        <div className="flex flex-col gap-4 lg:flex-row">
          {p.next ? (
            <NextCard next={p.next} />
          ) : (
            <div className="relative z-10 -mt-14 rounded-[22px] bg-tv-surface p-[18px] text-[15px] text-tv-text-2 shadow-[0_8px_24px_rgba(20,20,20,0.08)] lg:mt-0 lg:flex-[2] lg:shadow-none">
              Nenhum compromisso no calendário.{" "}
              <Link to="/calendario" className="font-semibold text-tv-primary">
                Abrir calendário
              </Link>
            </div>
          )}
          {p.finance ? (
            <FinanceCard f={p.finance} hidden={p.hidden} className="hidden lg:flex lg:flex-1" />
          ) : null}
        </div>

        {/* Acontecendo agora / sindicâncias */}
        {p.ongoing.length > 0 && (
          <Card>
            <CardTitle icon={Radio} pulse>
              Acontecendo agora
            </CardTitle>
            <ul className="mt-2">
              {p.ongoing.map((o) => (
                <li key={o.id} className="border-b border-tv-line last:border-0">
                  <RowLink to={o.to ?? null} search={o.to ? { tab: "chamada" } : undefined}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{o.title}</span>
                      <span className="block text-[13px] text-tv-text-2">{o.when}</span>
                    </span>
                    <Chip>{o.typeLabel}</Chip>
                  </RowLink>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {p.sindicancias.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <CardTitle icon={Gavel}>Sindicâncias em aberto</CardTitle>
              <Link
                to="/sindicancias/sindicarias"
                className="min-h-11 px-1 text-sm font-semibold leading-[44px] text-tv-primary"
              >
                Ver todas
              </Link>
            </div>
            <ul>
              {p.sindicancias.map((s) => (
                <li key={s.id} className="border-b border-tv-line last:border-0">
                  <RowLink to="/sindicancias/sindicarias">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{s.title}</span>
                      <span className="block text-[13px] text-tv-text-2">{s.when}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                        s.highlight
                          ? "bg-tv-primary text-white"
                          : "bg-tv-line text-[#3F4249] dark:text-tv-text",
                      )}
                    >
                      {s.badge}
                    </span>
                  </RowLink>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Acesso rápido */}
        {p.shortcutsMobile.length > 0 && (
          <section className="pt-2 lg:hidden">
            <h3 className="mb-3 text-[17px] font-bold">Acesso rápido</h3>
            <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
              {p.shortcutsMobile.map((a) => (
                <Link
                  key={a.to + a.label}
                  to={a.to}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <span className="grid h-[60px] w-[60px] place-items-center rounded-[18px] bg-tv-surface text-tv-primary shadow-[0_1px_2px_rgba(20,20,20,0.06)]">
                    <a.icon className="h-[26px] w-[26px]" />
                  </span>
                  <span className="text-[13px] font-medium leading-tight text-[#2A2C31] dark:text-tv-text">
                    {a.label}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {p.shortcutsDesktop.length > 0 && (
          <div className="hidden grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 lg:grid">
            {p.shortcutsDesktop.map((a) => (
              <Link
                key={a.to + a.label}
                to={a.to}
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-tv-surface p-4 transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-tv-soft text-tv-primary">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-semibold">{a.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Cartões */}
        <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-[repeat(auto-fit,minmax(320px,1fr))] lg:gap-4 lg:pt-0">
          {p.finance ? (
            <FinanceCard f={p.finance} hidden={p.hidden} className="lg:hidden" />
          ) : p.financeError ? (
            <Card>
              <CardTitle icon={Wallet}>Caixa</CardTitle>
              <p className="mt-2 text-sm text-tv-text-2">{p.financeError}</p>
            </Card>
          ) : null}

          {p.dues ? (
            <Card>
              <div className="flex items-center justify-between gap-2">
                <CardTitle icon={Receipt}>Mensalidades</CardTitle>
                {p.dues.pendentes > 0 ? (
                  <span className="rounded-full bg-tv-warn-bg px-2.5 py-1 text-xs font-semibold text-tv-warn">
                    {p.dues.pendingMembersLabel}
                  </span>
                ) : (
                  <span className="rounded-full bg-tv-in-bg px-2.5 py-1 text-xs font-semibold text-tv-in">
                    Em dia
                  </span>
                )}
              </div>
              <p className="mt-3.5 text-[15px] text-[#3F4249] dark:text-tv-text-2">
                <strong className="text-tv-text">{money(p.hidden, p.dues.aberto)}</strong> em aberto
                até este mês
              </p>
              <Link
                to="/tesouraria/mensalidades"
                className="mt-3.5 flex min-h-12 items-center justify-center rounded-[14px] bg-tv-soft text-[15px] font-semibold text-tv-ink"
              >
                Ver quem está pendente
              </Link>
            </Card>
          ) : null}

          <Card>
            <CardTitle icon={Cake}>Aniversariantes de {p.birthdayMonth}</CardTitle>
            {p.birthdays.length === 0 ? (
              <p className="mt-3 text-sm text-tv-text-2">Ninguém faz aniversário neste mês.</p>
            ) : (
              <ul className="mt-2">
                {p.birthdays.slice(0, 6).map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 border-b border-tv-line py-2.5 last:border-0"
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold",
                        n.today ? "bg-tv-soft text-tv-ink" : "bg-tv-line text-tv-text-2",
                      )}
                    >
                      {n.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[15px] font-semibold",
                          n.past && "text-[#3F4249] dark:text-tv-text-2",
                        )}
                      >
                        {n.name}
                      </span>
                      <span className="block text-[13px] text-tv-text-2">{n.info}</span>
                    </span>
                    {n.today ? (
                      <span className="shrink-0 rounded-full bg-tv-primary px-2.5 py-1 text-xs font-bold text-white">
                        Hoje
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {p.minutes && p.minutes.length > 0 ? (
            <Card className="hidden lg:block">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">Atas para acompanhar</span>
                <Link to="/atas" className="text-sm font-semibold text-tv-primary">
                  Ver todas
                </Link>
              </div>
              <ul className="mt-2">
                {p.minutes.map((m) => (
                  <li key={m.id} className="border-b border-tv-line last:border-0">
                    <Link to="/atas" className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{m.title}</span>
                        <span className="block text-[13px] text-tv-text-2">{m.date}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-tv-line px-2.5 py-0.5 text-xs font-semibold text-[#3F4249] dark:text-tv-text">
                        {m.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {p.nextEvent ? (
            <Link
              to="/eventos"
              className="flex items-center gap-3.5 rounded-[20px] bg-tv-surface p-[18px]"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-tv-soft text-tv-primary">
                <CalendarDays className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.nextEvent.name}</span>
                <span className="block text-[13px] text-tv-text-2">
                  {p.nextEvent.when} · {p.nextEvent.info}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-tv-text-2" />
            </Link>
          ) : (
            <div className="flex items-center gap-3.5 rounded-[20px] bg-tv-surface p-[18px]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-tv-line text-tv-text-2">
                <CalendarDays className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Nenhum evento agendado</span>
                <span className="block text-[13px] text-tv-text-2">
                  Eventos aparecem aqui assim que criados
                </span>
              </span>
              {p.canCreateEvent ? (
                <Link
                  to="/eventos/novo"
                  className="flex min-h-11 items-center rounded-[12px] bg-tv-soft px-3.5 text-sm font-semibold text-tv-ink"
                >
                  Criar
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NextCard({ next }: { next: NonNullable<HomeViewProps["next"]> }) {
  return (
    <>
      {/* Mobile: cartão branco sobre o hero */}
      <div className="relative z-10 -mt-14 flex flex-col gap-3 rounded-[22px] bg-tv-surface p-[18px] shadow-[0_8px_24px_rgba(20,20,20,0.08)] lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2">
            Próximo compromisso
          </span>
          <span className="rounded-full bg-tv-soft px-2.5 py-1 text-xs font-semibold text-tv-ink">
            {next.typeLabel}
          </span>
        </div>
        <h2 className="font-display text-xl font-bold leading-tight">{next.title}</h2>
        <div className="flex flex-col gap-1.5 text-[15px] text-[#3F4249] dark:text-tv-text-2">
          <span className="flex items-center gap-2">
            <Clock className="h-[18px] w-[18px] shrink-0" />
            {next.when}
          </span>
          {next.location ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-[18px] w-[18px] shrink-0" />
              {next.location}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex gap-2.5">
          <button
            type="button"
            onClick={next.onCopy}
            disabled={!next.canCopy}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-tv-primary text-[15px] font-semibold text-white disabled:opacity-60"
          >
            <Copy className="h-[18px] w-[18px]" />
            {next.copyLabel}
          </button>
          <Link
            to="/calendario"
            className="flex min-h-12 items-center rounded-[14px] border border-[#DCDCD8] bg-tv-surface px-4 text-[15px] font-semibold dark:border-tv-border"
          >
            Detalhes
          </Link>
        </div>
      </div>

      {/* Desktop: cartão na cor da marca */}
      <div className="relative hidden min-w-0 flex-[2] flex-col gap-3.5 overflow-hidden rounded-[22px] bg-tv-primary p-6 text-white lg:flex">
        <div
          aria-hidden
          className="absolute -bottom-20 -right-[60px] h-[260px] w-[260px] rounded-full border-[36px] border-white/[0.07]"
        />
        <div className="relative flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em] opacity-90">
            Próximo compromisso{next.inDays ? ` · ${next.inDays}` : ""}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
            {next.typeLabel}
          </span>
        </div>
        <h2 className="relative font-display text-[26px] font-extrabold leading-tight">
          {next.title}
        </h2>
        <div className="relative flex flex-wrap gap-x-5 gap-y-2 text-[15px] opacity-95">
          <span className="flex items-center gap-2">
            <Clock className="h-[18px] w-[18px]" />
            {next.when}
          </span>
          {next.location ? (
            <span className="flex items-center gap-2">
              <MapPin className="h-[18px] w-[18px]" />
              {next.location}
            </span>
          ) : null}
        </div>
        <div className="relative mt-1 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={next.onCopy}
            disabled={!next.canCopy}
            className="flex min-h-[46px] items-center gap-2 rounded-[12px] bg-white px-[18px] text-[15px] font-bold text-tv-primary disabled:opacity-70"
          >
            <Copy className="h-[18px] w-[18px]" />
            {next.copyLabel}
          </button>
          {next.chamadaTo ? (
            <Link
              to={next.chamadaTo}
              className="flex min-h-[46px] items-center rounded-[12px] bg-white/15 px-[18px] text-[15px] font-semibold text-white"
            >
              Abrir chamada
            </Link>
          ) : (
            <Link
              to="/calendario"
              className="flex min-h-[46px] items-center rounded-[12px] bg-white/15 px-[18px] text-[15px] font-semibold text-white"
            >
              Ver no calendário
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function FinanceCard({
  f,
  hidden,
  className,
}: {
  f: NonNullable<HomeViewProps["finance"]>;
  hidden: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/tesouraria/fluxo"
      className={cn(
        "flex min-w-0 flex-col rounded-[20px] bg-tv-surface p-[18px] lg:rounded-[22px] lg:p-[22px]",
        className,
      )}
    >
      <span className="flex items-center justify-between text-[15px] font-semibold">
        <span className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Caixa
        </span>
        <ChevronRight className="h-5 w-5 text-tv-text-2" />
      </span>
      <span className="mt-3.5 text-[13px] text-tv-text-2">Saldo atual</span>
      <span className="font-display text-[28px] font-extrabold tracking-[-0.02em] tabular-nums lg:text-[30px]">
        {money(hidden, f.saldo)}
      </span>
      <span className="mt-1 text-sm text-tv-text-2">
        Resultado de {f.monthName}:{" "}
        <span
          className={cn("font-semibold", f.resultadoNegative ? "text-[#B42318]" : "text-tv-in")}
        >
          {money(hidden, f.resultado)}
        </span>
      </span>
      <span className="flex-1" />
      <span className="mt-3.5 grid grid-cols-2 gap-2">
        <span className="rounded-[14px] bg-tv-in-bg px-3 py-2.5 lg:rounded-[12px]">
          <span className="block text-xs font-semibold text-[#1B6B44] dark:text-tv-in">
            Entradas
          </span>
          <span className="text-base font-bold text-tv-in">{money(hidden, f.entradas)}</span>
        </span>
        <span className="rounded-[14px] bg-tv-out-bg px-3 py-2.5 lg:rounded-[12px]">
          <span className="block text-xs font-semibold text-tv-out">Saídas</span>
          <span className="text-base font-bold text-[#8F1F16] dark:text-tv-out">
            {money(hidden, f.saidas)}
          </span>
        </span>
      </span>
    </Link>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[20px] bg-tv-surface p-[18px] lg:rounded-[22px] lg:p-[22px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({
  icon: Icon,
  children,
  pulse,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold">
      <Icon className={cn("h-5 w-5", pulse && "animate-pulse text-tv-primary")} />
      {children}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-tv-soft px-2.5 py-1 text-xs font-semibold text-tv-ink">
      {children}
    </span>
  );
}

function RowLink({
  to,
  search,
  children,
}: {
  to: string | null;
  search?: Record<string, string>;
  children: ReactNode;
}) {
  const cls = "flex min-h-14 items-center gap-3 py-2.5";
  if (!to) return <div className={cls}>{children}</div>;
  return (
    <Link to={to} search={search as never} className={cls}>
      {children}
    </Link>
  );
}
