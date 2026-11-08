import { createFileRoute } from "@tanstack/react-router";
import { PublicTokenMask } from "@/components/PublicTokenMask";
import { PublicMensalidadesView } from "@/components/public/PublicMensalidadesView";

export const Route = createFileRoute("/mensalidades/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mensalidades — Templo Virtual" },
      {
        name: "description",
        content: "Visualização pública do calendário de mensalidades.",
      },
    ],
  }),
  component: function PublicMensalidadesRoute() {
    const { token } = Route.useParams();
    return (
      <>
        <PublicTokenMask token={token} section="mensalidades" />
        <PublicMensalidadesView token={token} variant="standalone" />
      </>
    );
  },
});
