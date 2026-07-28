import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/documentacao")({
  component: DocumentacaoLayoutRoute,
});

function DocumentacaoLayoutRoute() {
  return <Outlet />;
}
