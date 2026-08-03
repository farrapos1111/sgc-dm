import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";
import {
  getSindicancia,
  type SindicanciaListItem,
} from "@/lib/investigations.functions";
import {
  SindicanciaAtaForm,
  type AtaFormMode,
} from "@/components/investigations/SindicanciaAtaForm";

type Search = { modo?: AtaFormMode };

export const Route = createFileRoute(
  "/_authenticated/_shell/sindicancias/sindicarias_/$eventId",
)({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const m = raw.modo;
    if (m === "roteiro" || m === "votacao" || m === "ata") return { modo: m };
    return { modo: "ata" };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Sindicância — SG-CDM` },
      {
        name: "description",
        content: `Ata / roteiro da sindicância ${params.eventId}`,
      },
    ],
  }),
  component: SindicanciaAtaPage,
});

function SindicanciaAtaPage() {
  const { eventId } = Route.useParams();
  const { modo = "ata" } = Route.useSearch();
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const writable = canManage("sindicancias");

  const { data: row, isLoading, error } = useQuery({
    queryKey: ["sindicancia", eventId],
    enabled: !!eventId,
    queryFn: (): Promise<SindicanciaListItem> =>
      getSindicancia({ data: { calendarEventId: eventId } }),
  });

  const title =
    modo === "roteiro"
      ? "Roteiro da Sindicância"
      : modo === "votacao"
        ? "Votação da Comissão"
        : "Ata de Sindicância";

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      <PageHeader
        title={title}
        subtitle={row?.nominee_name ?? "Carregando…"}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/sindicancias/sindicarias">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : error || !row || !active ? (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Não foi possível abrir a sindicância."}
        </p>
      ) : (
        <div className="rounded-[12px] border border-border/70 bg-card p-4 md:p-8">
          <SindicanciaAtaForm
            chapterId={active.chapter_id}
            accent={active.chapter.primary_color}
            row={row}
            writable={writable}
            mode={
              modo === "ata" && row.status === "votacao_comissao"
                ? "votacao"
                : modo
            }
          />
        </div>
      )}
    </div>
  );
}
