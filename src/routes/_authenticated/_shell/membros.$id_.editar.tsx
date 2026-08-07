import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getMember, updateMember, listChaptersForSelect } from "@/lib/members.functions";
import { createMemberChangeRequest } from "@/lib/member-change-requests.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isUnder21, is21OrOlder, maskCepInput } from "@/lib/format";
import { todayYmd } from "@/lib/timezone";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  MemberDataFields,
  GuardianFields,
  emptyGuardian,
  type MemberFormData,
  type GuardianFormData,
  type MemberStatus,
  type MemberKind,
} from "@/components/members/MemberFields";
import { ArrowLeft, Check, Plus, Send, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/membros/$id_/editar")({
  head: () => ({ meta: [{ title: "Editar membro — Templo Virtual" }] }),
  remountDeps: ({ params }) => params.id,
  component: EditarMembro,
});

const memberQO = (id: string) =>
  queryOptions({ queryKey: ["member", id], queryFn: () => getMember({ data: { id } }) });

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome completo",
  birth_date: "Nascimento",
  phone: "Telefone",
  email: "E-mail",
  demolay_id: "ID DeMolay",
  masonic_id: "ID maçônica",
  iniciacao_ordem: "Iniciação Ordem",
  exam_grau_iniciatico: "Exame Grau Iniciático",
  iniciacao_grau_demolay: "Iniciação Grau DeMolay",
  exam_grau_demolay: "Exame Grau DeMolay",
  initiation_chapter_id: "Capítulo de Iniciação",
  status: "Status",
  kind: "Tipo",
  address_zip: "CEP",
  address_street: "Rua",
  address_number: "Número",
  address_complement: "Complemento",
  address_neighborhood: "Bairro",
  address_city: "Cidade",
  address_state: "UF",
  address_country: "País",
};

