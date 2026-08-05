import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { ChapterLogoAvatar } from "@/components/ChapterLogoAvatar";
import { Input } from "@/components/ui/input";
import { matchesLooseSearch } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/selecionar-capitulo")({
  head: () => ({
    meta: [
      { title: "Selecionar capítulo — SG-CDM" },
      {
        name: "description",
        content: "Escolha o capítulo com o qual deseja trabalhar.",
      },
    ],
  }),
  component: ChapterPicker,
});

function ChapterPicker() {
  const { memberships, loading, setActiveChapterId } = useActiveChapter();
  const { setActiveScopeKey } = useOrgScope();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim();
    const rows = q
      ? memberships.filter((m) => {
          if (matchesLooseSearch(m.chapter.name, q)) return true;
          if (matchesLooseSearch(m.chapter.number, q)) return true;
          if (m.chapter.city && matchesLooseSearch(m.chapter.city, q))
            return true;
          if (matchesLooseSearch(m.role.label, q)) return true;
          return false;
        })
      : memberships;

    return [...rows].sort((a, b) => {
      const byName = a.chapter.name.localeCompare(b.chapter.name, "pt-BR", {
        sensitivity: "base",
      });
      if (byName !== 0) return byName;
      return a.chapter.number.localeCompare(b.chapter.number, "pt-BR", {
        numeric: true,
      });
    });
  }, [memberships, search]);

  function pick(chapterId: string) {
    setActiveScopeKey(null);
    setActiveChapterId(chapterId);
    navigate({ to: "/inicio" });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#E9E8E3] p-6 dark:bg-background"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#9E1B32" }}
          >
            <span className="text-xl font-bold text-white">SG</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Selecione o capítulo
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Você tem acesso a {memberships.length}{" "}
            {memberships.length === 1 ? "capítulo" : "capítulos"}. Escolha com
            qual deseja trabalhar agora.
          </p>
        </div>

        {!loading && memberships.length > 1 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Buscar por nome, número ou cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar capítulos"
              autoFocus={memberships.length > 8}
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
          ) : memberships.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum vínculo ativo.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum capítulo encontrado com essa busca.
            </p>
          ) : (
            visible.map((m) => (
              <button
                key={m.id}
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
                      className="mt-1.5 inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${m.chapter.primary_color || "#9E1B32"} 18%, transparent)`,
                        color: m.chapter.primary_color || "#9E1B32",
                      }}
                    >
                      {m.role.label}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
