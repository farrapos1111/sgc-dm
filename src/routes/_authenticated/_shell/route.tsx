import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { AppShell } from "@/components/shell/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Suspense, useEffect } from "react";



export const Route = createFileRoute("/_authenticated/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { memberships, loading, active, activeChapterId } = useActiveChapter();
  const { scopes, activeScope, loading: orgLoading, setActiveScopeKey } = useOrgScope();
  const navigate = useNavigate();

  // Liderança supra-capitular sem vínculo de capítulo entra direto no escopo org.
  useEffect(() => {
    if (loading || orgLoading) return;
    if (memberships.length === 0 && scopes.length > 0 && !activeScope) {
      setActiveScopeKey(scopes[0].key);
    }
  }, [loading, orgLoading, memberships.length, scopes, activeScope, setActiveScopeKey]);

  useEffect(() => {
    if (loading) return;
    if (activeScope) return;
    if (memberships.length === 0) return;
    if (!activeChapterId && memberships.length > 1) {
      navigate({ to: "/selecionar-capitulo" });
    }
  }, [loading, memberships.length, activeChapterId, activeScope, navigate]);

  if (loading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  if (memberships.length === 0 && scopes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-[12px] border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Sua conta não está vinculada a nenhum capítulo. Contate o administrador do seu capítulo.
        </div>
      </div>
    );
  }

  if (!active && !activeScope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Selecione um capítulo…</div>
      </div>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );

}