function EditarMembro() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const { data } = useSuspenseQuery(memberQO(id));
  const addr = (data.member.address ?? {}) as Record<string, string>;

  const originChapterId = data.member.chapter_id;
  const isOrigin = Boolean(active && active.chapter_id === originChapterId);

  const birth = data.member.birth_date ?? "";
  const rawStatus = (data.member.status ?? "regular") as MemberStatus;
  const rawKind = ((data.member as { kind?: string }).kind ?? "demolay_ativo") as MemberKind;
  const initialKind: MemberKind =
    rawKind === "macom"
      ? "macom"
      : is21OrOlder(birth)
        ? "senior"
        : rawKind === "senior" && isUnder21(birth)
          ? "demolay_ativo"
          : rawKind;

  const initialDados: MemberFormData = useMemo(
    () => ({
      full_name: data.member.full_name ?? "",
      birth_date: birth,
      exam_grau_iniciatico: data.member.exam_grau_iniciatico ?? "",
      exam_grau_demolay: data.member.exam_grau_demolay ?? "",
      iniciacao_ordem: data.member.iniciacao_ordem ?? "",
      iniciacao_grau_demolay: data.member.iniciacao_grau_demolay ?? "",
      demolay_id: (data.member as { demolay_id?: string }).demolay_id ?? "",
      masonic_id: (data.member as { masonic_id?: string }).masonic_id ?? "",
      initiation_chapter_id:
        (data.member as { initiation_chapter_id?: string | null }).initiation_chapter_id ??
        originChapterId,
      status: rawStatus === "irregular" ? "irregular" : "regular",
      kind: initialKind,
      status_effective_on:
        rawStatus === "irregular" ? (data.irregularSince ?? todayYmd()) : todayYmd(),
      cpf: "",
      rg: "",
      phone: data.member.phone ?? "",
      email: data.member.email ?? "",
      address_zip: maskCepInput(addr.zip ?? ""),
      address_street: addr.street ?? "",
      address_number: addr.number ?? "",
      address_complement: addr.complement ?? "",
      address_neighborhood: addr.neighborhood ?? "",
      address_city: addr.city ?? "",
      address_state: addr.state ?? "",
      address_country: addr.country ?? "Brasil",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot on load
    [id],
  );

  const [dados, setDados] = useState<MemberFormData>(initialDados);
  const [baseline] = useState(initialDados);

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters-for-select"],
    queryFn: () => listChaptersForSelect(),
  });

  const existing = data.guardians ?? [];
  const [guardian1, setGuardian1] = useState<GuardianFormData>({
    ...emptyGuardian,
    full_name: existing[0]?.full_name ?? "",
    relationship: existing[0]?.relationship ?? "",
    phone: existing[0]?.phone ?? "",
    email: existing[0]?.email ?? "",
  });
  const [guardian2, setGuardian2] = useState<GuardianFormData | null>(
    existing[1]
      ? {
          ...emptyGuardian,
          full_name: existing[1].full_name ?? "",
          relationship: existing[1].relationship ?? "",
          phone: existing[1].phone ?? "",
          email: existing[1].email ?? "",
        }
      : null,
  );

  const menor = isUnder21(dados.birth_date);

  function buildDiff() {
    const keys = Object.keys(FIELD_LABELS) as (keyof MemberFormData)[];
    const changes: { field: string; label: string; before: string | null; after: string | null }[] =
      [];
    for (const key of keys) {
      const before = String(baseline[key] ?? "");
      const after = String(dados[key] ?? "");
      if (before !== after) {
        changes.push({
          field: key,
          label: FIELD_LABELS[key] ?? key,
          before: before || null,
          after: after || null,
        });
      }
    }
    return changes;
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const guardians = [
        ...(guardian1.full_name.trim() ? [guardian1] : []),
        ...(guardian2?.full_name.trim() ? [guardian2] : []),
      ];
      if (menor && guardians.length === 0) {
        throw new Error("Membros com menos de 21 anos precisam de ao menos um responsável");
      }
      const statusChanging = dados.status !== (rawStatus === "irregular" ? "irregular" : "regular");
      if (
        (dados.status === "irregular" ||
          (rawStatus === "irregular" && dados.status === "regular")) &&
        (statusChanging || dados.status === "irregular") &&
        !dados.status_effective_on
      ) {
        throw new Error(
          dados.status === "irregular"
            ? "Informe a data em que o membro se tornou irregular"
            : "Informe a data do retorno à regularidade",
        );
      }
      return updateMember({
        data: {
          id,
          full_name: dados.full_name.trim(),
          birth_date: dados.birth_date || null,
          exam_grau_iniciatico: dados.exam_grau_iniciatico || null,
          exam_grau_demolay: dados.exam_grau_demolay || null,
          iniciacao_ordem: dados.iniciacao_ordem || null,
          iniciacao_grau_demolay: dados.iniciacao_grau_demolay || null,
          demolay_id: dados.demolay_id,
          masonic_id: dados.masonic_id,
          initiation_chapter_id: dados.initiation_chapter_id || null,
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
        },
      });
    },
    onSuccess: async () => {
      toast.success("Cadastro atualizado");
      await qc.invalidateQueries({ queryKey: ["member", id] });
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["dues-year"] });
      navigate({ to: "/membros/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Sem capítulo ativo");
      const changes = buildDiff();
      if (changes.length === 0) throw new Error("Nenhuma alteração detectada");
      return createMemberChangeRequest({
        data: {
          memberId: id,
          requestingChapterId: active.chapter_id,
          changes,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Solicitação enviada ao capítulo originário");
      await qc.invalidateQueries({ queryKey: ["member-change-requests"] });
      navigate({ to: "/membros/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao solicitar alteração"),
  });

  return (
    <div>
      <PageHeader
        title={isOrigin ? "Editar membro" : "Solicitar alteração"}
        subtitle={data.member.full_name}
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/membros/$id", params: { id } })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />
      {!isOrigin && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Este membro pertence ao capítulo{" "}
          <strong>{data.originChapter?.name ?? "originário"}</strong>. As alterações serão
          enviadas como solicitação e só entram em vigor após aprovação.
        </p>
      )}
      <Card className="space-y-6 rounded-[12px] p-6">
        <MemberDataFields
          value={dados}
          onChange={(p) => setDados((d) => ({ ...d, ...p }))}
          showPiiHint={isOrigin}
          initialStatus={rawStatus === "irregular" ? "irregular" : "regular"}
          chapters={chapters}
          cepResetKey={id}
        />

        {isOrigin && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold">
              Responsáveis {menor && <span className="text-sm text-muted-foreground">(obrigatório)</span>}
            </h3>
            <GuardianFields
              title="Responsável 1 (principal)"
              value={guardian1}
              onChange={(p) => setGuardian1((g) => ({ ...g, ...p }))}
              required={menor}
            />
            {guardian2 ? (
              <div className="space-y-2">
                <GuardianFields
                  title="Responsável 2"
                  value={guardian2}
                  onChange={(p) => setGuardian2((g) => ({ ...(g ?? emptyGuardian), ...p }))}
                />
                <Button variant="ghost" size="sm" onClick={() => setGuardian2(null)}>
                  <X className="mr-1 h-4 w-4" /> Remover responsável 2
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGuardian2({ ...emptyGuardian })}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar responsável 2
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {isOrigin ? (
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              <Check className="mr-2 h-4 w-4" /> Salvar
            </Button>
          ) : (
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              style={{ backgroundColor: active?.chapter.primary_color }}
            >
              <Send className="mr-2 h-4 w-4" /> Solicitar alteração
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
