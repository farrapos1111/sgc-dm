import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { saveMinutes } from "@/lib/attendance.functions";
import {
  listTemplates,
  getMinuteContext,
  getMinuteApprovals,
  submitMinute,
  reopenMinute,
  signMinute,
  SIGNER_ROLES,
  SIGNER_LABELS,
  MINUTE_STATUS_LABELS,
  type SignerRole,
} from "@/lib/minutes.functions";
import {
  ensureMinutePublicShare,
  listMinutePublicVotes,
  MINUTE_PUBLIC_SHARE_PASSWORD,
} from "@/lib/minutes-share.functions";
import { applyVars, AVAILABLE_VARS } from "@/lib/minute-vars";
import { currentTerm } from "@/lib/terms";
import { formatDateTimeBR } from "@/lib/format";
import {
  CheckCircle2,
  Download,
  FileText,
  Link2,
  Lock,
  MessageSquareText,
  RotateCcw,
  Signature,
} from "lucide-react";
import { useActiveChapter } from "@/context/ActiveChapterContext";

type Props = {
  chapterId: string;
  calendarEventId: string;
  item: { title: string; start_at: string; location: string | null; address?: string | null };
  minutes: { id: string; content: string; status: string; updated_at: string } | null;
  roleName: string | null | undefined;
  onChanged: () => void;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  rascunho: { bg: "#F3F4F6", color: "#6B6B6B" },
  em_revisao: { bg: "#FEF3C7", color: "#B45309" },
  aprovada: { bg: "#D1FAE5", color: "#047857" },
};

