import { createFileRoute } from "@tanstack/react-router";
import { LobbyMemberPortalPage } from "./c.$token.eu";

export const Route = createFileRoute("/$org/perfil")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Perfil — Templo Virtual" }],
  }),
  component: LobbyMemberPortalPage,
});
