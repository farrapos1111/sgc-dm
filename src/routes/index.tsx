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
      {
        title:
          "Templo Virtual · Gestão de ordens paramaçônicas e lojas maçônicas",
      },
      {
        name: "description",
        content:
          "Gestão e gerenciamento de ordens paramaçônicas e lojas maçônicas, em um só lugar. Gratuito para paramaçônicas, código aberto e feito para o celular.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&family=Questrial&display=swap",
      },
    ],
  }),
  component: HubLanding,
});
