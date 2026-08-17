import { createFileRoute, redirect } from "@tanstack/react-router";
import { HubLanding } from "@/components/hub/HubLanding";
import { getClientRealm } from "@/lib/realm";

export const Route = createFileRoute("/")({
  ssr: true,
  beforeLoad: () => {
    if (typeof window !== "undefined" && getClientRealm()) {
      throw redirect({ to: "/inicio", reloadDocument: true });
    }
  },
  head: () => ({
    meta: [
      { title: "Templo Virtual" },
      {
        name: "description",
        content:
          "A plataforma de gestão para Ordens Paramaçônicas e Lojas Maçônicas.",
      },
    ],
  }),
  component: HubLanding,
});
