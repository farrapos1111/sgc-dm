import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/investigations/SignaturePad";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import {
  ageBandFromBirthDate,
  castSindicanciaVote,
  finalizeSindicanciaVoting,
  getSindicanciaAtaTemplates,
  getSindicanciaMinute,
  getSindicanciaVoting,
  revealInvestigationPii,
  saveSindicanciaMinute,
  type SindicanciaListItem,
} from "@/lib/investigations.functions";
import {
  AGE_BAND_LABELS,
  SIGNATURE_ROLES,
  formatAtaAnswer,
  type AgeBand,
  type AtaBlock,
} from "@/lib/member-documents";
import { applySindicanciaAtaVars } from "@/lib/sindicancia-ata-vars";
import { exportSindicanciaQuestionnairePdf } from "@/lib/sindicancia-questionnaire-pdf";
import { useCommissionAccess } from "@/hooks/useCommissionAccess";

export type AtaFormMode = "roteiro" | "ata" | "votacao";

type Props = {
  chapterId: string;
  accent?: string;
  row: SindicanciaListItem;
  writable: boolean;
  /** roteiro = só textos/perguntas; ata = respostas; votacao = leitura + votos */
  mode?: AtaFormMode;
};

function prefillFromFile(
  row: SindicanciaListItem,
): Record<string, string | boolean | null> {
  const f = row.file;
  const nome = f?.candidate_name || row.nominee_name || "";
  const out: Record<string, string | boolean | null> = {
    pre_nome: nome,
  };
  if (f) {
    out.pre_macom = Boolean(f.has_mason_relative);
    if (f.has_mason_relative) {
      out.pre_macom_grau = [f.mason_relative_name, f.mason_relative_lodge]
        .filter(Boolean)
        .join(" — ");
    }
    out.pre_demolay = Boolean(f.has_demolay_relative);
    if (f.has_demolay_relative) {
      out.pre_demolay_grau = [
        f.demolay_relative_name,
        f.demolay_relative_chapter,
      ]
        .filter(Boolean)
        .join(" — ");
    }
  }
  return out;
}

function blockVisible(
  block: AtaBlock,
  answers: Record<string, string | boolean | null>,
  mode: AtaFormMode,
): boolean {
  if (mode === "roteiro") return true;
  if (!block.showWhen) return true;
  return answers[block.showWhen.id] === block.showWhen.equals;
}

