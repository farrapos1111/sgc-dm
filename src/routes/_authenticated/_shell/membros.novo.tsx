import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createMember } from "@/lib/members.functions";
import { isUnder21 } from "@/lib/format";
import {
  MemberDataFields,
  GuardianFields,
  emptyMember,
  emptyGuardian,
  type MemberFormData,
  type GuardianFormData,
} from "@/components/members/MemberFields";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";

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

function NovoMembro() {
  const { active } = useActiveChapter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [dados, setDados] = useState<MemberFormData>(emptyMember);
  const [guardian1, setGuardian1] = useState<GuardianFormData>(emptyGuardian);
  const [guardian2, setGuardian2] = useState<GuardianFormData | null>(null);
  const [consent, setConsent] = useState(false);

  const menor = isUnder21(dados.birth_date);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Sem capítulo ativo");
      const guardians = menor
        ? [guardian1, ...(guardian2 && guardian2.full_name.trim() ? [guardian2] : [])]
        : [];
      return createMember({
        data: {
          chapter_id: active.chapter_id,
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
          consent_text_version: menor ? CONSENT_VERSION : "",
        },
      });
    },
    onSuccess: async () => {
      toast.success("Membro cadastrado");
      await qc.invalidateQueries({ queryKey: ["members"] });
      navigate({ to: "/membros" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cadastrar"),
  });

  function nextFromDados() {
    const parsed = stepDadosSchema.safeParse(dados);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios");
      return;
    }
    setStep(menor ? 2 : 3);
  }

  return (
    <div>
      <PageHeader
        title="Novo membro"
        subtitle={`Etapa ${step} de ${menor ? 3 : 2}`}
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/membros" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        }
      />

      <Card className="rounded-[12px] p-6">
        {step === 1 && (
          <div className="space-y-4">
            <MemberDataFields value={dados} onChange={(p) => setDados((d) => ({ ...d, ...p }))} />
            <div className="flex justify-end pt-2">
              <Button onClick={nextFromDados} style={{ backgroundColor: active?.chapter.primary_color }}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && menor && (
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
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={() => {
                  if (!guardian1.full_name.trim()) {
                    toast.error("Informe o nome do responsável");
                    return;
                  }
                  setStep(3);
                }}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {menor ? (
              <>
                <h3 className="text-base font-semibold">Consentimento LGPD do responsável</h3>
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
                    Eu, {guardian1.full_name || "responsável"}, li e concordo com o tratamento dos
                    dados pessoais conforme descrito acima (versão {CONSENT_VERSION}).
                  </span>
                </label>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold">Revisão</h3>
                <p className="text-sm text-muted-foreground">
                  Confira os dados na etapa anterior. O membro tem 21 anos ou mais — o consentimento
                  LGPD do responsável não é necessário.
                </p>
              </>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(menor ? 2 : 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                onClick={() => {
                  if (menor && !consent) {
                    toast.error("O responsável precisa assinalar o consentimento LGPD");
                    return;
                  }
                  mutation.mutate();
                }}
                disabled={mutation.isPending}
                style={{ backgroundColor: active?.chapter.primary_color }}
              >
                {mutation.isPending ? "Salvando…" : (
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
