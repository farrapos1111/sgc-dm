import { createFileRoute } from "@tanstack/react-router";
import { LobbyMemberPortalPage } from "@/components/public/LobbyMemberPortalPage";

export const Route = createFileRoute("/$org/perfil")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Perfil — Templo Virtual" }],
  }),
  component: LobbyMemberPortalPage,
});
