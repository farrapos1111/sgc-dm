import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { BookOpen, Building2, Lightbulb, LogOut, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearChapterSessionStorage,
  useActiveChapter,
} from "@/context/ActiveChapterContext";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { isChapterDuesEnabled, isDuesOnlyNavPath } from "@/lib/dues-rules";
import {
  mobileOverflowGroups,
  visibleGroups,
  visibleMobileTabs,
  visibleOrgGroups,
  type NavGroup,
} from "@/lib/nav";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthNavCache } from "@/lib/auth-nav-cache";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/mais")({
  head: () => ({
    meta: [
      { title: "Mais — Templo Virtual" },
      { name: "description", content: "Menu completo, opções e sessão." },
    ],
  }),
  component: MaisPage,
});

function MaisPage() {
  const { active, memberships, setActiveChapterId } = useActiveChapter();
  const { canView } = useCommissionAccess();
  const { ctx: accessCtx, canScreen, isAdminTotal } = useChapterAccess();
  const {
    scopes,
    activeScope,
    setActiveScopeKey,
    canManageOrg,
    canManageChapters,
    canManageLeaderships,
  } = useOrgScope();
  const navigate = useNavigate();
  const primary =
    activeScope?.primaryColor ||
    active?.chapter.primary_color ||
    "var(--chapter-primary)";

  const tabs = useMemo(
    () => visibleMobileTabs(Boolean(activeScope)),
    [activeScope],
  );

  const groups = useMemo(() => {
    const duesEnabled = isChapterDuesEnabled(
      active?.chapter as { settings?: Record<string, unknown> } | undefined,
    );
    const all = activeScope
      ? visibleOrgGroups({
          canManageOrg,
          canManageChapters,
          canManageLeaderships,
        })
      : visibleGroups(active?.role.name ?? null, canView, accessCtx, {
          canScreen,
          isAdminTotal,
        });
    const filtered =
      activeScope || duesEnabled
        ? all
        : all.map((g) => ({
            ...g,
            items: (g.items ?? []).filter((i) => !isDuesOnlyNavPath(i.to)),
          }));
    return mobileOverflowGroups(filtered, tabs);
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
    tabs,
    active?.chapter,
  ]);

  function enterChapterView() {
    setActiveScopeKey(null);
    if (memberships.length === 0) return;
    if (!active) {
      if (memberships.length === 1) {
        setActiveChapterId(memberships[0].chapter_id);
        navigate({ to: "/inicio" });
        return;
      }
      navigate({ to: "/selecionar-capitulo" });
      return;
    }
    navigate({ to: "/inicio" });
  }

  function enterOrgScope(key: string) {
    setActiveScopeKey(key);
    navigate({ to: "/regional" });
  }

  async function signOut() {
    if (typeof window !== "undefined") {
      clearChapterSessionStorage();
      window.localStorage.removeItem("sgcdm.activeOrgScope");
    }
    clearAuthNavCache();
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  const chapterLabel =
    active?.chapter.name ??
    (memberships.length === 1 ? memberships[0].chapter.name : null);

  return (
    <div
      className="-mx-4 -mb-24 -mt-4 min-h-[calc(100dvh-7.5rem)] px-4 pb-28 pt-6 text-white sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:mt-0 lg:min-h-0 lg:rounded-[16px] lg:px-6 lg:pb-8 lg:pt-6"
      style={{ backgroundColor: primary }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mais</h1>
        <p className="mt-1 text-sm text-white/75">
          Menu completo, preferências e sessão.
        </p>
      </header>

      <div className="space-y-3">
        {activeScope ? (
          <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
              <Building2 className="h-5 w-5" /> Escopo ativo
            </div>
            <div className="text-base font-semibold text-white">
              {activeScope.label}
            </div>
            <div className="text-sm text-white/75">
              {ORG_ROLE_LABELS[activeScope.orgRole]}
            </div>
            {memberships.length > 0 && (
              <Button
                variant="outline"
                className="mt-4 border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                onClick={enterChapterView}
              >
                <Repeat className="mr-2 h-4 w-4" />
                {chapterLabel
                  ? `Entrar no capítulo · ${chapterLabel}`
                  : "Entrar na visão do capítulo"}
              </Button>
            )}
          </section>
        ) : (
          <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
              <Building2 className="h-5 w-5" /> Capítulo ativo
            </div>
            <div className="text-base font-semibold text-white">
              {active?.chapter.name}
            </div>
            <div className="text-sm text-white/75">
              Nº {active?.chapter.number} · {active?.role.label}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {memberships.length > 1 && (
                <Button
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                  onClick={() => navigate({ to: "/selecionar-capitulo" })}
                >
                  <Repeat className="mr-2 h-4 w-4" /> Trocar de instituição
                </Button>
              )}
              {scopes.map((s) => (
                <Button
                  key={s.key}
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                  onClick={() => enterOrgScope(s.key)}
                >
                  <Repeat className="mr-2 h-4 w-4" />
                  Visão {ORG_ROLE_LABELS[s.orgRole]} · {s.label}
                </Button>
              ))}
            </div>
          </section>
        )}

        {groups.map((group) => (
          <NavGroupCard key={group.id} group={group} />
        ))}

        <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
            <Lightbulb className="h-5 w-5" /> Portal de Sugestões
          </div>
          <div className="text-sm text-white/75">
            Contatos da Comissão de Tecnologia e Desenvolvimento do Templo
            Virtual.
          </div>
          <Button
            variant="outline"
            className="mt-4 border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
            onClick={() => navigate({ to: "/sugestoes" })}
          >
            Abrir portal de sugestões
          </Button>
        </section>

        <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
            <BookOpen className="h-5 w-5" /> Documentação
          </div>
          <div className="text-sm text-white/75">
            Guias técnicos, do usuário e de contribuição open source.
          </div>
          <Button
            variant="outline"
            className="mt-4 border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
            onClick={() => navigate({ to: "/documentacao" })}
          >
            Abrir documentação
          </Button>
        </section>

        <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
          <Button
            variant="outline"
            className="border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </section>
      </div>
    </div>
  );
}

function NavGroupCard({ group }: { group: NavGroup }) {
  const GroupIcon = group.icon;
  return (
    <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/75">
        <GroupIcon className="h-5 w-5" />
        {group.label}
      </div>
      <div className="space-y-1">
        {(group.items ?? []).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/15",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
