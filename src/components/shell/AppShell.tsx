import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import {
  visibleGroups,
  visibleMobileTabs,
  visibleOrgGroups,
  type NavGroup,
} from "@/lib/nav";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatClockInAppTz } from "@/lib/timezone";

/** Rotas mais pesadas — prefetch ao passar o mouse/foco. */
const PRELOAD_ROUTES = [
  "/presencas",
  "/gestao",
  "/calendario",
  "/atas",
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { active, canSwitchRoleView, cycleRoleView } = useActiveChapter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNavigating = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading === true,
  });
  const { canView } = useCommissionAccess();
  const navigate = useNavigate();
  const { scopes, activeScope, setActiveScopeKey, isGme } = useOrgScope();
  const groups = useMemo(
    () =>
      activeScope
        ? visibleOrgGroups(isGme)
        : visibleGroups(active?.role.name ?? null, canView),
    [activeScope, isGme, active?.role.name, canView],
  );
  const tabs = useMemo(
    () => visibleMobileTabs(Boolean(activeScope)),
    [activeScope],
  );

  function handleScopeChange(value: string) {
    if (value === "chapter") {
      setActiveScopeKey(null);
      navigate({ to: "/inicio" });
      return;
    }
    setActiveScopeKey(value);
    navigate({ to: "/regional" });
  }

  function handleCycleRoleView() {
    const label = cycleRoleView();
    toast.message(`Visão: ${label}`);
  }

  const roleSwitchButton =
    canSwitchRoleView && !activeScope ? (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9 shrink-0"
        onClick={handleCycleRoleView}
        aria-label="Alternar visão de cargo"
        title="Alternar visão de cargo"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </Button>
    ) : null;

  const scopeSwitcher =
    scopes.length > 0 ? (
      <Select
        value={activeScope?.key ?? "chapter"}
        onValueChange={handleScopeChange}
      >
        <SelectTrigger
          className="h-9 w-full text-xs"
          aria-label="Selecionar escopo"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {active && (
            <SelectItem value="chapter">{active.chapter.name}</SelectItem>
          )}
          {scopes.map((s) => (
            <SelectItem key={s.key} value={s.key}>
              {ORG_ROLE_LABELS[s.orgRole]} · {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    setPendingTo(null);
  }, [pathname]);

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");

  // Mantém aberto só o submenu da rota atual (accordion)
  useEffect(() => {
    const activeGroup = groups.find((g) =>
      (g.items ?? []).some(
        (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
      ),
    );
    setOpenGroupId(activeGroup?.id ?? null);
  }, [pathname, groups]);

  const primary = active?.chapter.primary_color || "#9E1B32";
  const chapterName = activeScope
    ? activeScope.label
    : (active?.chapter.name ?? "SG-CDM");
  const chapterNum = activeScope ? "" : (active?.chapter.number ?? "");
  const headerSubtitle = activeScope
    ? ORG_ROLE_LABELS[activeScope.orgRole]
    : (active?.role.label ?? "");

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sgcdm.activeChapterId");
      window.localStorage.removeItem("sgcdm.roleView");
    }
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  const navHighlight = (to: string) => pendingTo === to || isActive(to);

  /** Aba Mais: ativa em /mais ou em qualquer rota que não seja atalho da barra. */
  const isMaisTabHighlighted = (() => {
    if (pendingTo === "/mais" || isActive("/mais")) return true;
    const otherTabs = tabs.filter((t) => t.to !== "/mais");
    const matchesTab = (path: string) =>
      otherTabs.some((t) => path === t.to || path.startsWith(t.to + "/"));
    if (pendingTo) return !matchesTab(pendingTo);
    return !matchesTab(pathname);
  })();

  function preloadRoute(to: string) {
    if (!PRELOAD_ROUTES.includes(to as (typeof PRELOAD_ROUTES)[number])) return;
    void router
      .preloadRoute({ to: to as (typeof PRELOAD_ROUTES)[number] })
      .catch(() => {});
  }

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={
        { ["--chapter-primary" as string]: primary } as React.CSSProperties
      }
    >
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-sm font-bold text-white"
            style={{ backgroundColor: primary }}
          >
            {chapterNum ? chapterNum.slice(-3) : "SG"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{chapterName}</div>
            {chapterNum ? (
              <div className="text-xs text-muted-foreground">
                Nº {chapterNum}
              </div>
            ) : (
              headerSubtitle && (
                <div className="truncate text-xs text-muted-foreground">
                  {headerSubtitle}
                </div>
              )
            )}
          </div>
        </div>

        {scopeSwitcher && (
          <div className="border-b border-border px-3 py-3">
            {scopeSwitcher}
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {groups.map((group) => (
            <SidebarGroup
              key={group.id}
              group={group}
              primary={primary}
              isActive={isActive}
              isHighlighted={navHighlight}
              open={openGroupId === group.id}
              onOpenChange={(next) =>
                setOpenGroupId(
                  next
                    ? group.id
                    : openGroupId === group.id
                      ? null
                      : openGroupId,
                )
              }
              onNavigate={setPendingTo}
              onPreload={preloadRoute}
            />
          ))}
        </nav>

        <div className="px-4 pb-2 pt-1">
          <SidebarClock />
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            {active && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {active.role.label}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {active.chapter.city}
                </div>
              </div>
            )}
            {roleSwitchButton}
            <ThemeToggle className="shrink-0" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-xs font-bold text-white"
            style={{ backgroundColor: primary }}
          >
            {chapterNum ? chapterNum.slice(-3) : "SG"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{chapterName}</div>
            {headerSubtitle && (
              <div className="truncate text-xs text-muted-foreground">
                {headerSubtitle}
              </div>
            )}
          </div>
          {roleSwitchButton}
          <ThemeToggle className="shrink-0" />
        </header>

        {scopeSwitcher && (
          <div className="border-b border-border bg-card px-4 py-2 lg:hidden">
            {scopeSwitcher}
          </div>
        )}

        {(isNavigating || pendingTo) && (
          <div
            className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left animate-pulse lg:left-64"
            style={{ backgroundColor: primary }}
            role="progressbar"
            aria-label="Carregando página"
          />
        )}

        <main className="relative flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8 xl:px-10">
          <div
            className={`mx-auto w-full transition-opacity duration-150 ${
              pathname.startsWith("/tesouraria/mensalidades")
                ? "max-w-[1680px]"
                : "max-w-6xl"
            } ${
              isNavigating || pendingTo
                ? "pointer-events-none opacity-60"
                : "opacity-100"
            }`}
          >
            {children}
          </div>
        </main>

        {/* Bottom tabs (mobile) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card lg:hidden"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          }}
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            const highlighted =
              item.to === "/mais"
                ? isMaisTabHighlighted
                : navHighlight(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setPendingTo(item.to)}
                onMouseEnter={() => preloadRoute(item.to)}
                onFocus={() => preloadRoute(item.to)}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
                style={{
                  color: highlighted ? primary : "var(--muted-foreground)",
                }}
                aria-current={highlighted ? "page" : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Relógio em tempo real (fuso RS) acima do rodapé da sidebar. */
function SidebarClock() {
  const [label, setLabel] = useState(() => formatClockInAppTz());

  useEffect(() => {
    setLabel(formatClockInAppTz());
    const id = window.setInterval(() => setLabel(formatClockInAppTz()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      dateTime={new Date().toISOString()}
      className="block tabular-nums text-[11px] tracking-wide text-muted-foreground"
      title="Horário de Brasília / RS"
    >
      {label}
    </time>
  );
}

function SidebarGroup({
  group,
  primary,
  isActive,
  isHighlighted,
  open,
  onOpenChange,
  onNavigate,
  onPreload,
}: {
  group: NavGroup;
  primary: string;
  isActive: (to: string) => boolean;
  isHighlighted: (to: string) => boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (to: string) => void;
  onPreload: (to: string) => void;
}) {
  const Icon = group.icon;
  const hasActiveChild = (group.items ?? []).some((i) => isActive(i.to));
  const expanded = open || hasActiveChild;

  if (group.to) {
    const highlighted = isHighlighted(group.to);
    return (
      <Link
        to={group.to}
        onClick={() => onNavigate(group.to!)}
        onMouseEnter={() => onPreload(group.to!)}
        onFocus={() => onPreload(group.to!)}
        className="flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium transition-colors"
        style={
          highlighted
            ? { backgroundColor: `${primary}14`, color: primary }
            : { color: "var(--muted-foreground)" }
        }
      >
        <Icon className="h-5 w-5" />
        <span>{group.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          // Grupo da rota atual permanece aberto
          if (hasActiveChild && expanded) return;
          onOpenChange(!open);
        }}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/60"
        style={{ color: hasActiveChild ? primary : "var(--foreground)" }}
        aria-expanded={expanded}
      >
        <Icon className="h-5 w-5" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ease-out ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`mt-0.5 space-y-0.5 pl-4 transition-opacity duration-200 ease-out ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            {(group.items ?? []).map((item) => {
              const ItemIcon = item.icon;
              const highlighted = isHighlighted(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => onNavigate(item.to)}
                  onMouseEnter={() => onPreload(item.to)}
                  onFocus={() => onPreload(item.to)}
                  className="flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors"
                  style={
                    highlighted
                      ? { backgroundColor: `${primary}14`, color: primary }
                      : { color: "var(--muted-foreground)" }
                  }
                  tabIndex={expanded ? 0 : -1}
                >
                  <ItemIcon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
