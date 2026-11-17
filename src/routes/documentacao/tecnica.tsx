import { createFileRoute } from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { getDocsCategory } from "@/lib/docs-catalog";
import { DOCS_META } from "@/lib/docs-meta";

const meta = DOCS_META["tecnica"];

export const Route = createFileRoute("/documentacao/tecnica")({
  head: () => ({
    meta: [
      { title: `${meta.label} — Templo Virtual` },
      { name: "description", content: meta.description },
    ],
  }),
  component: DocumentacaoTecnica,
});

function DocumentacaoTecnica() {
  const category = getDocsCategory("tecnica");
  return (
    <DocsLayout activeSlug="tecnica">
      <MarkdownDoc content={category.content} title={category.title} />
    </DocsLayout>
  );
}
