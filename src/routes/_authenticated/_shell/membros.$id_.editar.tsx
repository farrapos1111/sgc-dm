import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMember, updateMember } from "@/lib/members.functions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isUnder21 } from "@/lib/format";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  MemberDataFields,
  GuardianFields,
  emptyGuardian,
  type MemberFormData,
  type GuardianFormData,
  type MemberStatus,
} from "@/components/members/MemberFields";
import { ArrowLeft, Check, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/membros/$id_/editar")({
  head: () => ({ meta: [{ title: "Editar membro — SG-CDM" }] }),
  component: EditarMembro,
});

const memberQO = (id: string) =>
  queryOptions({ queryKey: ["member", id], queryFn: () => getMember({ data: { id } }) });

function EditarMembro() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const { data } = useSuspenseQuery(memberQO(id));
  const addr = (data.member.address ?? {}) as Record<string, string>;

  const [dados, setDados] = useState<MemberFormData>({
    full_name: data.member.full_name ?? "",
    birth_date: data.member.birth_date ?? "",
    exam_grau_iniciatico: data.member.exam_grau_iniciatico ?? "",
    exam_grau_demolay: data.member.exam_grau_demolay ?? "",
    iniciacao_ordem: data.member.iniciacao_ordem ?? "",
    iniciacao_grau_demolay: data.member.iniciacao_grau_demolay ?? "",
    status: (data.member.status ?? "ativo") as MemberStatus,
    cpf: "",
    rg: "",
    phone: data.member.phone ?? "",
    email: data.member.email ?? "",
    address_street: addr.street ?? "",
    address_city: addr.city ?? "",
    address_state: addr.state ?? "",
    address_zip: addr.zip ?? "",
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

  const mutation = useMutation({
    mutationFn: async () => {
      const guardians = [
        ...(guardian1.full_name.trim() ? [guardian1] : []),
        ...(guardian2?.full_name.trim() ? [guardian2] : []),
      ];
      if (menor && guardians.length === 0) {
        throw new Error("Membros com menos de 21 anos precisam de ao menos um responsável");
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
          cpf: dados.cpf,
          rg: dados.rg,
          phone: dados.phone,
          email: dados.email,
          address: {
            street: dados.address_street,
            city: dados.address_city,
            state: dados.address_state,
            zip: dados.address_zip,
          },
          status: dados.status,
          guardians,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Cadastro atualizado");
      await qc.invalidateQueries({ queryKey: ["member", id] });
      await qc.invalidateQueries({ queryKey: ["members"] });
      navigate({ to: "/membros/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <div>
      <PageHeader
        title="Editar membro"
        subtitle={data.member.full_name}
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/membros/$id", params: { id } })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />
      <Card className="space-y-6 rounded-[12px] p-6">
        <MemberDataFields
          value={dados}
          onChange={(p) => setDados((d) => ({ ...d, ...p }))}
          showPiiHint
        />

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
                <X className="mr-2 h-4 w-4" /> Remover segundo responsável
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setGuardian2({ ...emptyGuardian })}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar segundo responsável
            </Button>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ backgroundColor: active?.chapter.primary_color }}
          >
            {mutation.isPending ? "Salvando…" : (
              <>
                <Check className="mr-2 h-4 w-4" /> Salvar alterações
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
