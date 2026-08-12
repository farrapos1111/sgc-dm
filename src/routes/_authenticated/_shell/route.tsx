import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useOrgScope } from "@/context/OrgScopeContext";
import { AppShell } from "@/components/shell/AppShell";
import { DelayedPageSkeleton } from "@/components/PageSkeleton";
import { Suspense, useEffect } from "react";
import {
  getClientRealm,
  getRealmForOrgType,
  hubAbsoluteUrl,
  realmEntryUrl,
  REALM_LABELS,
  type Realm,
} from "@/lib/realm";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { memberships, otherRealmMemberships, loading, active, activeChapterId } =
    useActiveChapter();
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
    const otherRealms = new Set<Realm>();
    for (const m of otherRealmMemberships) {
      const r = getRealmForOrgType(m.chapter.org_type);
      if (r) otherRealms.add(r);
    }
    const hostRealm = getClientRealm();
    if (otherRealms.size > 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="max-w-md rounded-[12px] border border-border bg-card p-6 text-sm">
            <p className="font-medium">
              Esta conta não tem instituição neste ambiente
              {hostRealm ? ` (${REALM_LABELS[hostRealm]})` : ""}.
            </p>
            <p className="mt-2 text-muted-foreground">
              Seus vínculos estão em:
            </p>
            <ul className="mt-3 space-y-2">
              {[...otherRealms].map((r) => (
                <li key={r}>
                  <a
                    href={realmEntryUrl(r)}
                    className="font-medium underline underline-offset-2"
                  >
                    {REALM_LABELS[r]}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Ou volte ao{" "}
              <a
                href={hubAbsoluteUrl()}
                className="underline underline-offset-2"
              >
                hub
              </a>
              .
            </p>
          </div>
        </div>
      );
    }
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
