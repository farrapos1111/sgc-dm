import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/financeiro")({
  beforeLoad: () => {
    throw redirect({ to: "/tesouraria/fluxo" });
  },
});
