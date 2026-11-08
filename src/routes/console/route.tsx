import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { applyPlatformDefaultThemeVars } from "@/lib/chapter-theme";

export const Route = createFileRoute("/console")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Console — Templo Virtual" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ConsoleRoot,
});

/** Console usa sempre o tema institucional, nunca a cor de uma instituição. */
function ConsoleRoot() {
  useEffect(() => {
    applyPlatformDefaultThemeVars();
  }, []);
  return <Outlet />;
}
