import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { ChapterLogoAvatar } from "@/components/ChapterLogoAvatar";
import { Input } from "@/components/ui/input";
import { matchesLooseSearch } from "@/lib/utils";
import { listMyChapterAccessLabels } from "@/lib/members.functions";
import { applyPlatformDefaultThemeVars } from "@/lib/chapter-theme";

export const Route = createFileRoute("/_authenticated/selecionar-capitulo")({
  head: () => ({
    meta: [
      { title: "Selecionar instituição — Templo Virtual" },
      {
        name: "description",
        content: "Escolha a instituição com a qual deseja trabalhar.",
      },
    ],
  }),
  component: ChapterPicker,
});

type InstitutionCard = {
  chapter_id: string;
  chapter: {
    id: string;
    name: string;
    number: string;
    city: string | null;
    primary_color: string;
    logo_url: string | null;
  };
  roleLabel: string;
};

function ChapterPicker() {
  const { memberships, loading, setActiveChapterId } = useActiveChapter();
  const { setActiveScopeKey } = useOrgScope();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    applyPlatformDefaultThemeVars();
  }, []);

  const institutions = useMemo((): InstitutionCard[] => {
    const byChapter = new Map<string, InstitutionCard>();
    for (const m of memberships) {
      const existing = byChapter.get(m.chapter_id);
      if (!existing) {
        byChapter.set(m.chapter_id, {
          chapter_id: m.chapter_id,
          chapter: m.chapter,
          roleLabel: m.role.label,
        });
        continue;
      }
      // Preferir rótulo de role mais específico que "Membro" se houver vários.
      if (
        existing.roleLabel.toLowerCase() === "membro" &&
        m.role.label.toLowerCase() !== "membro"
      ) {
        existing.roleLabel = m.role.label;
      }
    }
    return [...byChapter.values()];
  }, [memberships]);

  const chapterIds = useMemo(
    () => institutions.map((i) => i.chapter_id),
    [institutions],
  );

  const { data: cargoByChapter = {} } = useQuery({
    queryKey: ["my-chapter-access-labels", chapterIds.join(",")],
    queryFn: () =>
      listMyChapterAccessLabels({ data: { chapterIds } }),
    enabled: chapterIds.length > 0,
  });

  const visible = useMemo(() => {
    const q = search.trim();
    const rows = q
      ? institutions.filter((m) => {
          if (matchesLooseSearch(m.chapter.name, q)) return true;
          if (matchesLooseSearch(m.chapter.number, q)) return true;
          if (m.chapter.city && matchesLooseSearch(m.chapter.city, q))
            return true;
          const cargos = cargoByChapter[m.chapter_id] ?? [];
          if (cargos.some((c) => matchesLooseSearch(c, q))) return true;
          if (matchesLooseSearch(m.roleLabel, q)) return true;
          return false;
        })
      : institutions;

    return [...rows].sort((a, b) => {
      const an = Number(String(a.chapter.number).replace(/\D/g, ""));
      const bn = Number(String(b.chapter.number).replace(/\D/g, ""));
      if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
      const byNumber = a.chapter.number.localeCompare(b.chapter.number, "pt-BR", {
        numeric: true,
      });
      if (byNumber !== 0) return byNumber;
      return a.chapter.name.localeCompare(b.chapter.name, "pt-BR", {
        sensitivity: "base",
      });
    });
  }, [institutions, search, cargoByChapter]);

  function pick(chapterId: string) {
    setActiveScopeKey(null);
    setActiveChapterId(chapterId);
    navigate({ to: "/inicio" });
  }

  const count = institutions.length;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#E9E8E3] p-6 dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/logos/templo-virtual.svg"
            alt="Templo Virtual"
            className="mb-4 h-16 w-16"
            width={64}
            height={64}
          />
          <h1 className="text-xl font-bold text-foreground">
            Selecione a instituição
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Você está vinculado a {count}{" "}
            {count === 1 ? "instituição" : "instituições"}. Escolha com qual
            deseja trabalhar agora.
          </p>
        </div>

        {!loading && count > 1 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Buscar por nome, número, cidade ou cargo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar instituições"
              autoFocus={count > 8}
            />
            {search ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}

        <div className="max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto pr-0.5">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : count === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum vínculo ativo.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhuma instituição encontrada com essa busca.
            </p>
          ) : (
            visible.map((m) => {
              const cargos = cargoByChapter[m.chapter_id] ?? [];
              const badge =
                cargos.length > 0 ? cargos.join(" · ") : m.roleLabel;
              return (
                <button
                  key={m.chapter_id}
                  type="button"
                  onClick={() => pick(m.chapter_id)}
                  className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-muted-foreground/50"
                >
                  <div className="flex items-center gap-4">
                    <ChapterLogoAvatar
                      logoPath={m.chapter.logo_url}
                      number={m.chapter.number}
                      color={m.chapter.primary_color}
                      className="h-12 w-12 rounded-xl text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">
                        {m.chapter.name}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        Nº {m.chapter.number}
                        {m.chapter.city ? ` · ${m.chapter.city}` : ""}
                      </div>
                      <div
                        className="mt-1.5 inline-flex max-w-full items-center gap-2 truncate rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${m.chapter.primary_color || "#9E1B32"} 18%, transparent)`,
                          color: m.chapter.primary_color || "#9E1B32",
                        }}
                      >
                        {badge}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
