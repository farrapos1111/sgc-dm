import { createFileRoute } from "@tanstack/react-router";
import { LobbyMemberPortalPage } from "@/components/public/LobbyMemberPortalPage";

export const Route = createFileRoute("/c/$token/eu")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Área do membro — Templo Virtual" }],
  }),
  component: LobbyMemberPortalPage,
});
