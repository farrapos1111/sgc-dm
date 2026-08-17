import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthNavCache } from "@/lib/auth-nav-cache";
import {
  clearChapterSessionStorage,
  useActiveChapter,
} from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import {
  visibleGroups,
  visibleMobileTabs,
  visibleOrgGroups,
  type NavGroup,
} from "@/lib/nav";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OrgJoinInboxBell, OrgJoinInboxRealtimeBridge } from "@/components/shell/OrgJoinInboxBell";
import { formatClockInAppTz } from "@/lib/timezone";
import { useChapterLogo } from "@/lib/chapter-logo";
import {
  applyChapterThemeVars,
  applyPlatformDefaultThemeVars,
  resolveChapterTheme,
} from "@/lib/chapter-theme";
import { isChapterDuesEnabled, isDuesOnlyNavPath } from "@/lib/dues-rules";
import { compareOrgNumbers, ORG_TYPE_LABELS, normalizeOrgType } from "@/lib/org-types";
import { cn } from "@/lib/utils";

/** Rotas mais pesadas — prefetch ao passar o mouse/foco. */
const PRELOAD_ROUTES = [
  "/presencas",
  "/gestao",
  "/calendario",
  "/atas",
  "/inicio",
  "/membros",
  "/eventos",
  "/tesouraria/mensalidades",
  "/tesouraria/fluxo",
  "/perfil",
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const {
    active,
    memberships,
    setActiveChapterId,
    canSwitchRoleView,
    cycleRoleView,
  } = useActiveChapter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routerStatus = useRouterState({ select: (s) => s.status });
  const isNavigating = routerStatus === "pending";
  const { canView } = useCommissionAccess();
  const { ctx: accessCtx, positionLabels, canScreen, isAdminTotal } =
    useChapterAccess();
  const navigate = useNavigate();
  const {
    scopes,
    activeScope,
    setActiveScopeKey,
    canManageOrg,
    canManageChapters,
    canManageLeaderships,
  } = useOrgScope();
  const duesEnabled = isChapterDuesEnabled(
    active?.chapter as { settings?: Record<string, unknown> } | undefined,
  );
  const groups = useMemo(() => {
    const raw = activeScope
      ? visibleOrgGroups({
          canManageOrg,
          canManageChapters,
          canManageLeaderships,
        })
      : visibleGroups(active?.role.name ?? null, canView, accessCtx, {
          canScreen,
          isAdminTotal,
        });
    if (activeScope || duesEnabled) return raw;
    return raw.map((g) => ({
      ...g,
      items: (g.items ?? []).filter((i) => !isDuesOnlyNavPath(i.to)),
    }));
  }, [
    activeScope,
    canManageOrg,
    canManageChapters,
    canManageLeaderships,
    active?.role.name,
    canView,
    accessCtx,
    canScreen,
    isAdminTotal,
    duesEnabled,
  ]);
  const tabs = useMemo(
    () => visibleMobileTabs(Boolean(activeScope)),
    [activeScope],
  );

  function handleCycleRoleView() {
    const label = cycleRoleView();
    toast.message(`Visão: ${label}`);
  }

  const chapterSelectOptions = useMemo(() => {
    const byId = new Map<
      string,
      { value: string; label: string; number: string; name: string; typeLabel: string }
    >();
    for (const m of memberships) {
      if (byId.has(m.chapter_id)) continue;
      const number = m.chapter.number ?? "";
      const name = m.chapter.name;
      const typeLabel =
        ORG_TYPE_LABELS[normalizeOrgType(m.chapter.org_type)] ?? "Instituição";
      byId.set(m.chapter_id, {
        value: m.chapter_id,
        name,
        number,
        typeLabel,
        label: `${typeLabel} · ${name}`,
      });
    }
    return [...byId.values()].sort((a, b) =>
      compareOrgNumbers(a.number, b.number),
    );
  }, [memberships]);

  const viewSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = chapterSelectOptions.map(
      (ch) => ({
        value: `chapter:${ch.value}`,
        label: ch.label,
      }),
    );
    for (const s of scopes) {
      opts.push({
        value: s.key,
        label: `${ORG_ROLE_LABELS[s.orgRole]} · ${s.label}`,
      });
    }
    return opts;
  }, [chapterSelectOptions, scopes]);

  function handleViewChange(value: string) {
    if (value.startsWith("chapter:")) {
      const chapterId = value.slice("chapter:".length);
      setActiveScopeKey(null);
      if (chapterId && chapterId !== active?.chapter_id) {
        setActiveChapterId(chapterId);
        const opt = chapterSelectOptions.find((o) => o.value === chapterId);
        toast.message(`${opt?.typeLabel ?? "Instituição"}: ${opt?.name ?? "selecionado"}`);
      }
      navigate({ to: "/inicio" });
      return;
    }
    setActiveScopeKey(value);
    navigate({ to: "/regional" });
  }

  const viewSelectValue = activeScope?.key
    ? activeScope.key
    : active?.chapter_id
      ? `chapter:${active.chapter_id}`
      : memberships[0]
        ? `chapter:${memberships[0].chapter_id}`
        : (scopes[0]?.key ?? "");

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
    viewSelectOptions.length > 1 || scopes.length > 0 ? (
      <SearchableSelect
        value={viewSelectValue}
        options={viewSelectOptions}
        onChange={handleViewChange}
        placeholder="Selecionar visão"
        searchPlaceholder="Buscar instituição ou visão…"
        emptyText="Nenhum resultado."
        className="h-9 w-full text-xs"
      />
    ) : null;

  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  useEffect(() => {
    setPendingTo(null);
  }, [pathname]);

  // Limpa highlight de nav se o pending acabou sem mudar o path (ex.: redirect cancelado)
  useEffect(() => {
    if (routerStatus !== "pending") setPendingTo(null);
  }, [routerStatus]);

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");

  // Só sincroniza o accordion com a rota — não fecha submenu ao re-renderizar o menu
  useEffect(() => {
    const activeGroup = groupsRef.current.find((g) =>
      (g.items ?? []).some(
        (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
      ),
    );
    setOpenGroupId(activeGroup?.id ?? null);
  }, [pathname]);

  const primary =
    (activeScope?.primaryColor || active?.chapter.primary_color) || "#9E1B32";
  const chapterTheme = resolveChapterTheme(
    activeScope ? null : (active?.chapter.settings as Record<string, unknown> | null),
    primary,
  );

  useEffect(() => {
    applyChapterThemeVars(document.documentElement, chapterTheme);
    return () => {
      applyPlatformDefaultThemeVars(document.documentElement);
    };
  }, [
    chapterTheme.background,
    chapterTheme.accent,
    chapterTheme.accentDark,
    chapterTheme.highlight,
    chapterTheme.font,
    chapterTheme.sidebar,
  ]);

  const chapterName = activeScope
    ? activeScope.label
    : (active?.chapter.name ?? "Templo Virtual");
  const chapterNum = activeScope ? "" : (active?.chapter.number ?? "");
  const logoUrl = useChapterLogo(
    activeScope ? activeScope.logoUrl : active?.chapter.logo_url,
  );
  const cargoLabel =
    positionLabels.length > 0
      ? positionLabels.map((p) => p.label).join(" · ")
      : null;
  const headerSubtitle = activeScope
    ? [
        ORG_ROLE_LABELS[activeScope.orgRole],
        activeScope.startsOn && activeScope.endsOn
          ? `${activeScope.startsOn.split("-").reverse().join("/")} – ${activeScope.endsOn.split("-").reverse().join("/")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : (cargoLabel ?? "Membro Regular");
  const footerTitle = cargoLabel ?? "Membro Regular";
  const footerSubtitle = active?.chapter.city ?? "";

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      clearChapterSessionStorage();
      window.localStorage.removeItem("sgcdm.activeOrgScope");
    }
    clearAuthNavCache();
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
    try {
      void router
        .preloadRoute({ to: to as (typeof PRELOAD_ROUTES)[number] })
        .catch(() => {});
    } catch {
      // preload opcional — falhas de match não devem quebrar a UI
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OrgJoinInboxRealtimeBridge enabled={isAdminTotal} />
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <ChapterMark
            logoUrl={logoUrl}
            number={chapterNum}
            primary={primary}
            className="h-10 w-10 rounded-[10px] text-sm"
          />
          <div className="min-w-0 flex-1">
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
                  {footerTitle}
                </div>
                {footerSubtitle ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {footerSubtitle}
                  </div>
                ) : null}
              </div>
            )}
            {roleSwitchButton}
            {isAdminTotal ? <OrgJoinInboxBell className="shrink-0" /> : null}
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
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 py-3 text-sidebar-foreground backdrop-blur lg:hidden">
          <ChapterMark
            logoUrl={logoUrl}
            number={chapterNum}
            primary={primary}
            className="h-9 w-9 rounded-[8px] text-xs"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{chapterName}</div>
            {headerSubtitle && (
              <div className="truncate text-xs text-muted-foreground">
                {headerSubtitle}
              </div>
            )}
          </div>
          {roleSwitchButton}
          {isAdminTotal ? <OrgJoinInboxBell className="h-9 w-9 shrink-0" /> : null}
          <ThemeToggle className="shrink-0" />
        </header>

        {scopeSwitcher && (
          <div className="border-b border-sidebar-border bg-sidebar px-4 py-2 text-sidebar-foreground lg:hidden">
            {scopeSwitcher}
          </div>
        )}

        {isNavigating && (
          <div
            className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left animate-pulse lg:left-64"
            style={{ backgroundColor: primary }}
            role="progressbar"
            aria-label="Carregando página"
          />
        )}

        <main className="relative flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8 xl:px-10">
          <div
            className={`mx-auto w-full ${
              pathname.startsWith("/tesouraria/mensalidades") ||
              pathname.startsWith("/tesouraria/fluxo")
                ? "max-w-[1680px]"
                : "max-w-6xl"
            }`}
          >
            {children}
          </div>
        </main>

        {/* Bottom tabs (mobile) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden"
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

function ChapterMark({
  logoUrl,
  number,
  primary,
  className,
}: {
  logoUrl: string | null;
  number: string;
  primary: string;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-white dark:bg-zinc-900",
          className,
        )}
      >
        <img
          src={logoUrl}
          alt=""
          className="absolute inset-0 m-auto box-border h-full w-full object-contain p-1.5"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center font-bold text-white",
        className,
      )}
      style={{ backgroundColor: primary }}
      aria-hidden
    >
      {number ? number.slice(-3) : "SG"}
    </div>
  );
}
