import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";

const category = getDocsCategory("tecnica");

export const Route = createFileRoute("/documentacao/tecnica")({
  head: () => ({
    meta: [
      { title: `${category.label} — Templo Virtual` },
      { name: "description", content: category.description },
    ],
  }),
  component: DocumentacaoTecnica,
});

function DocumentacaoTecnica() {
  return (
    <DocsLayout activeSlug="tecnica">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
