import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ActiveChapterProvider } from "@/context/ActiveChapterContext";
import { OrgScopeProvider } from "@/context/OrgScopeContext";
import { runAuthenticatedBeforeLoad } from "@/lib/auth-nav-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => runAuthenticatedBeforeLoad(),
  pendingComponent: AuthenticatedPending,
  component: AuthenticatedLayout,
});

function AuthenticatedPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Carregando…</div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  if (!user) throw redirect({ to: "/auth", search: {}, reloadDocument: true });
  return (
    <ActiveChapterProvider userId={user.id}>
      <OrgScopeProvider>
        <Outlet />
      </OrgScopeProvider>
    </ActiveChapterProvider>
  );
}
