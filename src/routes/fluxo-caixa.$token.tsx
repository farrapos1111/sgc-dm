import { createFileRoute } from "@tanstack/react-router";
import { PublicTokenMask } from "@/components/PublicTokenMask";
import { PublicCashFlowView } from "@/components/public/PublicCashFlowView";

export const Route = createFileRoute("/fluxo-caixa/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — Templo Virtual" },
      {
        name: "description",
        content: "Visualização pública do fluxo de caixa do capítulo.",
      },
    ],
  }),
  component: function PublicCashFlowRoute() {
    const { token } = Route.useParams();
    return (
      <>
        <PublicTokenMask token={token} section="fluxo" />
        <PublicCashFlowView token={token} variant="standalone" />
      </>
    );
  },
});
