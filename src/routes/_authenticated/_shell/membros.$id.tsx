import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { getMember, revealMemberPii } from "@/lib/members.functions";
import {
  getMemberOrgHistory,
  listCatalog,
  assignPosition,
  removePosition,
  assignCommissionMember,
  removeCommissionMember,
} from "@/lib/organization.functions";
import { currentTerm, termLabel, termOptions, chapterFoundedAt, type Term } from "@/lib/terms";
import { TermSelect } from "@/components/TermSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import { getMemberAttendance } from "@/lib/attendance.functions";
import { TYPE_META, type CalendarType } from "@/lib/calendar-types";
import { can } from "@/lib/permissions";
import { getMemberFinance } from "@/lib/finance.functions";
import { MONTH_SHORT } from "@/lib/dues-rules";
import { Progress } from "@/components/ui/progress";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatBRL,
  formatCpfMask,
  formatRgMask,
  formatDateBR,
  formatDateTimeBR,
  statusLabel,
  kindLabel,
  grauOf,
  isAptoGrauDemolay,
} from "@/lib/format";
import {
  ArrowLeft,
  Banknote,
  Eye,
  Pencil,
  Plus,
  Receipt,
  Shield,
  Trash2,
} from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";

export const Route = createFileRoute("/_authenticated/_shell/membros/$id")({
  head: () => ({ meta: [{ title: "Perfil do membro — SG-CDM" }] }),
  component: MembroPerfil,
});

const memberQO = (id: string) =>
  queryOptions({
    queryKey: ["member", id],
    queryFn: () => getMember({ data: { id } }),
  });

const orgQO = (memberId: string) =>
  queryOptions({
    queryKey: ["member-org", memberId],
    queryFn: () => getMemberOrgHistory({ data: { memberId } }),
  });

const attendanceQO = (memberId: string) =>
  queryOptions({
    queryKey: ["member-attendance", memberId],
    queryFn: () => getMemberAttendance({ data: { memberId } }),
  });

