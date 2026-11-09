import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import {
  CheckSquare,
  Home,
  LayoutGrid,
  CalendarDays,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Menu lateral (desktop) — Sidebar.dc.html do redesign                */
/* ------------------------------------------------------------------ */

export function DesktopSidebar({
  brand,
  switcher,
  groups,
  isHighlighted,
  onNavigate,
  onPreload,
  footer,
  badges = {},
}: {
  badges?: Record<string, number | undefined>;
  brand: ReactNode;
  switcher: ReactNode;
  groups: NavGroup[];
  isHighlighted: (to: string) => boolean;
  onNavigate: (to: string) => void;
  onPreload: (to: string) => void;
  footer: ReactNode;
}) {
  // Itens soltos (Início, Perfil) abrem o menu sem título; grupos viram seções.
  const loose = groups.filter((g) => g.to);
  const sections = groups.filter((g) => !g.to && (g.items?.length ?? 0) > 0);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-[#E8E8E4] bg-tv-sidebar px-3.5 py-5 text-tv-text md:flex dark:border-tv-border">
      {brand}
      {switcher ? <div className="mt-4">{switcher}</div> : null}

      <nav
        aria-label="Menu principal"
        className="-mx-1 mt-[18px] flex flex-1 flex-col gap-3.5 overflow-y-auto px-1"
      >
        {loose.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {loose.map((g) => (
              <SidebarLink
                key={g.id}
                to={g.to!}
                label={g.label}
                icon={g.icon}
                active={isHighlighted(g.to!)}
                onNavigate={onNavigate}
                onPreload={onPreload}
              />
            ))}
          </div>
        )}
        {sections.map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6E75] dark:text-tv-text-2">
              {g.label}
            </span>
            {(g.items ?? []).map((i) => (
              <SidebarLink
                key={i.to}
                to={i.to}
                label={i.label}
                icon={i.icon}
                active={isHighlighted(i.to)}
                badge={badges[i.to]}
                onNavigate={onNavigate}
                onPreload={onPreload}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-3.5 border-t border-[#EEEEEA] pt-3.5 dark:border-tv-border">{footer}</div>
    </aside>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  active,
  badge,
  onNavigate,
  onPreload,
}: {
  badge?: number;
  to: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate: (to: string) => void;
  onPreload: (to: string) => void;
}) {
  return (
    <Link
      to={to}
      onClick={() => onNavigate(to)}
      onMouseEnter={() => onPreload(to)}
      onFocus={() => onPreload(to)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[42px] items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors",
        active
          ? "bg-tv-soft font-bold text-tv-ink"
          : "font-medium text-[#2A2C31] hover:bg-tv-bg dark:text-tv-text",
      )}
    >
      {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className="rounded-full bg-tv-warn-bg px-2 py-0.5 text-xs font-bold text-tv-warn"
          aria-label={`${badge} pendentes`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de abas (mobile) — TabBar.dc.html, Chamada no centro         */
/* ------------------------------------------------------------------ */

export type TabItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  central?: boolean;
};

/** Monta as 5 abas do redesign respeitando o que a pessoa pode ver. */
export function buildMobileTabs(canSee: (to: string) => boolean): TabItem[] {
  return [
    { to: "/inicio", label: "Início", icon: Home },
    canSee("/membros")
      ? { to: "/membros", label: "Membros", icon: Users }
      : { to: "/calendario", label: "Agenda", icon: CalendarDays },
    canSee("/presencas")
      ? { to: "/presencas", label: "Chamada", icon: CheckSquare, central: true }
      : { to: "/calendario", label: "Agenda", icon: CalendarDays, central: true },
    canSee("/tesouraria/fluxo")
      ? { to: "/tesouraria/fluxo", label: "Caixa", icon: Wallet }
      : { to: "/mais", label: "Mais", icon: LayoutGrid },
    { to: "/perfil", label: "Perfil", icon: UserRound },
  ].filter(
    // Evita aba duplicada (ex.: Agenda no slot 2 e no centro)
    (t, i, all) => all.findIndex((x) => x.to === t.to) === i,
  );
}

export function MobileTabBar({
  tabs,
  isHighlighted,
  onNavigate,
  onPreload,
}: {
  tabs: TabItem[];
  isHighlighted: (to: string) => boolean;
  onNavigate: (to: string) => void;
  onPreload: (to: string) => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 grid items-start border-t border-[#E6E6E2] bg-tv-surface px-1.5 pt-2 md:hidden dark:border-tv-border"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      {tabs.map((tab) => {
        const on = isHighlighted(tab.to);
        const Icon = tab.icon;
        if (tab.central) {
          return (
            <Link
              key={tab.to}
              to={tab.to}
              onClick={() => onNavigate(tab.to)}
              onFocus={() => onPreload(tab.to)}
              aria-current={on ? "page" : undefined}
              className="-mt-[22px] flex flex-col items-center gap-1"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-tv-surface bg-tv-primary text-white shadow-[0_6px_16px_rgba(20,20,20,0.18)]">
                <Icon className="h-[26px] w-[26px]" strokeWidth={2} aria-hidden />
              </span>
              <span
                className={cn("text-xs font-semibold", on ? "text-tv-primary" : "text-tv-text-2")}
              >
                {tab.label}
              </span>
            </Link>
          );
        }
        return (
          <Link
            key={tab.to}
            to={tab.to}
            onClick={() => onNavigate(tab.to)}
            onFocus={() => onPreload(tab.to)}
            aria-current={on ? "page" : undefined}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1"
          >
            <span
              className={cn(
                "grid h-[30px] w-[52px] place-items-center rounded-full",
                on ? "bg-tv-soft text-tv-primary" : "text-tv-text-2",
              )}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden />
            </span>
            <span
              className={cn(
                "text-xs",
                on ? "font-bold text-tv-primary" : "font-medium text-tv-text-2",
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Iniciais para avatares (ex.: "Lucas Boeira Borges" → "LB"). */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}