export function SindicanciaAtaForm({
  chapterId,
  accent,
  row,
  writable,
  mode = "ata",
}: Props) {
  const { active } = useActiveChapter();
  const { canManage } = useCommissionAccess();
  const canFinalize = canManage("sindicancias");
  const qc = useQueryClient();
  const ageBand: AgeBand = ageBandFromBirthDate(
    row.file?.candidate_birth_date ?? null,
  );
  const isRoteiro = mode === "roteiro";
  const isVotacao = mode === "votacao" || row.status === "votacao_comissao";
  const answersWritable = writable && mode === "ata" && !isVotacao;

  const { data: templates } = useQuery({
    queryKey: ["sindicancia-ata-templates", chapterId],
    queryFn: () => getSindicanciaAtaTemplates({ data: { chapterId } }),
  });

  const { data: minute, isLoading } = useQuery({
    queryKey: ["sindicancia-minute", row.calendar_event_id],
    queryFn: () =>
      getSindicanciaMinute({
        data: { calendarEventId: row.calendar_event_id },
      }),
    enabled: !isRoteiro,
  });

  const { data: voting } = useQuery({
    queryKey: ["sindicancia-voting", row.calendar_event_id],
    enabled: isVotacao && !isRoteiro,
    queryFn: () =>
      getSindicanciaVoting({
        data: {
          calendarEventId: row.calendar_event_id,
          chapterId,
        },
      }),
  });

  const blocks: AtaBlock[] = templates?.[ageBand]?.blocks ?? [];

  const [answers, setAnswers] = useState<
    Record<string, string | boolean | null>
  >({});
  const [signatures, setSignatures] = useState<Record<string, string | null>>(
    {},
  );
  const [revealed, setRevealed] = useState<{ cpf?: string; rg?: string }>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setRevealed({});
  }, [row.calendar_event_id, mode]);

  useEffect(() => {
    if (isRoteiro) {
      setAnswers(prefillFromFile(row));
      setHydrated(true);
      return;
    }
    if (hydrated) return;
    if (minute === undefined) return;
    const base = prefillFromFile(row);
    const saved = minute?.answers ?? {};
    setAnswers({ ...base, ...saved });
    setSignatures(minute?.signatures ?? {});
    setHydrated(true);
  }, [minute, row, hydrated, isRoteiro]);

  const sindicanteName =
    row.investigator?.full_name || row.investigator_text || "";
  const escrivaoName = row.clerk?.full_name || row.clerk_text || "";
  const seniorName = row.senior?.full_name || row.senior_text || "";

  const cpfDisplay =
    revealed.cpf ||
    (row.file?.cpf_last2 ? `•••${row.file.cpf_last2}` : "—");
  const rgDisplay =
    revealed.rg || (row.file?.rg_last2 ? `•••${row.file.rg_last2}` : "—");

  const varCtx = useMemo(
    () => ({
      candidato:
        String(answers.pre_nome ?? "").trim() ||
        row.file?.candidate_name ||
        row.nominee_name,
      rg: rgDisplay === "—" ? "" : rgDisplay,
      cpf: cpfDisplay === "—" ? "" : cpfDisplay,
      capitulo_nome: active?.chapter.name,
      numero: active?.chapter.number,
      cidade: active?.chapter.city,
      sindicante: sindicanteName,
      escrivao: escrivaoName,
      senior: seniorName,
      date: row.event?.start_at ?? null,
    }),
    [
      answers.pre_nome,
      row,
      active,
      rgDisplay,
      cpfDisplay,
      sindicanteName,
      escrivaoName,
      seniorName,
    ],
  );

  const declaration = useMemo(() => {
    const decl = blocks.find((b) => b.id === "decl_texto");
    if (!decl) {
      return `Declaramos, para os devidos fins, que as informações prestadas nesta ata de sindicância referente a ${row.nominee_name} são verdadeiras, e firmamos abaixo.`;
    }
    return applySindicanciaAtaVars(decl.label, varCtx);
  }, [blocks, varCtx, row.nominee_name]);

  const save = useMutation({
    mutationFn: (completed: boolean) =>
      saveSindicanciaMinute({
        data: {
          calendarEventId: row.calendar_event_id,
          chapterId,
          age_band: ageBand,
          answers,
          signatures,
          completed,
        },
      }),
    onSuccess: async (_, completed) => {
      toast.success(
        completed
          ? "Ata concluída — status: Votação Comissão"
          : "Rascunho salvo",
      );
      await qc.invalidateQueries({
        queryKey: ["sindicancia-minute", row.calendar_event_id],
      });
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["open-sindicancias"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao salvar ata"),
  });

  const voteMut = useMutation({
    mutationFn: (vote: "aprovada" | "reprovada") =>
      castSindicanciaVote({
        data: {
          calendarEventId: row.calendar_event_id,
          chapterId,
          vote,
        },
      }),
    onSuccess: async () => {
      toast.success("Voto registrado");
      await qc.invalidateQueries({
        queryKey: ["sindicancia-voting", row.calendar_event_id],
      });
      await qc.invalidateQueries({ queryKey: ["open-sindicancias"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao votar"),
  });

  const finalizeMut = useMutation({
    mutationFn: (result?: "aprovada" | "reprovada") =>
      finalizeSindicanciaVoting({
        data: {
          calendarEventId: row.calendar_event_id,
          chapterId,
          result,
        },
      }),
    onSuccess: async (res) => {
      toast.success(
        res.status === "aprovada"
          ? "Sindicância aprovada"
          : "Sindicância reprovada",
      );
      await qc.invalidateQueries({ queryKey: ["sindicancias"] });
      await qc.invalidateQueries({ queryKey: ["open-sindicancias"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar"),
  });

  async function revealField(field: "cpf" | "rg") {
    if (!row.file_id) {
      toast.error("Sindicância sem ficha vinculada");
      return;
    }
    try {
      const res = await revealInvestigationPii({
        data: { fileId: row.file_id, field },
      });
      setRevealed((r) => ({ ...r, [field]: res.value }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sem permissão");
    }
  }

  async function downloadPdf() {
    if (!active || isRoteiro) return;
    try {
      await exportSindicanciaQuestionnairePdf({
        chapterName: active.chapter.name,
        chapterNumber: active.chapter.number,
        chapterCity: active.chapter.city,
        logoPath: active.chapter.logo_url,
        ageBandLabel: AGE_BAND_LABELS[ageBand],
        nomineeName:
          String(answers.pre_nome ?? "").trim() || row.nominee_name,
        birthDate: row.file?.candidate_birth_date,
        cpf: cpfDisplay,
        rg: rgDisplay,
        email: row.file?.candidate_email,
        phone: row.file?.candidate_phone || row.file?.celular,
        sponsor: row.file?.sponsor_text || row.file?.referred_by,
        guardians: row.file?.guardians,
        sindicante: sindicanteName,
        senior: seniorName,
        escrivao: escrivaoName,
        eventDate: row.event?.start_at,
        blocks,
        answers,
        declaration,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF");
    }
  }

  if (!isRoteiro && (isLoading || !hydrated)) {
    return <p className="text-sm text-muted-foreground">Carregando ata…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {isRoteiro ? "Roteiro da Sindicância" : "Faixa etária"}
          </p>
          <p className="text-sm font-medium">{AGE_BAND_LABELS[ageBand]}</p>
          {isRoteiro && (
            <p className="mt-1 text-xs text-muted-foreground">
              Somente textos e perguntas — uso do sindicante. O escrivão
              preenche as respostas na Ata.
            </p>
          )}
        </div>
        {!isRoteiro && (
          <Button size="sm" variant="outline" onClick={() => void downloadPdf()}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
        )}
      </div>

      {!isRoteiro && row.file_id && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            CPF: {cpfDisplay}
            {row.file?.cpf_last2 && !revealed.cpf ? (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void revealField("cpf")}
              >
                Revelar
              </button>
            ) : null}
          </span>
          <span>
            RG: {rgDisplay}
            {row.file?.rg_last2 && !revealed.rg ? (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void revealField("rg")}
              >
                Revelar
              </button>
            ) : null}
          </span>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          Modelo de perguntas pendente para esta faixa etária.
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => {
            if (!blockVisible(block, answers, mode)) return null;

            if (block.type === "heading") {
              return (
                <h4
                  key={block.id}
                  className="border-b border-border/70 pb-1 text-sm font-semibold"
                >
                  {block.label}
                </h4>
              );
            }
            if (block.type === "text") {
              const rendered =
                block.id === "decl_texto" && !isRoteiro
                  ? declaration
                  : applySindicanciaAtaVars(block.label, varCtx);
              return (
                <p
                  key={block.id}
                  className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                >
                  {rendered}
                </p>
              );
            }

            if (isRoteiro) {
              return (
                <div key={block.id} className="space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {block.label}
                    {block.type === "yes_no" ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        [Sim / Não]
                      </span>
                    ) : null}
                    {block.required === false ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    ) : null}
                  </p>
                </div>
              );
            }

            if (block.type === "yes_no") {
              if (!answersWritable) {
                return (
                  <div key={block.id} className="space-y-1">
                    <p className="text-sm font-medium leading-snug">
                      {block.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatAtaAnswer(answers[block.id]) || "—"}
                    </p>
                  </div>
                );
              }
              return (
                <div
                  key={block.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Label className="text-sm leading-snug">
                    {block.label}
                    {block.required === false ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (opcional)
                      </span>
                    ) : null}
                  </Label>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {answers[block.id] === true
                        ? "Sim"
                        : answers[block.id] === false
                          ? "Não"
                          : "—"}
                    </span>
                    <Switch
                      checked={Boolean(answers[block.id])}
                      onCheckedChange={(v) =>
                        setAnswers((a) => ({ ...a, [block.id]: v }))
                      }
                    />
                  </div>
                </div>
              );
            }

            if (!answersWritable) {
              return (
                <div key={block.id} className="space-y-1">
                  <p className="text-sm font-medium leading-snug">
                    {block.label}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {formatAtaAnswer(answers[block.id]) || "—"}
                  </p>
                </div>
              );
            }

            return (
              <div key={block.id} className="space-y-1.5">
                <Label className="text-sm leading-snug">
                  {block.label}
                  {block.required === false ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (opcional)
                    </span>
                  ) : null}
                </Label>
                {block.type === "long_text" ? (
                  <Textarea
                    rows={3}
                    value={String(answers[block.id] ?? "")}
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
          })}
        </div>
      )}

      {!isRoteiro && answersWritable && (
        <section className="space-y-3 rounded-[12px] border border-border/70 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold">Assinaturas</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Firmam abaixo o indicado, responsáveis e a comissão, confirmando as
            informações desta sindicância.
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
                disabled={!answersWritable}
                onChange={(v) =>
                  setSignatures((s) => ({ ...s, [role.id]: v }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {isVotacao && !isRoteiro && voting && (
        <section className="space-y-3 rounded-[12px] border border-border/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Votação da Comissão</h4>
            <div className="flex gap-2">
              <Badge variant="secondary">
                Aprovada: {voting.tally.aprovada}
              </Badge>
              <Badge variant="secondary">
                Reprovada: {voting.tally.reprovada}
              </Badge>
            </div>
          </div>
          {voting.votes.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {voting.votes.map((v) => (
                <li key={v.member_id}>
                  {v.member_name ?? "Membro"} —{" "}
                  {v.vote === "aprovada" ? "Aprovada" : "Reprovada"}
                </li>
              ))}
            </ul>
          )}
          {voting.canVote && row.status === "votacao_comissao" && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={voteMut.isPending}
                style={accent ? { backgroundColor: accent } : undefined}
                onClick={() => voteMut.mutate("aprovada")}
              >
                {voting.myVote === "aprovada" ? "✓ " : ""}Votar Aprovada
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={voteMut.isPending}
                onClick={() => voteMut.mutate("reprovada")}
              >
                {voting.myVote === "reprovada" ? "✓ " : ""}Votar Reprovada
              </Button>
            </div>
          )}
          {!voting.canVote && (
            <p className="text-xs text-muted-foreground">
              {voting.reason ?? "Sem direito a voto."}
            </p>
          )}
          {canFinalize && row.status === "votacao_comissao" && (
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={finalizeMut.isPending}
                onClick={() => finalizeMut.mutate(undefined)}
              >
                Encerrar pela maioria
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={finalizeMut.isPending}
                onClick={() => finalizeMut.mutate("aprovada")}
              >
                Encerrar como Aprovada
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={finalizeMut.isPending}
                onClick={() => finalizeMut.mutate("reprovada")}
              >
                Encerrar como Reprovada
              </Button>
            </div>
          )}
        </section>
      )}

      {answersWritable && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate(false)}
          >
            Salvar rascunho
          </Button>
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => void downloadPdf()}
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Baixar PDF
          </Button>
          <Button
            disabled={save.isPending}
            style={accent ? { backgroundColor: accent } : undefined}
            onClick={() => save.mutate(true)}
          >
            Concluir ata
          </Button>
        </div>
      )}

      {!isRoteiro && minute?.completed_at && (
        <p className="text-xs text-muted-foreground">
          Concluída em {new Date(minute.completed_at).toLocaleString("pt-BR")}
        </p>
      )}
      {!isRoteiro && minute?.updated_at && !minute.completed_at && (
        <p className="text-xs text-muted-foreground">
          Rascunho atualizado em{" "}
          {new Date(minute.updated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
