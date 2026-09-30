import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/investigations/SignaturePad";
import {
  saveSindicanciaParticipationMinute,
  type SindicanciaParticipationPayload,
} from "@/lib/investigations.functions";
import {
  AGE_BAND_LABELS,
  SIGNATURE_ROLES,
  formatAtaAnswer,
  isAtaQuestionBlock,
  type AtaBlock,
} from "@/lib/member-documents";
import { applySindicanciaAtaVars, formatAtaDocumentDigits, seniorDeclarationQuality } from "@/lib/sindicancia-ata-vars";

const ROLE_LABEL = {
  escrivao: "Escrivão de Parecer",
  sindicante: "Sindicante",
  senior: "Tio/Senior",
} as const;

type Props = {
  token: string;
  demolayId: string;
  session: SindicanciaParticipationPayload;
  onClosed: () => void;
};

function blockVisible(
  block: AtaBlock,
  answers: Record<string, string | boolean | null>,
  roteiro: boolean,
): boolean {
  if (roteiro || !block.showWhen) return true;
  return answers[block.showWhen.id] === block.showWhen.equals;
}

export function SindicanciaParticipationView({
  token,
  demolayId,
  session,
  onClosed,
}: Props) {
  const roteiro = session.role !== "escrivao";
  const [answers, setAnswers] = useState<Record<string, string | boolean | null>>(
    {},
  );
  const [signatures, setSignatures] = useState<Record<string, string | null>>(
    {},
  );
  const [ready, setReady] = useState(roteiro);

  useEffect(() => {
    if (roteiro) {
      setReady(true);
      return;
    }
    setAnswers({ ...session.prefill, ...(session.minute?.answers ?? {}) });
    setSignatures(session.minute?.signatures ?? {});
    setReady(true);
  }, [roteiro, session]);

  const varCtx = useMemo(
    () => ({
      candidato:
        String(answers.pre_nome ?? "").trim() || session.nominee,
      rg: formatAtaDocumentDigits("rg", session.candidateRg),
      cpf: formatAtaDocumentDigits("cpf", session.candidateCpf),
      capitulo_nome: session.chapterName,
      numero: session.chapterNumber,
      cidade: session.chapterCity,
      sindicante: session.sindicante,
      escrivao: session.escrivao,
      senior: session.senior,
      seniorQualidade: seniorDeclarationQuality({
        kind: session.seniorKind,
        onCouncil: session.seniorOnCouncil,
      }),
      date: session.startAt,
    }),
    [answers.pre_nome, session],
  );

  const save = useMutation({
    mutationFn: async (completed: boolean) => {
      const payload = { token, demolayId, answers, signatures };
      const draft = await saveSindicanciaParticipationMinute({
        data: { ...payload, completed: false },
      });
      if (!completed) return draft;
      try {
        return await saveSindicanciaParticipationMinute({
          data: { ...payload, completed: true },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao salvar a ata";
        throw new Error(`${msg} A ata ficou como rascunho.`);
      }
    },
    onSuccess: (res, completed) => {
      if (completed || res.status === "votacao_comissao") {
        toast.success("Ata concluída. O link de participação foi encerrado.");
        onClosed();
        return;
      }
      toast.success("Ata salva");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a ata"),
  });

  function firstMissingRequired(): AtaBlock | null {
    for (const block of session.blocks) {
      if (!isAtaQuestionBlock(block) || !block.required) continue;
      if (block.showWhen && answers[block.showWhen.id] !== block.showWhen.equals) {
        continue;
      }
      if (!formatAtaAnswer(answers[block.id])) return block;
    }
    return null;
  }

  function conclude() {
    const missing = firstMissingRequired();
    if (missing) {
      toast.error(`Preencha o campo obrigatório: ${missing.label}`);
      return;
    }
    save.mutate(true);
  }

  async function copyChave() {
    try {
      await navigator.clipboard.writeText(session.chaveText);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar a chave");
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {ROLE_LABEL[session.role]}
        </p>
        <p className="text-sm font-medium">{session.participantName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {roteiro
            ? "Roteiro — somente textos e perguntas."
            : `Ata · ${AGE_BAND_LABELS[session.ageBand]}`}
        </p>
      </div>

      <section className="space-y-2 rounded-[12px] border border-border/70 bg-muted/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Chave</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => void copyChave()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {session.chaveText}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{roteiro ? "Roteiro" : "Ata"}</h2>
        {session.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Modelo de perguntas pendente para esta faixa etária.
          </p>
        ) : (
          session.blocks.map((block) => {
            if (!blockVisible(block, answers, roteiro)) return null;
            if (block.type === "heading") {
              return (
                <h3
                  key={block.id}
                  className="border-b border-border/70 pb-1 text-sm font-semibold"
                >
                  {block.label}
                </h3>
              );
            }
            if (block.type === "text") {
              return (
                <p
                  key={block.id}
                  className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                >
                  {applySindicanciaAtaVars(block.label, varCtx)}
                </p>
              );
            }
            if (roteiro) {
              return (
                <p key={block.id} className="text-sm font-medium leading-snug">
                  {block.label}
                  {block.type === "yes_no" ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      [Sim / Não]
                    </span>
                  ) : null}
                </p>
              );
            }
            if (block.type === "yes_no") {
              return (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Label className="text-sm leading-snug">{block.label}</Label>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {answers[block.id] === true
                        ? "Sim"
                        : answers[block.id] === false
                          ? "Não"
                          : "—"}
                    </span>
                    <Switch
                      checked={answers[block.id] === true}
                      onCheckedChange={(next) =>
                        setAnswers((a) => ({ ...a, [block.id]: next }))
                      }
                    />
                  </div>
                </div>
              );
            }
            const long = block.type === "long_text";
            return (
              <div key={block.id} className="space-y-1.5">
                <Label className="text-sm leading-snug">{block.label}</Label>
                {long ? (
                  <Textarea
                    value={String(answers[block.id] ?? "")}
                    rows={4}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [block.id]: e.target.value }))
                    }
                  />
                ) : (
                  <Input
                    value={String(answers[block.id] ?? "")}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [block.id]: e.target.value }))
                    }
                  />
                )}
              </div>
            );
          })
        )}
      </section>

      {!roteiro ? (
        <>
          <section className="space-y-3 rounded-[12px] border border-border/70 bg-muted/10 p-4">
            <h2 className="text-sm font-semibold">Assinaturas</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Firmam abaixo o indicado, responsáveis e a comissão. A assinatura
              do Responsável 2 não é obrigatória.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SIGNATURE_ROLES.map((role) => (
                <SignaturePad
                  key={role.id}
                  label={role.label}
                  value={
                    signatures[role.id]?.startsWith("data:")
                      ? signatures[role.id]
                      : null
                  }
                  onChange={(v) =>
                    setSignatures((s) => ({ ...s, [role.id]: v }))
                  }
                />
              ))}
            </div>
          </section>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate(false)}
            >
              {save.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button
              type="button"
              disabled={save.isPending}
              onClick={conclude}
            >
              Concluir ata
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Ao concluir, a ata segue para votação da comissão e este link deixa de abrir.
          </p>
        </>
      ) : null}
    </div>
  );
}
