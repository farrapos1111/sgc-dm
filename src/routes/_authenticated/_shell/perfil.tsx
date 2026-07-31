import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CarteirinhaProficiencia,
  carteirinhaDialogClassName,
  type CarteirinhaDados,
} from "@/components/proficiency/CarteirinhaProficiencia";
import {
  getMyDemolayProfile,
  type ProficiencyCardView,
} from "@/lib/profile.functions";
import { formatDateBR, kindLabel, statusLabel } from "@/lib/format";
import { CreditCard, IdCard, Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/perfil")({
  head: () => ({ meta: [{ title: "Perfil DeMolay — SG-CDM" }] }),
  component: PerfilPage,
});

const profileQO = () =>
  queryOptions({
    queryKey: ["my-demolay-profile"],
    queryFn: () => getMyDemolayProfile(),
  });

function PerfilPage() {
  const { data } = useSuspenseQuery(profileQO());
  const [viewCard, setViewCard] = useState<CarteirinhaDados | null>(null);

  const demolayIds = [
    ...new Set(
      data.members.map((m) => m.demolayId).filter((v): v is string => Boolean(v)),
    ),
  ];
  const masonicIds = [
    ...new Set(
      data.members.map((m) => m.masonicId).filter((v): v is string => Boolean(v)),
    ),
  ];

  return (
    <div>
      <PageHeader
        title="Perfil DeMolay"
        subtitle={
          data.profile.fullName
            ? `${data.profile.fullName}${data.profile.email ? ` · ${data.profile.email}` : ""}`
            : "Seu perfil global na Ordem"
        }
      />

      <div className="space-y-4">
        <Card className="rounded-[12px] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <IdCard className="h-4 w-4" />
            Capítulos vinculados
          </h2>
          {data.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cadastro de membro encontrado com o mesmo e-mail ou nome do
              seu perfil. Peça ao Escrivão para conferir o e-mail no cadastro.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5"
                >
                  <div>
                    <div className="font-medium">
                      Capítulo {m.chapterName} nº {m.chapterNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[m.city, m.uf].filter(Boolean).join(" — ") || "—"}
                      {" · "}
                      {m.fullName}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{statusLabel(m.status)}</Badge>
                    <Badge variant="outline">{kindLabel(m.kind)}</Badge>
                    <Badge variant="secondary">{m.grauLabel}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Shield className="h-4 w-4" />
            Identificações
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">ID DeMolay</dt>
              <dd className="mt-0.5 font-medium">
                {demolayIds.length > 0 ? demolayIds.join(" · ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">ID maçônico</dt>
              <dd className="mt-0.5 font-medium">
                {masonicIds.length > 0 ? masonicIds.join(" · ") : "—"}
              </dd>
            </div>
            {data.members.map((m) => (
              <div key={`grau-${m.id}`} className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Graus · {m.chapterName} nº {m.chapterNumber}
                </dt>
                <dd className="mt-0.5 text-sm">
                  {m.grauLabel}
                  {m.examGrauIniciatico
                    ? ` · Exame GI ${formatDateBR(m.examGrauIniciatico)}`
                    : ""}
                  {m.examGrauDemolay
                    ? ` · Exame DM ${formatDateBR(m.examGrauDemolay)}`
                    : ""}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Nobre Rito da Cavalaria
          </h2>
          <p className="text-sm text-muted-foreground">
            Em breve. O registro e a visualização do Nobre Rito da Cavalaria
            entrarão nesta área.
          </p>
        </Card>

        <Card className="rounded-[12px] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Carteirinhas de Proficiência
          </h2>
          {data.cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma carteirinha ativa. O Mestre Conselheiro do seu capítulo
              pode emitir em <strong>Membros → ficha do membro</strong>.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  onView={() => setViewCard(card.dados)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

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
          {viewCard ? <CarteirinhaProficiencia dados={viewCard} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardRow({
  card,
  onView,
}: {
  card: ProficiencyCardView;
  onView: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5">
      <div>
        <div className="font-medium">
          Capítulo {card.dados.capitulo} nº {card.dados.numero}
        </div>
        <div className="text-xs text-muted-foreground">
          Emitida em {formatDateBR(card.issuedAt.slice(0, 10))}
          {card.dados.validade
            ? ` · válida até ${formatDateBR(card.dados.validade)}`
            : ""}
          {" · "}
          {card.verificationCode}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onView}>
        Ver carteirinha
      </Button>
    </li>
  );
}
