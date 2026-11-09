import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Lightbulb, LogOut, Repeat } from "lucide-react";
import {
  clearChapterSessionStorage,
  useActiveChapter,
} from "@/context/ActiveChapterContext";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { useNavGroups } from "@/hooks/useNavGroups";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthNavCache } from "@/lib/auth-nav-cache";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/_shell/mais")({
  head: () => ({
    meta: [
      { title: "Tudo do capítulo — Templo Virtual" },
      { name: "description", content: "Menu completo, opções e sessão." },
    ],
  }),
  component: MaisPage,
});

/** "Tudo do capítulo" (M-Mais): menu completo em grade, agrupado como o menu lateral. */
function MaisPage() {
  const { active, memberships, setActiveChapterId } = useActiveChapter();
  const { scopes, activeScope, setActiveScopeKey } = useOrgScope();
  const { groups } = useNavGroups();
  const navigate = useNavigate();

  const sections = groups.filter((g) => !g.to && (g.items?.length ?? 0) > 0);
  const loose = groups.filter((g) => g.to);

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

  const chapterLine = activeScope
    ? `${ORG_ROLE_LABELS[activeScope.orgRole]} · ${activeScope.label}`
    : active
      ? `${active.chapter.name}${active.chapter.number ? ` nº ${active.chapter.number}` : ""}`
      : "";

  return (
    <div>
      <PageHeader title="Tudo do capítulo" subtitle={chapterLine} />

      <div className="flex flex-col gap-5">
        {loose.length > 0 && (
          <Section title="Atalhos">
            {loose.map((g) => (
              <Tile key={g.id} to={g.to!} label={g.label} icon={g.icon} />
            ))}
          </Section>
        )}
        {sections.map((g) => (
          <Section key={g.id} title={g.label}>
            {(g.items ?? []).map((i) => (
              <Tile key={i.to} to={i.to} label={i.label} icon={i.icon} />
            ))}
          </Section>
        ))}

        <section>
          <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-tv-text-2">
            Conta e opções
          </h2>
          <ul className="overflow-hidden rounded-[20px] bg-tv-surface">
            {activeScope && memberships.length > 0 ? (
              <Row onClick={enterChapterView} icon={Repeat} label="Voltar à visão do capítulo" />
            ) : null}
            {!activeScope && memberships.length > 1 ? (
              <Row
                onClick={() => navigate({ to: "/selecionar-capitulo" })}
                icon={Repeat}
                label="Trocar de instituição"
              />
            ) : null}
            {scopes
              .filter((s) => s.key !== activeScope?.key)
              .map((s) => (
                <Row
                  key={s.key}
                  onClick={() => enterOrgScope(s.key)}
                  icon={Repeat}
                  label={`Visão ${ORG_ROLE_LABELS[s.orgRole]} · ${s.label}`}
                />
              ))}
            <Row onClick={() => navigate({ to: "/sugestoes" })} icon={Lightbulb} label="Portal de sugestões" />
            <Row onClick={() => navigate({ to: "/documentacao" })} icon={BookOpen} label="Documentação" />
            <li className="flex min-h-14 items-center gap-3 border-b border-tv-line px-4 last:border-0">
              <span className="flex-1 text-[15px] font-semibold">Tema (claro ou escuro)</span>
              <ThemeToggle className="h-11 w-11 rounded-[12px] bg-tv-bg" />
            </li>
            <Row onClick={() => void signOut()} icon={LogOut} label="Sair" danger />
          </ul>
        </section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-tv-text-2">{title}</h2>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">{children}</div>
    </section>
  );
}

function Tile({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[18px] bg-tv-surface px-2 py-3 text-center transition-shadow hover:shadow-[0_4px_14px_rgba(20,20,20,0.07)]"
    >
      <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-tv-soft text-tv-primary">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
    </Link>
  );
}

function Row({
  onClick,
  icon: Icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}) {
  return (
    <li className="border-b border-tv-line last:border-0">
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-14 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold hover:bg-tv-bg ${
          danger ? "text-tv-out" : ""
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{label}</span>
        {danger ? null : <ChevronRight className="h-5 w-5 text-tv-text-2" />}
      </button>
    </li>
  );
}
