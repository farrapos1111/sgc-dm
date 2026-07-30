import { createFileRoute } from "@tanstack/react-router";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { PublicMensalidadesView } from "./mensalidades.$token";

export const Route = createFileRoute("/c/$token/mensalidades")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mensalidades — SG-CDM" }],
  }),
  component: LobbyMensalidadesPage,
});

function LobbyMensalidadesPage() {
  const { token } = usePublicLobby();
  return (
    <div>
      <LobbyBackLink />
      <PublicMensalidadesView token={token} variant="lobby" />
    </div>
  );
}