function MembroPerfil() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dados");
  const { active } = useActiveChapter();
  const { data } = useSuspenseQuery(memberQO(id));
  const { member, guardians, consents, audit, awayPeriods = [], irregularSince } = data;
  const chapterId = (member as { chapter_id?: string }).chapter_id ?? active?.chapter_id ?? "";

  const needsOrg = tab === "cargos";
  const needsAttendance = tab === "presencas";
  const needsFinance = tab === "financeiro";
  const [financeYear, setFinanceYear] = useState(() => new Date().getFullYear());

  const { data: org, isPending: orgPending } = useQuery({
    ...orgQO(id),
    enabled: needsOrg,
  });
  const { data: attendance = [], isPending: attendancePending } = useQuery({
    ...attendanceQO(id),
    enabled: needsAttendance,
  });
  const { data: finance, isPending: financePending } = useQuery({
    queryKey: ["member-finance", chapterId, id, financeYear],
    queryFn: () =>
      getMemberFinance({
        data: { chapterId, memberId: id, year: financeYear },
      }),
    enabled: needsFinance && Boolean(chapterId),
  });
  const orgData = org ?? { positions: [] as any[], commissions: [] as any[] };

  const mandatoryRecs = (attendance as any[]).filter((r) => r.calendar_event?.mandatory);
  const mandatoryPresent = mandatoryRecs.filter((r) => r.status === "presente").length;
  const mandatoryPct =
    mandatoryRecs.length > 0 ? Math.round((mandatoryPresent / mandatoryRecs.length) * 100) : null;


  const [revealed, setRevealed] = useState<{ cpf?: string; rg?: string }>({});
  const reveal = useMutation({
    mutationFn: (field: "cpf" | "rg") =>
      revealMemberPii({ data: { memberId: id, field } }),
    onSuccess: (res, field) => {
      setRevealed((r) => ({ ...r, [field]: res.value }));
      toast.success(`${field.toUpperCase()} revelado (auditoria registrada)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Sem permissão"),
  });

  // --- Edição de cargos e comissões no perfil ---
  const qc = useQueryClient();
  const roleName = active?.role.name;
  const canEditOrg = can(roleName, "conselho") || can(roleName, "secretaria");
  const isAdminView = canEditOrg || can(roleName, "admin");
  const foundedAt = chapterFoundedAt(active?.chapter);
  const [term, setTerm] = useState(currentTerm());

  const { data: catalog } = useQuery({
    queryKey: ["org-catalog"],
    queryFn: () => listCatalog(),
    enabled: canEditOrg,
  });

  function refreshOrg() {
    qc.invalidateQueries({ queryKey: ["member-org", id] });
    qc.invalidateQueries({ queryKey: ["chapter-positions"] });
    qc.invalidateQueries({ queryKey: ["commission-members"] });
  }

  const addPos = useMutation({
    mutationFn: (v: { positionId: number; year: number; semester: 1 | 2 }) =>
      assignPosition({
        data: {
          chapterId,
          memberId: id,
          positionId: v.positionId,
          year: v.year,
          semester: v.semester,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado: cargo designado");
      refreshOrg();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível designar"),
  });
  const delPos = useMutation({
    mutationFn: (rowId: string) => removePosition({ data: { id: rowId } }),
    onSuccess: () => {
      toast.success("Perfil atualizado: cargo removido");
      refreshOrg();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const addCom = useMutation({
    mutationFn: (v: {
      commissionId: number;
      role: any;
      year?: number;
      semester?: 1 | 2;
    }) =>
      assignCommissionMember({
        data: {
          chapterId,
          memberId: id,
          commissionId: v.commissionId,
          role: v.role,
          year: v.year ?? term.year,
          semester: v.semester ?? term.semester,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado: participação registrada");
      refreshOrg();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delCom = useMutation({
    mutationFn: (rowId: string) => removeCommissionMember({ data: { id: rowId } }),
    onSuccess: () => {
      toast.success("Perfil atualizado: participação removida");
      refreshOrg();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });


  return (
    <div>
      <PageHeader
        title={member.full_name}
        subtitle={(() => {
          const kind = (member as { kind?: string }).kind;
          const parts = [statusLabel(member.status), kindLabel(kind)];
          if (kind !== "senior" && kind !== "macom") parts.push(grauOf(member).label);
          return parts.join(" · ");
        })()}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/membros" })}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/membros/$id/editar", params: { id } })}
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="presencas">Presenças</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>

          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="rounded-[12px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Identificação</h3>
              <dl className="space-y-2 text-sm">
                <Row k="Nome" v={member.full_name} />
                <Row k="Nascimento" v={formatDateBR(member.birth_date)} />
                <Row
                  k="Grau"
                  v={
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline">{grauOf(member).label}</Badge>
                      {isAdminView && isAptoGrauDemolay(member) && (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200 dark:hover:bg-amber-500/20">
                          Apto a G∴D∴
                        </Badge>
                      )}
                    </span>
                  }
                />
                <Row k="Iniciação à Ordem DeMolay" v={formatDateBR(member.iniciacao_ordem)} />
                <Row k="ID DeMolay" v={(member as any).demolay_id || "—"} />
                <Row k="Exame de Grau Iniciático" v={formatDateBR(member.exam_grau_iniciatico)} />
                <Row k="Iniciação ao Grau DeMolay" v={formatDateBR(member.iniciacao_grau_demolay)} />
                <Row k="Exame de Grau DeMolay" v={formatDateBR(member.exam_grau_demolay)} />
                {(member as { kind?: string }).kind === "macom" && (
                  <Row k="ID maçônica" v={(member as any).masonic_id || "—"} />
                )}
                <Row k="Status" v={<Badge variant="secondary">{statusLabel(member.status)}</Badge>} />
                {irregularSince ? (
                  <Row k="Irregular desde" v={formatDateBR(irregularSince)} />
                ) : null}
                {awayPeriods.length > 0 ? (
                  <Row
                    k="Afastamentos"
                    v={
                      <ul className="space-y-0.5 text-right text-sm">
                        {awayPeriods.map((p) => (
                          <li key={p.id}>
                            {formatDateBR(p.started_on)}
                            {" → "}
                            {p.ended_on ? formatDateBR(p.ended_on) : "atual"}
                          </li>
                        ))}
                      </ul>
                    }
                  />
                ) : null}
                <Row
                  k="Tipo"
                  v={
                    <Badge variant="outline">
                      {kindLabel((member as { kind?: string }).kind)}
                    </Badge>
                  }
                />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">CPF</dt>
                  <dd className="flex items-center gap-2 font-mono">
                    {revealed.cpf ?? formatCpfMask(member.cpf_last2)}
                    {!revealed.cpf && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reveal.mutate("cpf")}
                        disabled={reveal.isPending}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Revelar
                      </Button>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">RG</dt>
                  <dd className="flex items-center gap-2 font-mono">
                    {revealed.rg ?? formatRgMask(member.rg_last2)}
                    {!revealed.rg && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => reveal.mutate("rg")}
                        disabled={reveal.isPending}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Revelar
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="rounded-[12px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Contato</h3>
              <dl className="space-y-2 text-sm">
                <Row k="Telefone" v={member.phone || "—"} />
                <Row k="Email" v={member.email || "—"} />
                <Row k="Endereço" v={
                  member.address && typeof member.address === "object"
                    ? (() => {
                        const a = member.address as Record<string, string>;
                        const line1 = [
                          a.street,
                          a.number,
                          a.complement,
                        ].filter(Boolean).join(", ");
                        const line2 = [
                          a.neighborhood,
                          a.city,
                          a.state,
                          a.zip,
                          a.country,
                        ].filter(Boolean).join(" — ");
                        return [line1, line2].filter(Boolean).join(" · ") || "—";
                      })()
                    : "—"
                } />
              </dl>
            </Card>

            {guardians.length > 0 && (
              <Card className="rounded-[12px] p-5 md:col-span-2">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Responsáveis</h3>
                <ul className="space-y-3">
                  {guardians.map((g) => (
                    <li key={g.id} className="text-sm">
                      <div className="font-medium">{g.full_name} <span className="ml-1 text-xs text-muted-foreground">({g.relationship || "—"})</span></div>
                      <div className="text-muted-foreground">{g.phone || "—"} · {g.email || "—"} · CPF {formatCpfMask(g.cpf_last2)}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {consents.length > 0 && (
              <Card className="rounded-[12px] p-5 md:col-span-2">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Shield className="h-4 w-4" /> Consentimentos LGPD
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {consents.map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <span>Versão {c.consent_text_version}</span>
                      <span className="text-muted-foreground">{formatDateTimeBR(c.signed_at)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cargos">
          {orgPending && !org ? (
            <PageSkeleton />
          ) : (
          <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="rounded-[12px] p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Cargos do capítulo e conselho
              </h3>
              {orgData.positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cargo registrado.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {orgData.positions.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {p.position?.label}
                        <span className="text-muted-foreground">
                          {" "}
                          — {termLabel(p.term_year, p.term_semester)}
                        </span>
                      </span>
                      {canEditOrg && (
                        <Button size="icon" variant="ghost" onClick={() => delPos.mutate(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEditOrg && (
                <NewPositionForms
                  options={(catalog?.positions ?? []).map((p) => ({
                    value: String(p.id),
                    label: `${p.label} · ${p.scope === "consultivo" ? "Conselho" : "Capítulo"}`,
                  }))}
                  foundedAt={foundedAt}
                  pending={addPos.isPending}
                  onSave={(positionId, year, semester) =>
                    addPos.mutateAsync({ positionId, year, semester })
                  }
                />
              )}
            </Card>
            <Card className="rounded-[12px] p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Histórico em comissões
                </h3>
                {canEditOrg && (
                  <PickerDialog
                    title="Adicionar em comissão"
                    triggerLabel="Adicionar comissão"
                    options={(catalog?.commissions ?? []).map((c) => ({
                      value: String(c.id),
                      label: c.label,
                    }))}
                    withRole
                    withTerm
                    foundedAt={foundedAt}
                    defaultTerm={term}
                    onConfirm={(v, role, t) => {
                      if (t) setTerm(t);
                      addCom.mutate({
                        commissionId: Number(v),
                        role: role ?? "membro",
                        ...(t ? { year: t.year, semester: t.semester } : {}),
                      });
                    }}
                  />
                )}
              </div>
              {orgData.commissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma participação registrada.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {orgData.commissions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {c.commission?.label}{" "}
                        <Badge variant="secondary" className="ml-1">
                          {COMMISSION_ROLE_LABELS[c.role] ?? c.role}
                        </Badge>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        {termLabel(c.term_year, c.term_semester)}
                        {canEditOrg && (
                          <Button size="icon" variant="ghost" onClick={() => delCom.mutate(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          </>
          )}
        </TabsContent>

        <TabsContent value="presencas">
          {attendancePending && tab === "presencas" && attendance.length === 0 ? (
            <PageSkeleton />
          ) : (
          <>
          <Card className="mb-4 rounded-[12px] p-5">
            <div className="text-sm font-medium text-muted-foreground">
              Frequência em itens obrigatórios
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className="text-3xl font-bold"
                style={{
                  color:
                    mandatoryPct === null
                      ? "var(--muted-foreground)"
                      : mandatoryPct >= 75
                        ? "#047857"
                        : "#B91C1C",
                }}
              >
                {mandatoryPct === null ? "—" : `${mandatoryPct}%`}
              </span>
              <span className="text-sm text-muted-foreground">
                {mandatoryPresent} de {mandatoryRecs.length} contabilizáveis
              </span>
            </div>
          </Card>
          <Card className="rounded-[12px] p-0">
            {(attendance as any[]).length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">
                Nenhum registro de presença ainda.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(attendance as any[]).map((r) => {
                  const ev = r.calendar_event;
                  const meta = ev ? TYPE_META[ev.event_type as CalendarType] : undefined;
                  return (
                    <li key={r.id} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{ev?.title ?? "Item removido"}</span>
                        {meta && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        )}
                        <Badge variant={ev?.mandatory ? "default" : "secondary"}>
                          {ev?.mandatory ? "Contabilizável" : "Facultativo"}
                        </Badge>
                        <span
                          className="ml-auto text-xs font-semibold"
                          style={{ color: r.status === "presente" ? "#047857" : "#B91C1C" }}
                        >
                          {r.status === "presente" ? "Presente" : "Ausente"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTimeBR(ev?.start_at)}
                        {r.justification ? ` · Justificativa: ${r.justification}` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          </>
          )}
        </TabsContent>


        <TabsContent value="timeline">
          <Card className="rounded-[12px] p-5">
            {audit.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</div>
            ) : (
              <ul className="space-y-3 text-sm">
                {audit.map((a) => (
                  <li key={a.id} className="border-b border-border pb-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium">{auditActionLabel(a.action)}</div>
                        {a.action === "member_cadastro_self_update" && (
                          <AuditCadastroDiff
                            oldValue={(a as { old_value?: unknown }).old_value}
                            newValue={a.new_value}
                          />
                        )}
                        {a.action === "pii_reveal" && (
                          <div className="text-xs text-muted-foreground">
                            Campo: {(a.new_value as { field?: string } | null)?.field?.toUpperCase() ?? "—"}
                          </div>
                        )}
                        {a.action === "member_update" && (
                          <div className="text-xs text-muted-foreground">
                            Atualização interna pela secretaria/admin.
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTimeBR(a.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <MemberFinanceTab
            finance={finance}
            pending={financePending}
            year={financeYear}
            onYearChange={setFinanceYear}
            foundedAt={chapterFoundedAt(active?.chapter)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DUE_STATUS_LABEL: Record<string, string> = {
  em_aberto: "Em aberto",
  pago: "Pago",
  isento: "Isento",
  desligado: "Desligado",
};

function MemberFinanceTab({
  finance,
  pending,
  year,
  onYearChange,
  foundedAt,
}: {
  finance:
    | Awaited<ReturnType<typeof getMemberFinance>>
    | undefined;
  pending: boolean;
  year: number;
  onYearChange: (y: number) => void;
  foundedAt?: string | null;
}) {
  const currentYear = new Date().getFullYear();
  const startYear = foundedAt ? Number(foundedAt.slice(0, 4)) : currentYear - 2;
  const years: number[] = [];
  for (let y = currentYear; y >= startYear; y--) years.push(y);

  if (pending && !finance) {
    return (
      <Card className="rounded-[12px] p-5 text-sm text-muted-foreground">
        Carregando financeiro…
      </Card>
    );
  }

  const summary = finance?.summary ?? {
    duesOpenCount: 0,
    duesOpenAmount: 0,
    chargesOpenCount: 0,
    chargesOpenAmount: 0,
    totalOpen: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Situação financeira</p>
          <p className="text-xs text-muted-foreground">
            Mensalidades e cobranças atribuídas a este membro
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="rounded-[12px] p-4">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div
            className={`mt-1 text-xl font-bold ${
              summary.totalOpen > 0 ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {formatBRL(summary.totalOpen)}
          </div>
        </Card>
        <Card className="rounded-[12px] p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" /> Mensalidades
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatBRL(summary.duesOpenAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {summary.duesOpenCount} competência
            {summary.duesOpenCount === 1 ? "" : "s"}
          </div>
        </Card>
        <Card className="rounded-[12px] p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" /> Cobranças
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatBRL(summary.chargesOpenAmount)}
          </div>
          <div className="text-xs text-muted-foreground">
            {summary.chargesOpenCount} em aberto
          </div>
        </Card>
      </div>

      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold">Mensalidades · {year}</h3>
        {(finance?.dues.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma competência registrada neste ano.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {(finance?.dues ?? []).map((d) => {
              const style =
                d.status === "pago"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : d.status === "isento"
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
                    : d.status === "desligado"
                      ? "bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
              return (
                <div
                  key={d.id}
                  className={`rounded-[8px] px-2 py-2 text-center ${style}`}
                >
                  <div className="text-xs font-medium">
                    {MONTH_SHORT[d.month - 1] ?? d.month}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {DUE_STATUS_LABEL[d.status] ?? d.status}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold">
                    {formatBRL(d.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold">Cobranças</h3>
        {(finance?.charges.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cobrança atribuída a este membro.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(finance?.charges ?? []).map((c) => {
              const pct =
                c.amount > 0
                  ? Math.min(100, Math.round((c.amount_paid / c.amount) * 100))
                  : 0;
              return (
                <li key={c.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.category} · venc. {formatDateBR(c.due_date)}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {c.remaining <= 0 || c.status === "pago"
                        ? "Quitada"
                        : c.amount_paid > 0
                          ? "Parcial"
                          : DUE_STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatBRL(c.amount_paid)} de {formatBRL(c.amount)}
                    </span>
                    {c.remaining > 0 && c.status !== "isento" ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        resta {formatBRL(c.remaining)}
                      </span>
                    ) : null}
                  </div>
                  {c.status !== "isento" && <Progress value={pct} className="h-1.5" />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NewPositionForms({
  options,
  foundedAt,
  pending,
  onSave,
}: {
  options: { value: string; label: string }[];
  foundedAt?: string | null;
  pending: boolean;
  onSave: (positionId: number, year: number, semester: 1 | 2) => Promise<unknown>;
}) {
  const cur = currentTerm();
  const terms = termOptions({ foundedAt });
  const [rows, setRows] = useState<
    { key: number; positionId: string; year: number; semester: 1 | 2 }[]
  >([]);
  const nextKey = useRef(1);

  function addRow() {
    const key = nextKey.current++;
    setRows((r) => [...r, { key, positionId: "", year: cur.year, semester: cur.semester }]);
  }

  function updateRow(key: number, patch: Partial<(typeof rows)[number]>) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: number) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  async function saveRow(key: number) {
    const row = rows.find((r) => r.key === key);
    if (!row?.positionId) {
      toast.error("Selecione o cargo");
      return;
    }
    try {
      await onSave(Number(row.positionId), row.year, row.semester);
      removeRow(key);
    } catch {
      // erro já tratado no mutation
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      {rows.map((row) => (
        <div key={row.key} className="space-y-3 rounded-[8px] border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Novo Cargo</span>
            <Button size="icon" variant="ghost" onClick={() => removeRow(row.key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-sm">Cargo</Label>
              <SearchableSelect
                value={row.positionId}
                options={options}
                onChange={(v) => updateRow(row.key, { positionId: v })}
                placeholder="Selecione o cargo"
                searchPlaceholder="Buscar cargo…"
                emptyText="Nenhum cargo encontrado."
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Vigência</Label>
              <TermSelect
                value={{ year: row.year, semester: row.semester }}
                terms={terms}
                onChange={(t) =>
                  updateRow(row.key, { year: t.year, semester: t.semester })
                }
              />
            </div>
          </div>
          <Button
            size="sm"
            disabled={pending || !row.positionId}
            onClick={() => void saveRow(row.key)}
          >
            {pending ? "Salvando…" : "Confirmar cargo"}
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1.5 h-4 w-4" /> Novo Cargo
      </Button>
    </div>
  );
}

function PickerDialog({
  title,
  triggerLabel,
  options,
  withRole,
  withTerm,
  foundedAt,
  defaultTerm,
  onConfirm,
}: {
  title: string;
  triggerLabel: string;
  options: { value: string; label: string }[];
  withRole?: boolean;
  withTerm?: boolean;
  foundedAt?: string | null;
  defaultTerm?: Term;
  onConfirm: (value: string, role?: string, term?: Term) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [role, setRole] = useState("membro");
  const [term, setTerm] = useState<Term>(defaultTerm ?? currentTerm());
  const terms = termOptions({ foundedAt });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-1.5 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada disponível.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Selecione</Label>
              <SearchableSelect
                value={value}
                options={options}
                onChange={setValue}
                placeholder="Escolha uma opção"
                searchPlaceholder="Buscar…"
              />
            </div>
            {withTerm && (
              <div>
                <Label className="mb-1.5 block text-sm">Vigência</Label>
                <TermSelect value={term} terms={terms} onChange={setTerm} />
              </div>
            )}
            {withRole && (
              <div>
                <Label className="mb-1.5 block text-sm">Cargo na comissão</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMMISSION_ROLE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => {
                if (!value) return;
                onConfirm(value, withRole ? role : undefined, withTerm ? term : undefined);
                setOpen(false);
                setValue("");
              }}
            >
              Confirmar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


const COMMISSION_ROLE_LABELS: Record<string, string> = {
  presidente: "Presidente",
  vice: "Vice",
  membro: "Membro",
  auxiliar_senior: "Auxiliar Sênior",
};

function auditActionLabel(action: string): string {
  switch (action) {
    case "pii_reveal":
      return "Revelação de PII";
    case "member_update":
      return "Atualização cadastral (secretaria)";
    case "member_cadastro_self_update":
      return "Atualização cadastral (pelo membro)";
    default:
      return action;
  }
}

function formatAuditScalar(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function AuditCadastroDiff({
  oldValue,
  newValue,
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  const oldObj = (oldValue && typeof oldValue === "object" ? oldValue : {}) as Record<
    string,
    unknown
  >;
  const newObj = (newValue && typeof newValue === "object" ? newValue : {}) as Record<
    string,
    unknown
  >;
  const labels: Record<string, string> = {
    phone: "Telefone",
    email: "Email",
    address: "Endereço",
    cpf_last2: "CPF (final)",
    rg_last2: "RG (final)",
    guardians: "Responsáveis",
  };
  const keys = Object.keys(newObj).filter(
    (k) => !["demolay_id", "full_name", "source"].includes(k),
  );
  if (keys.length === 0) {
    return <div className="text-xs text-muted-foreground">Sem detalhe de alterações.</div>;
  }
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {keys.map((k) => {
        if (k === "guardians" && Array.isArray(newObj.guardians)) {
          return (
            <li key={k}>
              <span className="font-medium text-foreground">Responsáveis:</span>
              <ul className="mt-0.5 list-inside list-disc pl-1">
                {(newObj.guardians as { full_name?: string; changes?: Record<string, { old?: unknown; new?: unknown }> }[]).map(
                  (g, i) => (
                    <li key={i}>
                      {g.full_name ?? "Responsável"}
                      {g.changes
                        ? ` — ${Object.entries(g.changes)
                            .map(
                              ([ck, cv]) =>
                                `${ck}: ${formatAuditScalar(cv?.old)} → ${formatAuditScalar(cv?.new)}`,
                            )
                            .join("; ")}`
                        : ""}
                    </li>
                  ),
                )}
              </ul>
            </li>
          );
        }
        return (
          <li key={k}>
            <span className="font-medium text-foreground">{labels[k] ?? k}:</span>{" "}
            {formatAuditScalar(oldObj[k])} → {formatAuditScalar(newObj[k])}
          </li>
        );
      })}
    </ul>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
