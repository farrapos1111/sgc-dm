import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CarteirinhaProficiencia, carteirinhaDialogClassName } from "@/components/proficiency/CarteirinhaProficiencia";
import {
  issueProficiencyCard,
  listMemberProficiencyCards,
  revokeProficiencyCard,
  type ProficiencyCardView,
} from "@/lib/profile.functions";
import { formatDateBR } from "@/lib/format";

type Props = {
  chapterId: string;
  memberId: string;
  demolayId: string | null;
  examGrauIniciatico: string | null;
  examGrauDemolay: string | null;
  canManage: boolean;
};

export function MemberProficiencyCardPanel({
  chapterId,
  memberId,
  demolayId,
  examGrauIniciatico,
  examGrauDemolay,
  canManage,
}: Props) {
  const qc = useQueryClient();
  const { data: cards = [], isPending } = useQuery({
    queryKey: ["member-proficiency-cards", chapterId, memberId],
    queryFn: () =>
      listMemberProficiencyCards({ data: { chapterId, memberId } }),
    enabled: Boolean(chapterId && memberId),
  });

  const active = cards.find((c) => c.status === "active") ?? null;
  const [issueOpen, setIssueOpen] = useState(false);
  const [viewCard, setViewCard] = useState<ProficiencyCardView | null>(null);
  const [registro, setRegistro] = useState(demolayId ?? "");
  const [profIniciatico, setProfIniciatico] = useState(
    examGrauIniciatico?.slice(0, 10) ?? "",
  );
  const [profDemolay, setProfDemolay] = useState(
    examGrauDemolay?.slice(0, 10) ?? "",
  );
  const [validUntil, setValidUntil] = useState(
    `${new Date().getFullYear()}-12-31`,
  );

  function openIssue() {
    setRegistro(demolayId ?? "");
    setProfIniciatico(examGrauIniciatico?.slice(0, 10) ?? "");
    setProfDemolay(examGrauDemolay?.slice(0, 10) ?? "");
    setValidUntil(`${new Date().getFullYear()}-12-31`);
    setIssueOpen(true);
  }

  const issue = useMutation({
    mutationFn: () =>
      issueProficiencyCard({
        data: {
          chapterId,
          memberId,
          registroScdb: registro.trim() || null,
          profIniciatico: profIniciatico.trim() || null,
          profDemolay: profDemolay.trim() || null,
          validUntil: validUntil.trim() || null,
        },
      }),
    onSuccess: (card) => {
      toast.success("Carteirinha emitida");
      setIssueOpen(false);
      qc.invalidateQueries({
        queryKey: ["member-proficiency-cards", chapterId, memberId],
      });
      qc.invalidateQueries({ queryKey: ["my-demolay-profile"] });
      setViewCard(card);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível emitir"),
  });

  const revoke = useMutation({
    mutationFn: (cardId: string) =>
      revokeProficiencyCard({ data: { cardId } }),
    onSuccess: () => {
      toast.success("Carteirinha revogada");
      qc.invalidateQueries({
        queryKey: ["member-proficiency-cards", chapterId, memberId],
      });
      qc.invalidateQueries({ queryKey: ["my-demolay-profile"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível revogar"),
  });

  return (
    <>
      <Card className="rounded-[12px] p-5 md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Carteirinha de Proficiência
          </h3>
          {canManage && !active ? (
            <Button type="button" size="sm" onClick={openIssue}>
              Emitir carteirinha
            </Button>
          ) : null}
        </div>

        {isPending ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !active ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma carteirinha ativa neste capítulo.
            {canManage
              ? " O Mestre Conselheiro pode emitir o cartão CR80 a partir dos dados de grau do membro."
              : ""}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Ativa</Badge>
                <span className="font-mono text-sm">{active.verificationCode}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Emitida em {formatDateBR(active.issuedAt.slice(0, 10))}
                {active.dados.validade
                  ? ` · válida até ${formatDateBR(active.dados.validade)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewCard(active)}
              >
                Ver
              </Button>
              {canManage ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Revogar esta carteirinha? O membro deixará de vê-la no Perfil.",
                      )
                    ) {
                      revoke.mutate(active.id);
                    }
                  }}
                >
                  Revogar
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {cards.some((c) => c.status === "revoked") ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Histórico revogado ({cards.filter((c) => c.status === "revoked").length})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {cards
                .filter((c) => c.status === "revoked")
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-mono text-xs">{c.verificationCode}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewCard(c)}
                    >
                      Ver
                    </Button>
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir carteirinha de proficiência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="reg-scdb">Registro SCDB</Label>
              <Input
                id="reg-scdb"
                value={registro}
                onChange={(e) => setRegistro(e.target.value)}
                placeholder="ID DeMolay / matrícula"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prof-gi">Proficiência Grau Iniciático</Label>
                <Input
                  id="prof-gi"
                  type="date"
                  value={profIniciatico}
                  onChange={(e) => setProfIniciatico(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-dm">Proficiência Grau DeMolay</Label>
                <Input
                  id="prof-dm"
                  type="date"
                  value={profDemolay}
                  onChange={(e) => setProfDemolay(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valid-until">Válido até</Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIssueOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={issue.isPending}
              onClick={() => issue.mutate()}
            >
              Confirmar emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewCard)}
        onOpenChange={(open) => {
          if (!open) setViewCard(null);
        }}
      >
        <DialogContent className={carteirinhaDialogClassName}>
          <DialogHeader className="sr-only">
            <DialogTitle>Carteirinha de Proficiência</DialogTitle>
          </DialogHeader>
          <p className="carteirinha-dialog-title carteirinha-no-print">
            Carteirinha de Proficiência
          </p>
          {viewCard ? (
            <CarteirinhaProficiencia dados={viewCard.dados} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
