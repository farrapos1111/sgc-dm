import { createFileRoute } from "@tanstack/react-router";
import { MovedToConsole } from "@/components/console/MovedToConsole";

export const Route = createFileRoute("/_authenticated/_shell/configuracoes-globais/inbox")({
  head: () => ({ meta: [{ title: "Inbox de solicitações — Templo Virtual" }] }),
  component: () => <MovedToConsole title="Inbox de solicitações" path="/console/pedidos" />,
});
