import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { AppShell } from "@/components/shell/AppShell";
import { DelayedPageSkeleton } from "@/components/PageSkeleton";
import { Suspense, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { memberships, loading, active, activeChapterId } = useActiveChapter();
  const {
    scopes,
    activeScope,
    loading: orgLoading,
    setActiveScopeKey,
  } = useOrgScope();
  const navigate = useNavigate();

  // Liderança supra-capitular sem vínculo de capítulo entra no escopo org.
  useEffect(() => {
    if (loading || orgLoading) return;
    if (memberships.length === 0 && scopes.length > 0 && !activeScope) {
      setActiveScopeKey(scopes[0].key);
    }
  }, [
    loading,
    orgLoading,
    memberships.length,
    scopes,
    activeScope,
    setActiveScopeKey,
  ]);

  useEffect(() => {
    if (loading) return;
    if (activeScope) return;
    if (memberships.length === 0) return;
    const distinctChapters = new Set(memberships.map((m) => m.chapter_id));
    if (!activeChapterId && distinctChapters.size > 1) {
      navigate({ to: "/selecionar-capitulo" });
    }
  }, [loading, memberships, activeChapterId, activeScope, navigate]);

  // Só bloqueia o shell no 1º load (sem dados ainda). Refetch não esconde a UI.
  const bootstrapping =
    (loading && memberships.length === 0 && !activeScope) ||
    (orgLoading && scopes.length === 0 && memberships.length === 0);

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  if (
    !loading &&
    !orgLoading &&
    memberships.length === 0 &&
    scopes.length === 0
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-[12px] border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Sua conta não está vinculada a nenhuma instituição. Contate o
          administrador.
        </div>
      </div>
    );
  }

  if (!loading && !active && !activeScope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">
          Selecione uma instituição…
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<DelayedPageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
