import { createFileRoute } from "@tanstack/react-router";
import { LobbyPresencasPage } from "@/components/public/LobbyPresencasPage";

export const Route = createFileRoute("/c/$token/presencas")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Presenças — Templo Virtual" }],
  }),
  component: LobbyPresencasPage,
});
