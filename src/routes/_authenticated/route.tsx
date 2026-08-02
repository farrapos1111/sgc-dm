import { createFileRoute, Outlet, isRedirect, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ActiveChapterProvider } from "@/context/ActiveChapterContext";
import { OrgScopeProvider } from "@/context/OrgScopeContext";
import { getMustChangePassword } from "@/lib/accounts.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    try {
      const { mustChangePassword } = await getMustChangePassword();
      if (mustChangePassword) {
        throw redirect({ to: "/auth/redefinir-senha" });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <ActiveChapterProvider userId={user.id}>
      <OrgScopeProvider>
        <Outlet />
      </OrgScopeProvider>
    </ActiveChapterProvider>
  );
}
