import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";
import { DOCS_META } from "@/lib/docs-meta";

const meta = DOCS_META["open-source"];

export const Route = createFileRoute("/documentacao/open-source")({
  head: () => ({
    meta: [
      { title: `${meta.label} — Templo Virtual` },
      { name: "description", content: meta.description },
    ],
  }),
  component: DocumentacaoOpenSource,
});

function DocumentacaoOpenSource() {
  const category = getDocsCategory("open-source");
  return (
    <DocsLayout activeSlug="open-source">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
