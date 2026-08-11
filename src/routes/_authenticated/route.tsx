import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ActiveChapterProvider } from "@/context/ActiveChapterContext";
import { OrgScopeProvider } from "@/context/OrgScopeContext";
import { runAuthenticatedBeforeLoad } from "@/lib/auth-nav-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => runAuthenticatedBeforeLoad(),
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  if (!user) throw redirect({ to: "/auth" });
  return (
    <ActiveChapterProvider userId={user.id}>
      <OrgScopeProvider>
        <Outlet />
      </OrgScopeProvider>
    </ActiveChapterProvider>
  );
}