export function MinutesPanel({ chapterId, calendarEventId, item, minutes, roleName, onChanged }: Props) {
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const term = currentTerm();
  const [exporting, setExporting] = useState(false);
  const [ata, setAta] = useState(minutes?.content ?? "");
  const [templateId, setTemplateId] = useState<string>("");

  useEffect(() => {
    setAta(minutes?.content ?? "");
  }, [minutes?.content]);

  const status = minutes?.status ?? "rascunho";
  const editable = status === "rascunho";

  const templates = useQuery({
    queryKey: ["minute-templates", chapterId],
    queryFn: () => listTemplates({ data: { chapterId } }),
  });

  const ctx = useQuery({
    queryKey: ["minute-context", chapterId, term.year, term.semester],
    queryFn: () =>
      getMinuteContext({
        data: { chapterId, termYear: term.year, termSemester: term.semester },
      }),
  });

  const approvals = useQuery({
    queryKey: ["minute-approvals", minutes?.id],
    queryFn: () => getMinuteApprovals({ data: { minuteId: minutes!.id } }),
    enabled: Boolean(minutes?.id),
  });

  const publicVotes = useQuery({
    queryKey: ["minute-public-votes", minutes?.id],
    queryFn: () => listMinutePublicVotes({ data: { minuteId: minutes!.id } }),
    enabled: Boolean(minutes?.id),
    refetchInterval: editable ? 15_000 : false,
  });

  const signedRoles = useMemo(
    () => new Set(((approvals.data ?? []) as any[]).map((a) => a.signer_role)),
    [approvals.data],
  );

  const refresh = () => {
    onChanged();
    qc.invalidateQueries({ queryKey: ["minute-approvals", minutes?.id] });
    qc.invalidateQueries({ queryKey: ["minute-public-votes", minutes?.id] });
  };

  const save = useMutation({
    mutationFn: (content: string) =>
      saveMinutes({ data: { chapterId, calendarEventId, content } }),
    onSuccess: () => {
      toast.success("Ata salva");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar ata"),
  });

  const conclude = useMutation({
    mutationFn: async () => {
      const saved = await saveMinutes({ data: { chapterId, calendarEventId, content: ata } });
      return submitMinute({ data: { minuteId: (saved as any).minute.id } });
    },
    onSuccess: () => {
      toast.success("Ata concluída — em revisão para aprovação");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao concluir ata"),
  });

  const reopen = useMutation({
    mutationFn: () => reopenMinute({ data: { minuteId: minutes!.id } }),
    onSuccess: () => {
      toast.success("Ata reaberta para correção — assinaturas removidas");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reabrir ata"),
  });

  const sign = useMutation({
    mutationFn: (signerRole: SignerRole) =>
      signMinute({ data: { minuteId: minutes!.id, signerRole } }),
    onSuccess: (r: any) => {
      toast.success(r?.approved ? "Ata aprovada!" : "Assinatura registrada");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao assinar"),
  });

  const sharePublic = useMutation({
    mutationFn: async () => {
      if (!ata.trim()) throw new Error("Escreva a ata antes de compartilhar");
      const saved = await saveMinutes({
        data: { chapterId, calendarEventId, content: ata },
      });
      const minuteId = (saved as any).minute.id as string;
      const share = await ensureMinutePublicShare({ data: { minuteId } });
      return share;
    },
    onSuccess: async (share) => {
      refresh();
      const url = `${window.location.origin}/ata/${share.token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(`Link copiado. Senha: ${MINUTE_PUBLIC_SHARE_PASSWORD}`);
      } catch {
        toast.success(`Link gerado. Senha: ${MINUTE_PUBLIC_SHARE_PASSWORD}`, {
          description: url,
        });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar link público"),
  });

  function insertTemplate(id: string) {
    setTemplateId(id);
    const tpl = ((templates.data ?? []) as any[]).find((t) => t.id === id);
    if (!tpl) return;
    const filled = applyVars(tpl.body, {
      chapterName: ctx.data?.chapter?.name,
      chapterCity: ctx.data?.chapter?.city,
      date: item.start_at,
      location: item.location,
      address: item.address,
      officers: ctx.data?.officers,
    });
    setAta(filled);
  }

  const st = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
  const votes = publicVotes.data ?? [];

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4" /> Ata da sessão
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: st.bg, color: st.color }}
          >
            {MINUTE_STATUS_LABELS[status] ?? status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || !ata.trim()}
          onClick={async () => {
            setExporting(true);
            try {
              const { exportMinutePdf } = await import("@/lib/minute-pdf");
              await exportMinutePdf({
                chapterName: active?.chapter.name ?? "",
                chapterCity: active?.chapter.city,
                logoPath: active?.chapter.logo_url,
                title: item.title,
                dateISO: item.start_at,
                status: MINUTE_STATUS_LABELS[status] ?? status,
                signatures: SIGNER_ROLES.filter((r) => signedRoles.has(r)).map(
                  (r) => SIGNER_LABELS[r],
                ),
                content: ata,
              });
            } catch (e: any) {
              toast.error(e?.message ?? "Erro ao gerar o PDF");
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Gerando…" : "Exportar PDF"}
        </Button>
        {editable && (
          <Select value={templateId} onValueChange={insertTemplate}>
            <SelectTrigger className="h-9 w-[260px] text-xs">
              <SelectValue placeholder="Inserir modelo de ata…" />
            </SelectTrigger>
            <SelectContent>
              {((templates.data ?? []) as any[]).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        </div>
      </div>

      <Textarea
        value={ata}
        onChange={(e) => setAta(e.target.value)}
        rows={18}
        readOnly={!editable}
        className="text-sm leading-relaxed"
        placeholder="Selecione um modelo de ata ou escreva livremente."
      />

      {editable ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Variáveis dinâmicas: {AVAILABLE_VARS.join(" · ")} — as não reconhecidas permanecem entre
            colchetes para preenchimento manual.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {minutes?.updated_at
                ? `Última alteração: ${formatDateTimeBR(minutes.updated_at)}`
                : "Ainda não salva"}
            </span>
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate(ata)}>
              {save.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button
              variant="outline"
              disabled={sharePublic.isPending || !ata.trim()}
              onClick={() => sharePublic.mutate()}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {sharePublic.isPending ? "Gerando link…" : "Compartilhar visão pública"}
            </Button>
            <Button
              style={{ backgroundColor: "var(--chapter-primary)" }}
              disabled={conclude.isPending || !ata.trim()}
              onClick={() => conclude.mutate()}
            >
              {conclude.isPending ? "Concluindo…" : "Concluir ata"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Texto bloqueado. Reabra a ata para corrigir.
        </p>
      )}

      {minutes && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="h-4 w-4" /> Feedback público
            {votes.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {votes.length}
              </Badge>
            )}
          </div>
          {votes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {editable
                ? "Compartilhe o link para os membros lerem a ata e registrarem aprovada/reprovada."
                : "Nenhum feedback registrado nesta ata."}
            </p>
          ) : (
            <ul className="space-y-2">
              {votes.map((v) => (
                <li
                  key={v.id}
                  className="rounded-[8px] border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{v.email}</span>
                    <Badge
                      style={
                        v.decision === "aprovada"
                          ? { backgroundColor: "#D1FAE5", color: "#047857" }
                          : { backgroundColor: "#FEE2E2", color: "#B91C1C" }
                      }
                    >
                      {v.decision === "aprovada" ? "Aprovada" : "Reprovada"}
                    </Badge>
                  </div>
                  {v.justification && (
                    <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">
                      {v.justification}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTimeBR(v.updated_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {minutes && status !== "rascunho" && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Signature className="h-4 w-4" /> Assinaturas obrigatórias
          </div>
          <ul className="space-y-2">
            {SIGNER_ROLES.map((r) => {
              const signed = signedRoles.has(r);
              const canSign = roleName === "admin_total" || roleName === r;
              return (
                <li
                  key={r}
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-border p-3"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className="h-4 w-4"
                      style={{ color: signed ? "#047857" : "var(--muted-foreground)" }}
                    />
                    {SIGNER_LABELS[r]}
                  </span>
                  {signed ? (
                    <Badge style={{ backgroundColor: "#D1FAE5", color: "#047857" }}>Assinada</Badge>
                  ) : canSign ? (
                    <Button size="sm" variant="outline" disabled={sign.isPending} onClick={() => sign.mutate(r)}>
                      Assinar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendente</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" disabled={reopen.isPending} onClick={() => reopen.mutate()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {reopen.isPending ? "Reabrindo…" : "Reabrir para correção"}
            </Button>
          </div>
          {status === "aprovada" && (
            <p className="mt-2 text-xs" style={{ color: "#047857" }}>
              Ata aprovada pelos três responsáveis.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
