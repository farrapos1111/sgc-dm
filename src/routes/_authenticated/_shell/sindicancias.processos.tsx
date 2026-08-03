import { createFileRoute, redirect } from "@tanstack/react-router";

/** Processos foi renomeado para Sindicâncias. */
export const Route = createFileRoute("/_authenticated/_shell/sindicancias/processos")({
  beforeLoad: () => {
    throw redirect({ to: "/sindicancias/sindicarias" });
  },
});
