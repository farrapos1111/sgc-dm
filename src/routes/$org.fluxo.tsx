import { createFileRoute } from "@tanstack/react-router";
import { usePublicLobby } from "@/context/PublicLobbyContext";
import { PublicCashFlowView } from "@/components/public/PublicCashFlowView";

export const Route = createFileRoute("/$org/fluxo")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Fluxo de caixa — Templo Virtual" }],
  }),
  component: OrgFluxoPage,
});

function OrgFluxoPage() {
  const { token } = usePublicLobby();
  return <PublicCashFlowView token={token} variant="standalone" />;
}
