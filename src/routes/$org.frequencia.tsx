import { createFileRoute } from "@tanstack/react-router";
import { LobbyPresencasPage } from "@/components/public/LobbyPresencasPage";

export const Route = createFileRoute("/$org/frequencia")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Frequência — Templo Virtual" }],
  }),
  component: LobbyPresencasPage,
});
