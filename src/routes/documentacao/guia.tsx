import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";

const category = getDocsCategory("guia");

export const Route = createFileRoute("/documentacao/guia")({
  head: () => ({
    meta: [
      { title: `${category.label} — SG-CDM` },
      { name: "description", content: category.description },
    ],
  }),
  component: DocumentacaoGuia,
});

function DocumentacaoGuia() {
  return (
    <DocsLayout activeSlug="guia">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
