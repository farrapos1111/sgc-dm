import { createFileRoute } from "@tanstack/react-router";
import { DemoApp } from "@/components/demo/DemoApp";

/** Ambiente de demonstração público: dados fictícios, tudo em memória, nada vai ao banco. */
export const Route = createFileRoute("/demonstracao")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demonstração · Templo Virtual" },
      {
        name: "description",
        content:
          "Experimente o Templo Virtual com dados fictícios: membros, chamada, fluxo de caixa, mensalidades e calendário.",
      },
    ],
  }),
  component: DemoApp,
});
