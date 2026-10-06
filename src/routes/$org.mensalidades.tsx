import { createFileRoute } from "@tanstack/react-router";
import { usePublicLobby } from "@/context/PublicLobbyContext";
import { PublicMensalidadesView } from "./mensalidades.$token";

export const Route = createFileRoute("/$org/mensalidades")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mensalidades — Templo Virtual" }],
  }),
  component: OrgMensalidadesPage,
});

function OrgMensalidadesPage() {
  const { token } = usePublicLobby();
  return <PublicMensalidadesView token={token} variant="standalone" />;
}
