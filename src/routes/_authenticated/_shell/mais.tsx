import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { BookOpen, Building2, LogOut, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import {
  mobileOverflowGroups,
  visibleGroups,
  visibleMobileTabs,
  visibleOrgGroups,
  type NavGroup,
} from "@/lib/nav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/mais")({
  head: () => ({
    meta: [
      { title: "Mais — SG-CDM" },
      { name: "description", content: "Menu completo, opções e sessão." },
    ],
  }),
  component: MaisPage,
});

function MaisPage() {
  const { active, memberships } = useActiveChapter();
  const { canView } = useCommissionAccess();
  const { activeScope, isGme } = useOrgScope();
  const navigate = useNavigate();
  const primary = active?.chapter.primary_color || "var(--chapter-primary)";

  const tabs = useMemo(
    () => visibleMobileTabs(Boolean(activeScope), canView),
    [activeScope, canView],
  );

  const groups = useMemo(() => {
    const all = activeScope
      ? visibleOrgGroups(isGme)
      : visibleGroups(active?.role.name ?? null, canView);
    return mobileOverflowGroups(all, tabs);
  }, [activeScope, isGme, active?.role.name, canView, tabs]);

  async function signOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sgcdm.activeChapterId");
      window.localStorage.removeItem("sgcdm.roleView");
    }
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <div
      className="-mx-4 -mb-24 -mt-4 min-h-[calc(100dvh-7.5rem)] px-4 pb-28 pt-6 text-white sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:mt-0 lg:min-h-0 lg:rounded-[16px] lg:px-6 lg:pb-8 lg:pt-6"
      style={{ backgroundColor: primary }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mais</h1>
        <p className="mt-1 text-sm text-white/75">Menu completo, preferências e sessão.</p>
      </header>

      <div className="space-y-3">
        {activeScope ? (
          <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
              <Building2 className="h-5 w-5" /> Escopo ativo
            </div>
            <div className="text-base font-semibold text-white">{activeScope.label}</div>
            <div className="text-sm text-white/75">{ORG_ROLE_LABELS[activeScope.orgRole]}</div>
          </section>
        ) : (
          <section className="rounded-[12px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white/75">
              <Building2 className="h-5 w-5" /> Capítulo ativo
            </div>
            <div className="text-base font-semibold text-white">{active?.chapter.name}</div>
            <div className="text-sm text-white/75">
              Nº {active?.chapter.number} · {active?.role.label}
            </div>
            {memberships.length > 1 && (
              <Button
                variant="outline"
                className="mt-4 border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate({ to: "/selecionar-capitulo" })}
              >
                <Repeat className="mr-2 h-4 w-4" /> Trocar de capítulo
              </Button>
            )}
          </section>
        )}

        {groups.map((group) => (
          <NavGroupCard key={group.id} group={group} />
        ))}

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
  const linkClass = cn(
    "flex min-h-[48px] items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15",
  );

  if (group.to) {
    return (
      <section className="rounded-[12px] border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
        <Link to={group.to} className={linkClass}>
          <GroupIcon className="h-5 w-5 shrink-0 text-white/80" />
          <span>{group.label}</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[12px] border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/70">
        <GroupIcon className="h-4 w-4" />
        {group.label}
      </div>
      <div className="space-y-0.5">
        {(group.items ?? []).map((item) => {
          const ItemIcon = item.icon;
          return (
            <Link key={item.to} to={item.to} className={linkClass}>
              <ItemIcon className="h-5 w-5 shrink-0 text-white/80" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
