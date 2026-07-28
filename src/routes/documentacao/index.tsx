import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DOCS_CATEGORIES } from "@/lib/docs-catalog";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/documentacao/")({
  head: () => ({
    meta: [
      { title: "Documentação — SG-CDM" },
      {
        name: "description",
        content:
          "Documentação do SG-CDM: técnica, guia do usuário e tutorial de contribuição open source.",
      },
    ],
  }),
  component: DocumentacaoHub,
});

function DocumentacaoHub() {
  return (
    <DocsLayout activeSlug="hub">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Documentação</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Guias do SG-CDM separados por público: quem desenvolve, quem usa no capítulo e quem quer
          contribuir com o código.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {DOCS_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                to={cat.to}
                className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 no-underline shadow-sm transition-colors hover:border-[#9E1B32]/45 hover:shadow-md sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: "#9E1B32" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#9E1B32]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{cat.label}</h2>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {cat.audience}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{cat.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DocsLayout>
  );
}
