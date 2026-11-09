import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, ChevronRight, Lightbulb, LogOut, Repeat, Search } from "lucide-react";
import {
  clearChapterSessionStorage,
  useActiveChapter,
} from "@/context/ActiveChapterContext";
import { useOrgScope, ORG_ROLE_LABELS } from "@/context/OrgScopeContext";
import { useNavGroups } from "@/hooks/useNavGroups";
import { useNavBadges } from "@/hooks/useNavBadges";
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
  const badges = useNavBadges();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const norm = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = norm(q.trim());
  const sections = groups
    .filter((g) => !g.to && (g.items?.length ?? 0) > 0)
    .map((g) => ({
      ...g,
      items: query
        ? (g.items ?? []).filter((i) => norm(i.label).includes(query) || norm(g.label).includes(query))
        : (g.items ?? []),
    }))
    .filter((g) => g.items.length > 0);
  const loose = groups.filter((g) => g.to && (!query || norm(g.label).includes(query)));

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

      <label className="mb-3.5 flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-tv-border bg-tv-surface px-3.5">
        <Search className="h-5 w-5 shrink-0 text-tv-text-2" aria-hidden />
        <span className="sr-only">Buscar função</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="O que você procura?"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tv-text-2"
        />
      </label>

      <div className="flex flex-col gap-3">
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
              <Tile key={i.to} to={i.to} label={i.label} icon={i.icon} badge={badges[i.to]} />
            ))}
          </Section>
        ))}

        {query && loose.length === 0 && sections.length === 0 ? (
          <p className="rounded-[20px] bg-tv-surface p-5 text-center text-[15px] text-tv-text-2">
            Nada encontrado para “{q.trim()}”.
          </p>
        ) : null}

        <section className="mt-2">
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
    <section className="rounded-[20px] bg-tv-surface p-4">
      <h2 className="mb-3 text-[15px] font-bold">{title}</h2>
      <div className="grid grid-cols-4 gap-x-1.5 gap-y-3 md:grid-cols-6">{children}</div>
    </section>
  );
}

function Tile({
  to,
  label,
  icon: Icon,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="relative flex flex-col items-center gap-1.5 rounded-[14px] py-1 text-center"
      aria-label={badge ? `${label} (${badge} pendentes)` : undefined}
    >
      <span className="grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-tv-soft text-tv-primary">
        <Icon className="h-6 w-6" />
      </span>
      {badge ? (
        <span
          aria-hidden
          className="absolute -top-1 right-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-tv-surface bg-[#B42318] px-1 text-[11px] font-bold text-white"
        >
          {badge}
        </span>
      ) : null}
      <span className="text-xs font-medium leading-tight text-[#2A2C31] dark:text-tv-text">{label}</span>
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
