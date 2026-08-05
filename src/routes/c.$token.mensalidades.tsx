import { createFileRoute, Link } from "@tanstack/react-router";
import { LobbyBackLink, usePublicLobby } from "@/context/PublicLobbyContext";
import { PublicMensalidadesView } from "./mensalidades.$token";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/c/$token/mensalidades")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Mensalidades — SG-CDM" }],
  }),
  component: LobbyMensalidadesPage,
});

function LobbyMensalidadesPage() {
  const { token, chapter } = usePublicLobby();
  if (chapter.dues_enabled === false) {
    return (
      <div>
        <LobbyBackLink />
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Este capítulo não cobra mensalidade.{" "}
          <Link
            to="/c/$token"
            params={{ token }}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Voltar ao menu
          </Link>
          .
        </Card>
      </div>
    );
  }
  return (
    <div>
      <LobbyBackLink />
      <PublicMensalidadesView token={token} variant="lobby" />
    </div>
  );
}
