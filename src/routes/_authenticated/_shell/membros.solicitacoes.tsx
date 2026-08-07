import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  listPendingChangeRequests,
  listPendingAffiliationRequests,
  reviewMemberChangeRequest,
  reviewMemberAffiliationRequest,
} from "@/lib/member-change-requests.functions";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Link2, Pencil, X } from "lucide-react";
import { formatDateTimeBR } from "@/lib/format";
import { formatChapterIdentity } from "@/lib/chapter-label";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/_shell/membros/solicitacoes")({
  head: () => ({ meta: [{ title: "Solicitações — SG-CDM" }] }),
  component: SolicitacoesPage,
});

function SolicitacoesPage() {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const chapterId = active?.chapter_id;

  const canReview = active
    ? can(active.role.name, "secretaria") || can(active.role.name, "admin")
    : false;

  const { data: changeReqs = [], isPending: loadingChanges } = useQuery({
    queryKey: ["member-change-requests", chapterId],
    queryFn: () =>
      listPendingChangeRequests({
        data: { originChapterId: chapterId! },
      }),
    enabled: !!chapterId,
  });

  const { data: affReqs = [], isPending: loadingAff } = useQuery({
    queryKey: ["member-affiliation-requests", chapterId],
    queryFn: () =>
      listPendingAffiliationRequests({
        data: { originChapterId: chapterId! },
      }),
    enabled: !!chapterId,
  });

  const reviewChange = useMutation({
    mutationFn: (input: {
      requestId: string;
      decision: "approved" | "rejected";
    }) =>
      reviewMemberChangeRequest({
        data: {
          requestId: input.requestId,
          decision: input.decision,
        },
      }),
    onSuccess: async (_r, vars) => {
      toast.success(
        vars.decision === "approved"
          ? "Alteração de dados aprovada"
          : "Alteração de dados recusada",
      );
      await qc.invalidateQueries({ queryKey: ["member-change-requests"] });
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["member"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewAff = useMutation({
    mutationFn: (input: {
      requestId: string;
      decision: "approved" | "rejected";
    }) =>
      reviewMemberAffiliationRequest({
        data: {
          requestId: input.requestId,
          decision: input.decision,
        },
      }),
    onSuccess: async (_r, vars) => {
      toast.success(
        vars.decision === "approved"
          ? "Vínculo aprovado — membro afiliado ao capítulo solicitante"
          : "Solicitação de vínculo recusada",
      );
      await qc.invalidateQueries({ queryKey: ["member-affiliation-requests"] });
      await qc.invalidateQueries({ queryKey: ["member-change-requests"] });
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["member"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!active) return null;

  if (loadingChanges || loadingAff) return <PageSkeleton />;

  const affiliations = affReqs as unknown as {
    id: string;
    created_at: string;
    member?: { id: string; full_name: string; demolay_id?: string | null } | null;
    requesting_chapter?: { name: string; number: string; city?: string | null } | null;
  }[];

  const changes = changeReqs as unknown as {
    id: string;
    created_at: string;
    changes: {
      field: string;
      label: string;
      before: string | null;
      after: string | null;
    }[];
    member?: { id: string; full_name: string; demolay_id?: string | null } | null;
    requesting_chapter?: { name: string; number: string; city?: string | null } | null;
  }[];

  const empty = affiliations.length === 0 && changes.length === 0;

  return (
    <div>
      <PageHeader
        title="Solicitações"
        subtitle="Vínculos e alterações de dados enviados por outros capítulos"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/membros">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      {empty ? (
        <EmptyState
          title="Nenhuma solicitação pendente"
          description="Pedidos de vínculo ou alteração de dados de membros originários deste capítulo aparecem aqui."
        />
      ) : (
        <div className="space-y-8">
          {affiliations.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Link2 className="h-4 w-4" /> Solicitações de vínculo
              </h2>
              {affiliations.map((req) => (
                <Card key={req.id} className="space-y-3 rounded-[12px] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {req.member?.full_name ?? "Membro"}
                        {req.member?.demolay_id ? (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ID {req.member.demolay_id}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatChapterIdentity(req.requesting_chapter)} solicita
                        vincular este membro · {formatDateTimeBR(req.created_at)}
                      </div>
                    </div>
                    <Badge variant="secondary">Vínculo</Badge>
                  </div>
                  {canReview && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={reviewAff.isPending}
                        style={{ backgroundColor: active.chapter.primary_color }}
                        onClick={() =>
                          reviewAff.mutate({
                            requestId: req.id,
                            decision: "approved",
                          })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" /> Aprovar vínculo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewAff.isPending}
                        onClick={() =>
                          reviewAff.mutate({
                            requestId: req.id,
                            decision: "rejected",
                          })
                        }
                      >
                        <X className="mr-1 h-4 w-4" /> Recusar
                      </Button>
                      {req.member?.id && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/membros/$id" params={{ id: req.member.id }}>
                            Ver ficha
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </section>
          )}

          {changes.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Pencil className="h-4 w-4" /> Solicitações de alteração de dados
              </h2>
              {changes.map((req) => (
                <Card key={req.id} className="space-y-3 rounded-[12px] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {req.member?.full_name ?? "Membro"}
                        {req.member?.demolay_id ? (
                          <span className="ml-2 text-sm text-muted-foreground">
                            ID {req.member.demolay_id}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Solicitado por{" "}
                        {formatChapterIdentity(req.requesting_chapter)} ·{" "}
                        {formatDateTimeBR(req.created_at)}
                      </div>
                    </div>
                    <Badge variant="secondary">Dados</Badge>
                  </div>

                  <ul className="space-y-2 rounded-md border border-border p-3 text-sm">
                    {(req.changes ?? []).map((c, i) => (
                      <li key={`${c.field}-${i}`}>
                        <span className="font-medium">{c.label}</span>
                        <div className="text-muted-foreground">
                          <span className="line-through">{c.before || "—"}</span>
                          {" → "}
                          <span className="text-foreground">{c.after || "—"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {canReview && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={reviewChange.isPending}
                        style={{ backgroundColor: active.chapter.primary_color }}
                        onClick={() =>
                          reviewChange.mutate({
                            requestId: req.id,
                            decision: "approved",
                          })
                        }
                      >
                        <Check className="mr-1 h-4 w-4" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewChange.isPending}
                        onClick={() =>
                          reviewChange.mutate({
                            requestId: req.id,
                            decision: "rejected",
                          })
                        }
                      >
                        <X className="mr-1 h-4 w-4" /> Recusar
                      </Button>
                      {req.member?.id && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/membros/$id" params={{ id: req.member.id }}>
                            Ver ficha
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
