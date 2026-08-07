import { createFileRoute } from "@tanstack/react-router";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { PublicCashFlowView } from "./fluxo-caixa.$token";

export const Route = createFileRoute("/c/$token/fluxo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Fluxo de caixa — Templo Virtual" }],
  }),
  component: LobbyFluxoPage,
});

function LobbyFluxoPage() {
  const { token } = usePublicLobby();
  return (
    <div>
      <LobbyBackLink />
      <PublicCashFlowView token={token} variant="lobby" />
    </div>
  );
}
