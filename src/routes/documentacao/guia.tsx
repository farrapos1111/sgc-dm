import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";
import { DOCS_META } from "@/lib/docs-meta";

const meta = DOCS_META["guia"];

export const Route = createFileRoute("/documentacao/guia")({
  head: () => ({
    meta: [
      { title: `${meta.label} — Templo Virtual` },
      { name: "description", content: meta.description },
    ],
  }),
  component: DocumentacaoGuia,
});

function DocumentacaoGuia() {
  const category = getDocsCategory("guia");
  return (
    <DocsLayout activeSlug="guia">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
