import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";

const category = getDocsCategory("open-source");

export const Route = createFileRoute("/documentacao/open-source")({
  head: () => ({
    meta: [
      { title: `${category.label} — SG-CDM` },
      { name: "description", content: category.description },
    ],
  }),
  component: DocumentacaoOpenSource,
});

function DocumentacaoOpenSource() {
  return (
    <DocsLayout activeSlug="open-source">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
