import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OficioDraftPanel } from "@/components/oficios/OficioEditor";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/oficios/novo")({
  head: () => ({
    meta: [{ title: "Novo ofício — SG-CDM" }],
  }),
  component: NovoOficioPage,
});

function NovoOficioPage() {
  const { active } = useActiveChapter();
  const { can, canScreen } = useChapterAccess();
  const navigate = useNavigate();
  const chapterId = active?.chapter_id ?? "";
  const allowed =
    canScreen("oficios", "create") ||
    canScreen("oficios", "edit") ||
    can("secretaria") ||
    can("admin");

  if (!allowed) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/oficios">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ofícios
          </Link>
        </Button>
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Sem permissão para emitir ofícios.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/oficios">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ofícios
        </Link>
      </Button>
      <PageHeader
        title="Novo ofício"
        subtitle="Redija o texto com modelos, variáveis dinâmicas e autocomplete de nomes — como nas atas."
      />
      <OficioDraftPanel
        chapterId={chapterId}
        canIssue={allowed}
        onIssued={(oficio) => {
          void navigate({
            to: "/oficios/$id",
            params: { id: oficio.id },
          });
        }}
      />
    </div>
  );
}
