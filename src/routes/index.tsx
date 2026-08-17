import { createFileRoute, redirect } from "@tanstack/react-router";
import { HubLanding } from "@/components/hub/HubLanding";
import { getClientRealm } from "@/lib/realm";

export const Route = createFileRoute("/")({
  ssr: true,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      const { getServerRequestRealm } = await import(
        "@/lib/request-realm.server"
      );
      if (getServerRequestRealm()) {
        throw redirect({ to: "/inicio" });
      }
      return;
    }
    if (getClientRealm()) {
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
