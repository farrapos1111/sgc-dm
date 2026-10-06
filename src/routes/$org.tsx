import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { resolvePublicOrgPath } from "@/lib/org-public-path.functions";
import { PublicLobbyContext } from "@/context/PublicLobbyContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/card";
import {
  applyChapterThemeVars,
  applyPlatformDefaultThemeVars,
  resolveChapterTheme,
} from "@/lib/chapter-theme";

export const Route = createFileRoute("/$org")({
  ssr: false,
  component: PublicOrgLayout,
});

function sectionFromPath(pathname: string, org: string) {
  const prefix = `/${org}`;
  const rest = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\//, "").split("/")[0] ?? ""
    : "";
  if (
    rest === "fluxo" ||
    rest === "mensalidades" ||
    rest === "frequencia" ||
    rest === "perfil" ||
    rest === "calendario" ||
    rest === "nominata"
  ) {
    return rest;
  }
  return "index" as const;
}

function PublicOrgLayout() {
  const { org } = Route.useParams();
  const { pathname } = useLocation();
  const section = sectionFromPath(pathname, org);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-org-path", org, section],
    queryFn: () => resolvePublicOrgPath({ data: { slug: org, section } }),
    retry: false,
    staleTime: 60_000,
  });

  const chapter = data?.chapter;
  const accent = chapter?.primary_color || "#9E1B32";
  const theme = resolveChapterTheme(null, accent);
  const bare =
    section === "fluxo" ||
    section === "mensalidades" ||
    section === "calendario" ||
    section === "nominata";

  useEffect(() => {
    if (!chapter) return;
    applyChapterThemeVars(document.documentElement, theme);
    return () => {
      applyPlatformDefaultThemeVars(document.documentElement);
    };
  }, [
    chapter,
    theme.accent,
    theme.background,
    theme.accentDark,
    theme.highlight,
    theme.font,
    theme.sidebar,
  ]);

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error).message ||
              "Este link público é inválido ou foi revogado."}
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading || !chapter || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  const body = (
    <PublicLobbyContext.Provider
      value={{
        token: data.token ?? "",
        chapter,
        slug: data.slug,
        sections: data.sections,
      }}
    >
      {bare ? (
        <Outlet />
      ) : (
        <div className="min-h-svh bg-background">
          <header
            className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"
            style={{ borderTop: `3px solid ${accent}` }}
          >
            <div className="mx-auto flex max-w-[1680px] items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Acesso público
                </p>
                <h1 className="truncate text-lg font-semibold sm:text-xl">
                  {chapter.name} nº {chapter.number}
                </h1>
                {chapter.city ? (
                  <p className="text-sm text-muted-foreground">{chapter.city}</p>
                ) : null}
              </div>
              <ThemeToggle className="h-9 w-9 shrink-0" />
            </div>
          </header>
          <main className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6">
            <Outlet />
          </main>
        </div>
      )}
    </PublicLobbyContext.Provider>
  );

  return body;
}
