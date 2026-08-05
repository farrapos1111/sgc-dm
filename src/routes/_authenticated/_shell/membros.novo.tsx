import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createMember, lookupMemberByDemolayId, listChaptersForSelect } from "@/lib/members.functions";
import { createMemberAffiliationRequest } from "@/lib/member-change-requests.functions";
import { normalizeDemolayId } from "@/lib/member-identity";
import {
  listCatalog,
  assignPosition,
  assignCommissionMember,
} from "@/lib/organization.functions";
import { grauOf, is21OrOlder, isUnder21 } from "@/lib/format";
import {
  currentTerm,
  termOptions,
  chapterFoundedAt,
  type Term,
} from "@/lib/terms";
import { TermSelect } from "@/components/TermSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  MemberDataFields,
  GuardianFields,
  emptyMember,
  emptyGuardian,
  type MemberFormData,
  type GuardianFormData,
} from "@/components/members/MemberFields";
import { PositionHistoryCollapsible } from "@/components/members/PositionHistoryCollapsible";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/membros/novo")({
  head: () => ({ meta: [{ title: "Novo membro — SG-CDM" }] }),
  component: NovoMembro,
});

const stepDadosSchema = z.object({
  full_name: z.string().trim().min(2, "Informe o nome completo").max(120),
  email: z.string().email("Email inválido").optional().or(z.literal("")).default(""),
});

const CONSENT_VERSION = "v1-2026-07";
const CONSENT_TEXT = `Autorizo o tratamento dos dados pessoais do membro sob minha responsabilidade pelo Capítulo, exclusivamente para fins administrativos, de comunicação e de participação em atividades da Ordem DeMolay, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Este consentimento pode ser revogado a qualquer momento junto ao Encarregado de Dados do Capítulo.`;

const COMMISSION_ROLES = [
  { value: "presidente", label: "Presidente" },
  { value: "vice", label: "Vice" },
  { value: "membro", label: "Membro" },
  { value: "auxiliar_senior", label: "Auxiliar Sênior" },
] as const;

type StepId = "dados" | "cargos" | "pais";

type DemolayLookupStatus =
  | "idle"
  | "loading"
  | "found"
  | "not_found"
  | "already_affiliated";

type PendingPosition = {
  key: number;
  positionId: string;
  year: number;
  semester: 1 | 2;
};

type PendingCommission = {
  key: number;
  commissionId: string;
  role: string;
  year: number;
  semester: 1 | 2;
};

