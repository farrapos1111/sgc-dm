import { createFileRoute } from "@tanstack/react-router";
import { SindicanciaConfigPanel } from "@/components/investigations/SindicanciaConfigPanel";

export const Route = createFileRoute(
  "/_authenticated/_shell/sindicancias/config",
)({
  head: () => ({
    meta: [
      { title: "Configurações — Sindicâncias — Templo Virtual" },
      {
        name: "description",
        content: "Templates e link público da comissão de sindicâncias.",
      },
    ],
  }),
  component: SindicanciaConfigPage,
});

function SindicanciaConfigPage() {
  return <SindicanciaConfigPanel />;
}
