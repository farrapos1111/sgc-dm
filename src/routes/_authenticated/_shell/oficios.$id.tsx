import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { OficioViewPanel } from "@/components/oficios/OficioEditor";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  deleteOficio,
  formatOficioNumber,
  getOficio,
} from "@/lib/oficios.functions";
import { can } from "@/lib/permissions";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/oficios/$id")({
  head: () => ({
    meta: [{ title: `Ofício — SG-CDM` }],
  }),
  component: OficioDetailPage,
});

const oficioQO = (id: string) =>
  queryOptions({
    queryKey: ["oficio", id],
    queryFn: () => getOficio({ data: { id } }),
  });

function OficioDetailPage() {
  const { id } = Route.useParams();
  const { data: oficio } = useSuspenseQuery(oficioQO(id));
  const { active } = useActiveChapter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const allowed =
    can(active?.role.name, "secretaria") || can(active?.role.name, "admin");

  const remove = useMutation({
    mutationFn: () => deleteOficio({ data: { id: oficio.id } }),
    onSuccess: () => {
      toast.success("Ofício excluído");
      void qc.invalidateQueries({
        queryKey: ["oficios", oficio.chapter_id],
      });
      void qc.invalidateQueries({
        queryKey: ["oficio-issue-context", oficio.chapter_id],
      });
      navigate({ to: "/oficios" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/oficios">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ofícios
        </Link>
      </Button>
      <PageHeader
        title={formatOficioNumber(oficio.number, oficio.year)}
        subtitle={oficio.title}
        actions={
          allowed ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={remove.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Excluir ofício?",
                  description: `Excluir ${formatOficioNumber(oficio.number, oficio.year)} — “${oficio.title}”? Esta ação não pode ser desfeita.`,
                  confirmLabel: "Excluir",
                });
                if (ok) remove.mutate();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          ) : undefined
        }
      />
      <OficioViewPanel oficio={oficio} />
      {dialog}
    </div>
  );
}
