import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2,
  History,
  Inbox,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getConsoleSession } from "@/lib/console/console.functions";

export const Route = createFileRoute("/console/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/console/entrar" });
    const s = await getConsoleSession();
    if (!s.isPlatformAdmin || s.aal !== "aal2") throw redirect({ to: "/console/entrar" });
    return { consoleUser: s };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Carregando…
    </div>
  ),
  component: ConsoleLayout,
});

const NAV = [
  { to: "/console", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/console/pedidos", label: "Pedidos", icon: Inbox },
  { to: "/console/instituicoes", label: "Instituições", icon: Building2 },
  { to: "/console/pessoas", label: "Pessoas", icon: Users },
  { to: "/console/cargos", label: "Cargos e acesso", icon: ListTree },
  { to: "/console/auditoria", label: "Auditoria", icon: History },
] as const;

function ConsoleLayout() {
  const { consoleUser } = Route.useRouteContext();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/console/entrar");
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: "exact" in item && item.exact }}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
          activeProps={{ className: "!bg-white/10 !text-white" }}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-3">
      <img src="/logos/templo-virtual.svg" alt="" className="h-7 w-7" />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Console</p>
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-white/45">Templo Virtual</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 px-3 pt-3 text-xs text-white/50">
      <p className="truncate">{consoleUser.email}</p>
      <button
        type="button"
        onClick={signOut}
        className="mt-2 inline-flex items-center gap-1.5 text-white/60 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 bg-[#070a13] py-5 lg:flex">
        {brand}
        <div className="flex flex-1 flex-col px-2">{nav}</div>
        {footer}
      </aside>

      {/* Mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#070a13] px-4 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-white/80"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-14 z-30 flex flex-col gap-4 bg-[#070a13] px-2 pb-4 lg:hidden">
          {nav}
          {footer}
        </div>
      )}

      <main className="px-4 py-6 sm:px-8 lg:ml-60 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
