import { createFileRoute } from "@tanstack/react-router";
import { MovedToConsole } from "@/components/console/MovedToConsole";

export const Route = createFileRoute("/_authenticated/_shell/configuracoes-globais/cargos")({
  head: () => ({ meta: [{ title: "Cargos globais — Templo Virtual" }] }),
  component: () => <MovedToConsole title="Cargos globais" path="/console/cargos" />,
});
