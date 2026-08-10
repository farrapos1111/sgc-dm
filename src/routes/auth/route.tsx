import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { applyPlatformDefaultThemeVars } from "@/lib/chapter-theme";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

/** Telas de auth usam sempre o tema institucional (azul/branco). */
function AuthLayout() {
  useEffect(() => {
    applyPlatformDefaultThemeVars();
  }, []);

  return <Outlet />;
}
