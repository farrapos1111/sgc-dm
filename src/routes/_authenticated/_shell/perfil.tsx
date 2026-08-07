import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CarteirinhaProficiencia,
  carteirinhaDialogClassName,
  type CarteirinhaDados,
} from "@/components/proficiency/CarteirinhaProficiencia";
import { MyCadastroPanel } from "@/components/profile/MyCadastroPanel";
import { MyAttendancePanel } from "@/components/profile/MyAttendancePanel";
import { MyFinancePanel } from "@/components/profile/MyFinancePanel";
import { MyHistoryPanel } from "@/components/profile/MyHistoryPanel";
import {
  getMyDemolayProfile,
  type LinkedMemberSummary,
  type ProficiencyCardView,
} from "@/lib/profile.functions";
import { formatDateBR, kindLabel, statusLabel } from "@/lib/format";
import {
  CalendarCheck,
  CreditCard,
  History,
  IdCard,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/perfil")({
  head: () => ({ meta: [{ title: "Perfil DeMolay — Templo Virtual" }] }),
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
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [tab, setTab] = useState("cadastro");

  useEffect(() => {
    if (data.members.length === 0) {
      setSelectedMemberId("");
      return;
    }
    if (
      !selectedMemberId ||
      !data.members.some((m) => m.id === selectedMemberId)
    ) {
      setSelectedMemberId(data.members[0].id);
    }
  }, [data.members, selectedMemberId]);

  const selected: LinkedMemberSummary | undefined = data.members.find(
    (m) => m.id === selectedMemberId,
  );

  return (
    <div>
      <PageHeader
        title="Perfil DeMolay"
        subtitle={
          data.profile.fullName
            ? `${data.profile.fullName}${data.profile.email ? ` · ${data.profile.email}` : ""}`
            : "Seu perfil na Ordem"
        }
      />

      {data.members.length === 0 ? (
        <Card className="rounded-[12px] p-5">
          <p className="text-sm text-muted-foreground">
            Nenhum cadastro de membro vinculado à sua conta. Peça ao Escrivão
            para conferir o e-mail no cadastro e liberar o acesso ao sistema.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.members.length > 1 ? (
            <Card className="rounded-[12px] p-4">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                Cadastro vinculado
              </label>
              <Select
                value={selectedMemberId}
                onValueChange={setSelectedMemberId}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName} · Cap. {m.chapterName} nº {m.chapterNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          ) : null}

          {selected ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
                <TabsTrigger value="cadastro" className="gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  Cadastro
                </TabsTrigger>
                <TabsTrigger value="frequencia" className="gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Frequência
                </TabsTrigger>
                <TabsTrigger value="cobrancas" className="gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Cobranças
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="carteirinhas" className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Carteirinhas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cadastro" className="mt-0">
                <MyCadastroPanel memberId={selected.id} />
              </TabsContent>

              <TabsContent value="frequencia" className="mt-0">
                <MyAttendancePanel memberId={selected.id} />
              </TabsContent>

              <TabsContent value="cobrancas" className="mt-0">
                <MyFinancePanel
                  memberId={selected.id}
                  chapterId={selected.chapterId}
                />
              </TabsContent>

              <TabsContent value="historico" className="mt-0">
                <MyHistoryPanel
                  memberId={selected.id}
                  demolay={{
                    grauLabel: selected.grauLabel,
                    iniciacaoOrdem: selected.iniciacaoOrdem,
                    iniciacaoGrauDemolay: selected.iniciacaoGrauDemolay,
                    examGrauIniciatico: selected.examGrauIniciatico,
                    examGrauDemolay: selected.examGrauDemolay,
                    demolayId: selected.demolayId,
                    masonicId: selected.masonicId,
                  }}
                />
              </TabsContent>

              <TabsContent value="carteirinhas" className="mt-0 space-y-4">
                <Card className="rounded-[12px] p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    Carteirinhas de Proficiência
                  </h2>
                  {data.cards.filter((c) => c.memberId === selected.id)
                    .length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma carteirinha ativa para este cadastro.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {data.cards
                        .filter((c) => c.memberId === selected.id)
                        .map((card) => (
                          <CardRow
                            key={card.id}
                            card={card}
                            onView={() => setViewCard(card.dados)}
                          />
                        ))}
                    </ul>
                  )}
                </Card>

                <Card className="rounded-[12px] p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Nobre Rito da Cavalaria
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Em breve. O registro e a visualização do Nobre Rito da
                    Cavalaria entrarão nesta área.
                  </p>
                </Card>

                {data.members.length > 1 ? (
                  <Card className="rounded-[12px] p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <IdCard className="h-4 w-4" />
                      Capítulos vinculados
                    </h2>
                    <ul className="space-y-3">
                      {data.members.map((m) => (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5"
                        >
                          <div>
                            <div className="font-medium">
                              {m.chapterName} nº {m.chapterNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[m.city, m.uf].filter(Boolean).join(" — ") ||
                                "—"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline">
                              {statusLabel(m.status)}
                            </Badge>
                            <Badge variant="outline">
                              {kindLabel(m.kind)}
                            </Badge>
                            <Badge variant="secondary">{m.grauLabel}</Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      )}

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
