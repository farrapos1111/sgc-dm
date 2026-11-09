import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
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
import { MyOfficeSignaturesPanel } from "@/components/profile/MyOfficeSignaturesPanel";
import { MyPasswordPanel } from "@/components/profile/MyPasswordPanel";
import {
  getMyDemolayProfile,
  type LinkedMemberSummary,
  type ProficiencyCardView,
} from "@/lib/profile.functions";
import { getMyCrossRealmFichas } from "@/lib/sphere-members.functions";
import { REALM_LABELS, getClientRealm, getRealmForOrgType } from "@/lib/realm";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { FdjMyProfile } from "@/components/fdj/FdjMembers";
import { affiliatedOrgsHeading } from "@/lib/org-types";
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
  const { active } = useActiveChapter();
  if (active && getRealmForOrgType(active.chapter.org_type) === "fdj") {
    return <FdjPerfil chapterId={active.chapter_id} />;
  }
  return <PerfilOdm />;
}

/** Bethel: ficha em fdj_members; sem carteirinha/financeiro ODM. */
function FdjPerfil({ chapterId }: { chapterId: string }) {
  const { data } = useSuspenseQuery(profileQO());
  return (
    <FdjMyProfile
      chapterId={chapterId}
      header={{ fullName: data.profile.fullName, email: data.profile.email }}
      passwordPanel={<MyPasswordPanel />}
    />
  );
}

function PerfilOdm() {
  const { data } = useSuspenseQuery(profileQO());
  const { data: crossRealm } = useQuery({
    queryKey: ["my-cross-realm-fichas"],
    queryFn: () => getMyCrossRealmFichas(),
  });
  const otherSphereFichas = (crossRealm?.fichas ?? []).filter(
    (f) => f.realm !== getClientRealm(),
  );
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
        title="Meu perfil"
        subtitle={
          data.profile.fullName
            ? `${data.profile.fullName}${data.profile.email ? ` · ${data.profile.email}` : ""}`
            : "Seu perfil na Ordem"
        }
      />

      {data.members.length === 0 ? (
        <div className="space-y-4">
          <MyPasswordPanel />
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">
              Nenhum cadastro de membro vinculado à sua conta neste ambiente.
              Peça ao Escrivão para conferir o e-mail no cadastro e liberar o
              acesso ao sistema.
            </p>
          </Card>
          {otherSphereFichas.length > 0 ? (
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <IdCard className="h-4 w-4" />
                Outras esferas
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Somente leitura. Permissões não atravessam o ambiente.
              </p>
              <ul className="space-y-3">
                {otherSphereFichas.map((f) => (
                  <li
                    key={`${f.realm}-${f.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5"
                  >
                    <div>
                      <div className="font-medium">
                        {f.chapterName} nº {f.chapterNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {REALM_LABELS[f.realm]}
                        {f.extra ? ` · ${f.extra}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline">{f.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {data.members.length > 1 ? (
            <Card className="p-4">
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
            <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-5">
            <ProfileSideCard
              member={selected}
              hasCards={data.cards.some((c) => c.memberId === selected.id)}
              onShowCards={() => setTab("carteirinhas")}
            />
            <div className="min-w-0">
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

              <TabsContent value="cadastro" className="mt-0 space-y-4">
                <MyCadastroPanel memberId={selected.id} />
                <MyOfficeSignaturesPanel memberId={selected.id} />
                <MyPasswordPanel />
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
                <Card className="p-5">
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

                <Card className="p-5">
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
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <IdCard className="h-4 w-4" />
                      {affiliatedOrgsHeading("capitulo")}
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
                {otherSphereFichas.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <IdCard className="h-4 w-4" />
                      Outras esferas
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Somente leitura. Permissões não atravessam o ambiente.
                    </p>
                    <ul className="space-y-3">
                      {otherSphereFichas.map((f) => (
                        <li
                          key={`${f.realm}-${f.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2.5"
                        >
                          <div>
                            <div className="font-medium">
                              {f.chapterName} nº {f.chapterNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {REALM_LABELS[f.realm]}
                              {f.extra ? ` · ${f.extra}` : ""}
                            </div>
                          </div>
                          <Badge variant="outline">{f.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </TabsContent>
            </Tabs>
            </div>
            </div>
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

/** Carteirinha digital + trajetória (D-Perfil / M-Perfil do redesign). */
function ProfileSideCard({
  member,
  hasCards,
  onShowCards,
}: {
  member: LinkedMemberSummary;
  hasCards: boolean;
  onShowCards: () => void;
}) {
  const regular = member.status === "regular";
  const steps = [
    { label: "Iniciação na Ordem", date: member.iniciacaoOrdem },
    { label: "Exame do Grau Iniciático", date: member.examGrauIniciatico },
    { label: "Iniciação no Grau DeMolay", date: member.iniciacaoGrauDemolay },
    { label: "Exame do Grau DeMolay", date: member.examGrauDemolay },
  ];
  const id = member.demolayId ?? member.masonicId;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[22px] bg-tv-primary p-5 text-white">
        <div
          aria-hidden
          className="absolute -bottom-16 -right-12 h-48 w-48 rounded-full border-[30px] border-white/[0.08]"
        />
        <div className="relative flex items-start justify-between gap-2">
          <span className="leading-tight">
            <span className="block text-xs font-semibold uppercase tracking-[0.08em] opacity-85">
              Carteirinha digital
            </span>
            <span className="mt-0.5 block text-sm font-semibold">
              {member.chapterName} nº {member.chapterNumber}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              regular ? "bg-white text-tv-in" : "bg-white text-tv-warn"
            }`}
          >
            {statusLabel(member.status)}
          </span>
        </div>
        <div className="relative mt-10">
          <span className="block font-display text-[22px] font-extrabold leading-tight">
            {member.fullName}
          </span>
          <span className="mt-1 block text-sm opacity-90">
            {kindLabel(member.kind)}
            {id ? ` · ID ${id}` : ""}
          </span>
        </div>
      </div>
      <Button variant="secondary" onClick={onShowCards}>
        <CreditCard className="h-[18px] w-[18px]" />
        {hasCards ? "Ver carteirinha de proficiência" : "Carteirinhas"}
      </Button>

      <div className="rounded-[20px] bg-tv-surface p-5">
        <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2">
          Minha trajetória
        </span>
        <ol className="mt-3">
          {steps.map((st, i) => (
            <li key={st.label} className="flex gap-3">
              <span className="flex flex-col items-center">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                    st.date ? "bg-tv-primary" : "border-2 border-[#DCDCD8] bg-tv-surface dark:border-tv-border"
                  }`}
                />
                {i < steps.length - 1 ? <span className="w-0.5 flex-1 bg-tv-line" /> : null}
              </span>
              <span className="pb-4">
                <span className={`block text-[15px] ${st.date ? "font-semibold" : "text-tv-text-2"}`}>
                  {st.label}
                </span>
                <span className="block text-[13px] text-tv-text-2">
                  {st.date ? formatDateBR(st.date) : "Ainda não registrado"}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-tv-text-2">
          Datas e graus são alterados apenas pela secretaria do capítulo de origem.
        </p>
      </div>
    </div>
  );
}
