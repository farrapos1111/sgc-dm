import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getPublicLobby } from "@/lib/lobby-share.functions";
import { PublicLobbyContext } from "@/context/PublicLobbyContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/c/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Capítulo — SG-CDM" },
      {
        name: "description",
        content: "Acesso público ao capítulo: mensalidades, fluxo, presenças e área do membro.",
      },
    ],
  }),
  component: PublicLobbyLayout,
});

function PublicLobbyLayout() {
  const { token } = useParams({ from: "/c/$token" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-lobby", token],
    queryFn: () => getPublicLobby({ data: { token } }),
    retry: false,
    staleTime: 60_000,
  });

  const chapter = data?.chapter;
  const accent = chapter?.primary_color || "#9E1B32";

  useEffect(() => {
    if (!accent) return;
    document.documentElement.style.setProperty("--chapter-primary", accent);
    return () => {
      document.documentElement.style.removeProperty("--chapter-primary");
    };
  }, [accent]);

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

  if (isLoading || !chapter) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <PublicLobbyContext.Provider value={{ token, chapter }}>
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
    </PublicLobbyContext.Provider>
  );
}