function NovoMembro() {
  const { active } = useActiveChapter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);

  const [dados, setDados] = useState<MemberFormData>(() => ({
    ...emptyMember,
    initiation_chapter_id: "",
  }));
  const [guardian1, setGuardian1] = useState<GuardianFormData>(emptyGuardian);
  const [guardian2, setGuardian2] = useState<GuardianFormData | null>(null);
  const [consent, setConsent] = useState(false);
  const [pendingPositions, setPendingPositions] = useState<PendingPosition[]>([]);
  const [pendingCommissions, setPendingCommissions] = useState<PendingCommission[]>([]);
  const [posKey, setPosKey] = useState(1);
  const [comKey, setComKey] = useState(1);
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);
  const [linkedDemolayId, setLinkedDemolayId] = useState<string | null>(null);
  const [demolayLookupStatus, setDemolayLookupStatus] =
    useState<DemolayLookupStatus>("idle");
  const [positionHistory, setPositionHistory] = useState<
    {
      label: string;
      term_year: number;
      term_semester: number;
      chapter_name: string;
      chapter_number?: string | null;
    }[]
  >([]);
  const lastLookedUpRef = useRef("");
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    if (active?.chapter_id && !dados.initiation_chapter_id) {
      setDados((d) => ({ ...d, initiation_chapter_id: active.chapter_id }));
    }
  }, [active?.chapter_id]);

  const menor = isUnder21(dados.birth_date);
  const hasGrauDemolay = grauOf(dados).code === "DM";
  const foundedAt = chapterFoundedAt(active?.chapter);
  const cur = currentTerm();
  const terms = useMemo(() => termOptions({ foundedAt }), [foundedAt]);

  const steps = useMemo<StepId[]>(() => {
    // Vínculo a membro existente: só dados (solicitação ao originário); cargos após aprovação
    if (linkedMemberId) return ["dados"];
    const list: StepId[] = ["dados"];
    if (hasGrauDemolay) list.push("cargos");
    if (menor) list.push("pais");
    return list;
  }, [hasGrauDemolay, menor, linkedMemberId]);

  const step = steps[Math.min(stepIndex, steps.length - 1)] ?? "dados";
  const totalSteps = steps.length;
  const isLast = stepIndex >= totalSteps - 1;

  useEffect(() => {
    setStepIndex((i) => Math.min(i, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  const chapterId = active?.chapter_id ?? "";
  const { data: catalog } = useQuery({
    queryKey: ["org-catalog", chapterId],
    queryFn: () => listCatalog({ data: { chapterId } }),
    enabled: hasGrauDemolay && Boolean(chapterId),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-select"],
    queryFn: () => listChaptersForSelect(),
  });

  // Autocomplete: ao digitar ID DeMolay, busca e preenche dados existentes
  useEffect(() => {
    const raw = dados.demolay_id.trim();
    const normalized = normalizeDemolayId(raw);
    if (!active?.chapter_id) return;

    if (!normalized) {
      lastLookedUpRef.current = "";
      setDemolayLookupStatus("idle");
      if (linkedMemberId) {
        setLinkedMemberId(null);
        setLinkedDemolayId(null);
        setPositionHistory([]);
      }
      return;
    }

    if (
      linkedMemberId &&
      linkedDemolayId &&
      normalizeDemolayId(linkedDemolayId) === normalized
    ) {
      setDemolayLookupStatus("found");
      return;
    }

    if (linkedMemberId) {
      setLinkedMemberId(null);
      setLinkedDemolayId(null);
      setPositionHistory([]);
    }

    const handle = window.setTimeout(async () => {
      if (normalized === lastLookedUpRef.current) return;
      const seq = ++lookupSeqRef.current;
      setDemolayLookupStatus("loading");
      try {
        const found = await lookupMemberByDemolayId({
          data: { demolayId: raw, chapterId: active.chapter_id },
        });
        if (seq !== lookupSeqRef.current) return;
        lastLookedUpRef.current = normalized;

        if (!found) {
          setDemolayLookupStatus("not_found");
          setLinkedMemberId(null);
          setLinkedDemolayId(null);
          setPositionHistory([]);
          return;
        }

        if (found.already_affiliated) {
          setDemolayLookupStatus("already_affiliated");
          setLinkedMemberId(null);
          setLinkedDemolayId(null);
          setPositionHistory([]);
          toast.error("Este membro já está vinculado a este capítulo.");
          return;
        }

        if (found.chapter_id === active.chapter_id) {
          setDemolayLookupStatus("already_affiliated");
          setLinkedMemberId(null);
          setLinkedDemolayId(null);
          setPositionHistory([]);
          toast.error("Este membro já é originário deste capítulo.");
          return;
        }

        const addr = (found.address ?? {}) as Record<string, string>;
        const matchedId = normalizeDemolayId(found.demolay_id ?? raw);
        const formDemolayId = found.demolay_id ?? raw;
        setLinkedMemberId(found.id);
        setLinkedDemolayId(matchedId);
        setPositionHistory(found.position_history ?? []);
        setDemolayLookupStatus("found");
        setDados((d) => ({
          ...d,
          full_name: found.full_name ?? "",
          birth_date: found.birth_date ?? "",
          exam_grau_iniciatico: found.exam_grau_iniciatico ?? "",
          exam_grau_demolay: found.exam_grau_demolay ?? "",
          iniciacao_ordem: found.iniciacao_ordem ?? "",
          iniciacao_grau_demolay: found.iniciacao_grau_demolay ?? "",
          demolay_id: formDemolayId,
          masonic_id: found.masonic_id ?? "",
          initiation_chapter_id: found.initiation_chapter_id ?? found.chapter_id,
          status: (found.status as MemberFormData["status"]) || "regular",
          kind: (found.kind as MemberFormData["kind"]) || "demolay_ativo",
          phone: found.phone ?? "",
          email: found.email ?? "",
          address_zip: addr.zip ?? "",
          address_street: addr.street ?? "",
          address_number: addr.number ?? "",
          address_complement: addr.complement ?? "",
          address_neighborhood: addr.neighborhood ?? "",
          address_city: addr.city ?? "",
          address_state: addr.state ?? "",
          address_country: addr.country ?? "Brasil",
        }));
        toast.success("Dados preenchidos a partir do cadastro existente.");
      } catch (e) {
        if (seq !== lookupSeqRef.current) return;
        setDemolayLookupStatus("idle");
        toast.error(e instanceof Error ? e.message : "Erro ao buscar ID DeMolay");
      }
    }, 450);

    return () => window.clearTimeout(handle);
  }, [dados.demolay_id, active?.chapter_id, linkedMemberId, linkedDemolayId]);

  const positionOptions = useMemo(() => {
    const eligible = (catalog?.positions ?? []).filter((p) => {
      if (p.scope === "consultivo") return is21OrOlder(dados.birth_date);
      return true;
    });
    return eligible.map((p) => ({
      value: String(p.id),
      label: `${p.label} · ${p.scope === "consultivo" ? "Conselho" : "Capítulo"}`,
    }));
  }, [catalog?.positions, dados.birth_date]);

  const commissionOptions = useMemo(
    () =>
      (catalog?.commissions ?? []).map((c) => ({
        value: String(c.id),
        label: c.label,
      })),
    [catalog?.commissions],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Sem capítulo ativo");

      // Membro global existente: solicita vínculo ao capítulo originário (não afilia direto)
      if (linkedMemberId) {
        await createMemberAffiliationRequest({
          data: {
            memberId: linkedMemberId,
            requestingChapterId: active.chapter_id,
          },
        });
        return { id: linkedMemberId, kind: "affiliation_request" as const };
      }

      const guardians = menor
        ? [guardian1, ...(guardian2 && guardian2.full_name.trim() ? [guardian2] : [])]
        : [];
      const created = await createMember({
        data: {
          chapter_id: active.chapter_id,
          initiation_chapter_id: dados.initiation_chapter_id || active.chapter_id,
          full_name: dados.full_name.trim(),
          birth_date: dados.birth_date || null,
          exam_grau_iniciatico: dados.exam_grau_iniciatico || null,
          exam_grau_demolay: dados.exam_grau_demolay || null,
          iniciacao_ordem: dados.iniciacao_ordem || null,
          iniciacao_grau_demolay: dados.iniciacao_grau_demolay || null,
          demolay_id: dados.demolay_id,
          masonic_id: dados.masonic_id,
          cpf: dados.cpf,
          rg: dados.rg,
          phone: dados.phone,
          email: dados.email,
          address: {
            zip: dados.address_zip,
            street: dados.address_street,
            number: dados.address_number,
            complement: dados.address_complement,
            neighborhood: dados.address_neighborhood,
            city: dados.address_city,
            state: dados.address_state,
            country: dados.address_country,
          },
          status: dados.status,
          kind: dados.kind,
          status_effective_on: dados.status_effective_on || null,
          guardians,
          consent_text_version: menor ? CONSENT_VERSION : "",
        },
      });

      const memberId = created.id;
      for (const row of pendingPositions) {
        if (!row.positionId) continue;
        await assignPosition({
          data: {
            chapterId: active.chapter_id,
            memberId,
            positionId: Number(row.positionId),
            year: row.year,
            semester: row.semester,
          },
        });
      }
      for (const row of pendingCommissions) {
        if (!row.commissionId) continue;
        await assignCommissionMember({
          data: {
            chapterId: active.chapter_id,
            memberId,
            commissionId: Number(row.commissionId),
            role: row.role as "presidente" | "vice" | "membro" | "auxiliar_senior",
            year: row.year,
            semester: row.semester,
          },
        });
      }
      return { id: memberId, kind: "created" as const };
    },
    onSuccess: async (res) => {
      if (res.kind === "affiliation_request") {
        toast.success(
          "Solicitação de vínculo enviada ao capítulo originário. Aguarde a aprovação.",
        );
      } else {
        toast.success("Membro cadastrado");
      }
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["member-change-requests"] });
      await qc.invalidateQueries({ queryKey: ["chapter-positions"] });
      await qc.invalidateQueries({ queryKey: ["commission-members"] });
      navigate({ to: "/membros" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar"),
  });

  function goNext() {
    if (step === "dados") {
      if (demolayLookupStatus === "already_affiliated") {
        toast.error("Este ID DeMolay já está vinculado a este capítulo.");
        return;
      }
      const parsed = stepDadosSchema.safeParse(dados);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios");
        return;
      }
    }
    if (step === "pais") {
      if (!guardian1.full_name.trim()) {
        toast.error("Informe o nome do responsável");
        return;
      }
    }
    if (isLast) {
      if (menor && !consent && !linkedMemberId) {
        toast.error("O responsável precisa assinalar o consentimento LGPD");
        return;
      }
      mutation.mutate();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function stepLabel(id: StepId): string {
    if (id === "dados") return "Dados principais";
    if (id === "cargos") return "Cargos e comissões";
    return "Autorização dos pais";
  }

  return (
    <div>
      <PageHeader
        title="Novo membro"
        subtitle={`Etapa ${stepIndex + 1} de ${totalSteps} — ${stepLabel(step)}`}
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/membros" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />

      <Card className="rounded-[12px] p-6">
        {step === "dados" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao informar um <strong>ID DeMolay</strong> já cadastrado, os dados são preenchidos
              automaticamente (somente leitura). O vínculo a este capítulo só ocorre após o
              capítulo originário aprovar a solicitação.
            </p>

            {(positionHistory.length > 0 || linkedMemberId) && (
              <div className="space-y-2">
                {linkedMemberId && (
                  <p className="text-xs text-muted-foreground">
                    Cadastro global encontrado — ao concluir, uma notificação será enviada ao
                    capítulo originário solicitando o vínculo. Altere o ID DeMolay para
                    desfazer.
                  </p>
                )}
                <PositionHistoryCollapsible items={positionHistory} />
              </div>
            )}

            <MemberDataFields
              value={dados}
              onChange={(p) => setDados((d) => ({ ...d, ...p }))}
              chapters={chapters}
              readOnlyMaster={Boolean(linkedMemberId)}
              demolayLookupStatus={demolayLookupStatus}
            />
            <div className="flex justify-end pt-2">
              <Button
                onClick={goNext}
                disabled={mutation.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                {isLast ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />{" "}
                    {linkedMemberId ? "Solicitar vínculo" : "Concluir cadastro"}
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "cargos" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              O membro possui Grau DeMolay. Informe cargos e comissões desta gestão (opcional).
            </p>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Cargos</h3>
              {pendingPositions.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-3 rounded-[8px] border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div>
                    <Label className="mb-1.5 block text-sm">Cargo</Label>
                    <SearchableSelect
                      value={row.positionId}
                      options={positionOptions}
                      onChange={(v) =>
                        setPendingPositions((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, positionId: v } : r)),
                        )
                      }
                      placeholder="Selecione o cargo"
                      searchPlaceholder="Buscar cargo…"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-sm">Vigência</Label>
                    <TermSelect
                      value={{ year: row.year, semester: row.semester }}
                      terms={terms}
                      onChange={(t: Term) =>
                        setPendingPositions((rows) =>
                          rows.map((r) =>
                            r.key === row.key
                              ? { ...r, year: t.year, semester: t.semester }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setPendingPositions((rows) => rows.filter((r) => r.key !== row.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingPositions((rows) => [
                    ...rows,
                    {
                      key: posKey,
                      positionId: "",
                      year: cur.year,
                      semester: cur.semester,
                    },
                  ]);
                  setPosKey((k) => k + 1);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Novo cargo
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Comissões</h3>
              {pendingCommissions.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-3 rounded-[8px] border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                >
                  <div>
                    <Label className="mb-1.5 block text-sm">Comissão</Label>
                    <SearchableSelect
                      value={row.commissionId}
                      options={commissionOptions}
                      onChange={(v) =>
                        setPendingCommissions((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, commissionId: v } : r)),
                        )
                      }
                      placeholder="Selecione"
                      searchPlaceholder="Buscar comissão…"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-sm">Função</Label>
                    <Select
                      value={row.role}
                      onValueChange={(v) =>
                        setPendingCommissions((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, role: v } : r)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMISSION_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-sm">Vigência</Label>
                    <TermSelect
                      value={{ year: row.year, semester: row.semester }}
                      terms={terms}
                      onChange={(t: Term) =>
                        setPendingCommissions((rows) =>
                          rows.map((r) =>
                            r.key === row.key
                              ? { ...r, year: t.year, semester: t.semester }
                              : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setPendingCommissions((rows) => rows.filter((r) => r.key !== row.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingCommissions((rows) => [
                    ...rows,
                    {
                      key: comKey,
                      commissionId: "",
                      role: "membro",
                      year: cur.year,
                      semester: cur.semester,
                    },
                  ]);
                  setComKey((k) => k + 1);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Nova comissão
              </Button>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={goNext}
                disabled={mutation.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                {mutation.isPending ? (
                  "Salvando…"
                ) : isLast ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Concluir cadastro
                  </>
                ) : (
                  <>
                    Próximo <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "pais" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Como o membro tem menos de 21 anos, é obrigatório informar ao menos um responsável
              legal. É possível cadastrar até dois responsáveis.
            </p>
            <GuardianFields
              title="Responsável 1 (principal)"
              value={guardian1}
              onChange={(p) => setGuardian1((g) => ({ ...g, ...p }))}
              required
            />
            {guardian2 ? (
              <div className="space-y-2">
                <GuardianFields
                  title="Responsável 2"
                  value={guardian2}
                  onChange={(p) => setGuardian2((g) => ({ ...(g ?? emptyGuardian), ...p }))}
                />
                <Button variant="ghost" size="sm" onClick={() => setGuardian2(null)}>
                  <X className="mr-2 h-4 w-4" /> Remover segundo responsável
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setGuardian2({ ...emptyGuardian })}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar segundo responsável
              </Button>
            )}

            <h3 className="pt-2 text-base font-semibold">Consentimento LGPD do responsável</h3>
            <div className="rounded-[8px] border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
              {CONSENT_TEXT}
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                Eu, {guardian1.full_name || "responsável"}, li e concordo com o tratamento dos dados
                pessoais conforme descrito acima (versão {CONSENT_VERSION}).
              </span>
            </label>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={goNext}
                disabled={mutation.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                {mutation.isPending ? (
                  "Salvando…"
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Concluir cadastro
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
