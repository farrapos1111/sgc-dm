import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveMinutes } from "@/lib/attendance.functions";
import {
  listTemplates,
  getMinuteContext,
  getMinuteApprovals,
  submitMinute,
  reopenMinute,
  signMinute,
  deleteMinute,
  SIGNER_ROLES,
  SIGNER_LABELS,
  MINUTE_STATUS_LABELS,
  type SignerRole,
} from "@/lib/minutes.functions";
import {
  ensureMinutePublicShare,
  listMinutePublicVotes,
} from "@/lib/minutes-share.functions";
import {
  MINUTE_KINDS,
  MINUTE_KIND_LABELS,
  MINUTE_KIND_SHORT_LABELS,
  isMinuteKind,
  minuteKindFromLevel,
  minuteKindToLevel,
  type MinuteKind,
} from "@/lib/minute-kinds";
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
  Trash2,
} from "lucide-react";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { canonicalOfficeSignatureCode } from "@/lib/office-signatures-shared";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  MinuteBodyEditor,
  readAutocompletePref,
  writeAutocompletePref,
} from "@/components/minutes/MinuteBodyEditor";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

type Props = {
  chapterId: string;
  calendarEventId: string;
  item: {
    title: string;
    start_at: string;
    location: string | null;
    address?: string | null;
  };
  minutes: {
    id: string;
    content: string;
    status: string;
    updated_at: string;
    kind?: string | null;
    title?: string | null;
  } | null;
  roleName: string | null | undefined;
  onChanged: (info?: { minuteId?: string }) => void;
  /** Chamado após exclusão bem-sucedida (ex.: voltar à lista de atas). */
  onDeleted?: () => void;
  /**
   * Ref preenchida com flush do rascunho (salvar se houver alterações).
   * Usar ao sair da tela / trocar de aba.
   */
  flushSaveRef?: RefObject<(() => Promise<void>) | null>;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  rascunho: { bg: "#F3F4F6", color: "#6B6B6B" },
  em_revisao: { bg: "#FEF3C7", color: "#B45309" },
  aprovada: { bg: "#D1FAE5", color: "#047857" },
};

export function MinutesPanel({
  chapterId,
  calendarEventId,
  item,
  minutes,
  roleName,
  onChanged,
  onDeleted,
  flushSaveRef,
}: Props) {
  const qc = useQueryClient();
  const { active } = useActiveChapter();
  const { positions, canScreen } = useChapterAccess();
  const term = currentTerm();
  const { confirm, dialog } = useConfirmDialog();
  const canDelete = canScreen("atas", "delete");

  function canSignAs(r: SignerRole): boolean {
    if (roleName === "admin_total") return true;
    if (roleName === r) return true;
    const code = canonicalOfficeSignatureCode(r);
    return positions.includes(code) || positions.includes(r);
  }
  const [exporting, setExporting] = useState(false);
  const [ata, setAta] = useState(minutes?.content ?? "");
  const [templateId, setTemplateId] = useState<string>("");
  const [kind, setKind] = useState<MinuteKind>(() =>
    isMinuteKind(minutes?.kind) ? minutes.kind : "publica",
  );
  const [autocompleteOn, setAutocompleteOn] = useState(true);

  const status = minutes?.status ?? "rascunho";
  const editable = status === "rascunho";

  const savedContent = minutes?.content ?? "";
  const savedKind: MinuteKind = isMinuteKind(minutes?.kind)
    ? minutes.kind
    : "publica";
  const dirty =
    editable &&
    (ata !== savedContent ||
      kind !== savedKind ||
      (!minutes && ata.trim().length > 0));

  const draftRef = useRef<{
    ata: string;
    kind: MinuteKind;
    editable: boolean;
    dirty: boolean;
    chapterId: string;
    calendarEventId: string;
    hasMinute: boolean;
    minuteId: string | null;
  }>({
    ata,
    kind,
    editable,
    dirty,
    chapterId,
    calendarEventId,
    hasMinute: Boolean(minutes),
    minuteId: minutes?.id ?? null,
  });
  /** Evita segundo save no unmount depois de flush explícito (voltar / trocar aba). */
  const allowUnmountSaveRef = useRef(true);
  /** Chave estável desta instância de “Nova ata” (não reutiliza outro rascunho). */
  const clientDraftKeyRef = useRef(
    minutes?.id ? null : crypto.randomUUID(),
  );

  useEffect(() => {
    draftRef.current = {
      ata,
      kind,
      editable,
      dirty,
      chapterId,
      calendarEventId,
      hasMinute: Boolean(minutes),
      minuteId: minutes?.id ?? null,
    };
  }, [ata, kind, editable, dirty, chapterId, calendarEventId, minutes]);

  useEffect(() => {
    if (dirty) allowUnmountSaveRef.current = true;
  }, [dirty]);

  useEffect(() => {
    setAutocompleteOn(readAutocompletePref());
  }, []);

  useEffect(() => {
    setAta(minutes?.content ?? "");
  }, [minutes?.content]);

  useEffect(() => {
    if (isMinuteKind(minutes?.kind)) setKind(minutes.kind);
  }, [minutes?.kind]);

  function persist(content: string, nextKind: MinuteKind = kind) {
    return saveMinutes({
      data: {
        chapterId,
        calendarEventId,
        content,
        kind: nextKind,
        ...(minutes?.id
          ? { id: minutes.id }
          : { clientDraftKey: clientDraftKeyRef.current! }),
      },
    });
  }

  function persistDraft(d: {
    ata: string;
    kind: MinuteKind;
    chapterId: string;
    calendarEventId: string;
    minuteId?: string | null;
  }) {
    return saveMinutes({
      data: {
        chapterId: d.chapterId,
        calendarEventId: d.calendarEventId,
        content: d.ata,
        kind: d.kind,
        ...(d.minuteId
          ? { id: d.minuteId }
          : { clientDraftKey: clientDraftKeyRef.current! }),
      },
    });
  }

  const flushSave = async () => {
    const d = draftRef.current;
    if (!d.editable || !d.dirty) return;
    if (!d.ata.trim() && !d.hasMinute) return;
    const saved = await persistDraft(d);
    allowUnmountSaveRef.current = false;
    draftRef.current = { ...draftRef.current, dirty: false };
    toast.success("Rascunho salvo");
    onChanged({ minuteId: (saved as { minute?: { id?: string } })?.minute?.id });
    void qc.invalidateQueries({ queryKey: ["ongoing", calendarEventId] });
    void qc.invalidateQueries({ queryKey: ["chapter-minutes", chapterId] });
  };

  useEffect(() => {
    if (!flushSaveRef) return;
    flushSaveRef.current = flushSave;
    return () => {
      flushSaveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flushSaveRef, calendarEventId, chapterId, minutes?.id]);

  // Ao desmontar o painel (sair da sessão / trocar aba), persiste o rascunho
  useEffect(() => {
    allowUnmountSaveRef.current = true;
    return () => {
      if (!allowUnmountSaveRef.current) return;
      const d = draftRef.current;
      if (!d.editable || !d.dirty) return;
      if (!d.ata.trim() && !d.hasMinute) return;
      void persistDraft(d).catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar rascunho");
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const refresh = (minuteId?: string) => {
    onChanged(minuteId ? { minuteId } : undefined);
    const id = minuteId ?? minutes?.id;
    qc.invalidateQueries({ queryKey: ["minute-approvals", id] });
    qc.invalidateQueries({ queryKey: ["minute-public-votes", id] });
    qc.invalidateQueries({ queryKey: ["chapter-minutes", chapterId] });
  };

  const save = useMutation({
    mutationFn: (content: string) => persist(content),
    onSuccess: (r) => {
      toast.success("Ata salva");
      refresh((r as { minute?: { id?: string } })?.minute?.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar ata"),
  });

  const conclude = useMutation({
    mutationFn: async () => {
      const saved = await persist(ata);
      const minuteId = (saved as { minute: { id: string } }).minute.id;
      await submitMinute({ data: { minuteId } });
      return minuteId;
    },
    onSuccess: (minuteId) => {
      toast.success("Ata concluída — em revisão para aprovação");
      refresh(minuteId);
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
      const saved = await persist(ata);
      const minuteId = (saved as { minute: { id: string } }).minute.id;
      const share = await ensureMinutePublicShare({ data: { minuteId } });
      return { share, minuteId };
    },
    onSuccess: async ({ share, minuteId }) => {
      refresh(minuteId);
      const url = `${window.location.origin}/ata/${share.token}`;
      const kindLabel =
        MINUTE_KIND_LABELS[share.kind as MinuteKind] ?? share.kind;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          `Link copiado (${kindLabel}). Senha: ${share.password}`,
        );
      } catch {
        toast.success(`Link gerado (${kindLabel}). Senha: ${share.password}`, {
          description: url,
        });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar link público"),
  });

  const remove = useMutation({
    mutationFn: () => deleteMinute({ data: { minuteId: minutes!.id } }),
    onSuccess: () => {
      allowUnmountSaveRef.current = false;
      draftRef.current = { ...draftRef.current, dirty: false };
      toast.success("Ata movida para a lixeira", {
        description: "Recuperável por 30 dias em Atas → Lixeira.",
      });
      void qc.invalidateQueries({ queryKey: ["chapter-minutes", chapterId] });
      void qc.invalidateQueries({
        queryKey: ["chapter-minutes-deleted", chapterId],
      });
      void qc.invalidateQueries({ queryKey: ["ongoing", calendarEventId] });
      onDeleted?.();
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir ata"),
  });

  async function handleDelete() {
    if (!minutes?.id || !canDelete) return;
    const ok = await confirm({
      title: "Excluir esta ata?",
      description:
        "A ata vai para a lixeira e pode ser recuperada por 30 dias. O link público é revogado. A sessão permanece no calendário.",
      confirmLabel: "Excluir ata",
      destructive: true,
    });
    if (ok) remove.mutate();
  }

  function insertTemplate(id: string) {
    setTemplateId(id);
    const tpl = ((templates.data ?? []) as any[]).find((t) => t.id === id);
    if (!tpl) return;
    if (!ctx.data) {
      toast.message("Carregando dados do capítulo… tente de novo em instantes.");
      return;
    }
    const filled = applyVars(tpl.body, {
      chapterName: ctx.data.chapter?.name ?? active?.chapter.name,
      chapterNumber: ctx.data.chapter?.number ?? active?.chapter.number,
      chapterCity: ctx.data.chapter?.city ?? active?.chapter.city,
      date: item.start_at,
      location: item.location,
      address: item.address,
      officers: ctx.data.officers,
    });
    setAta(filled);
  }

  const st = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
  const votes = publicVotes.data ?? [];

  return (
    <Card className="rounded-[12px] p-5">
      {dialog}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span>Ata da sessão</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: st.bg, color: st.color }}
          >
            {MINUTE_STATUS_LABELS[status] ?? status}
          </span>
          <Badge variant="outline" className="text-[11px] font-normal">
            Nível {minuteKindToLevel(kind)} · {MINUTE_KIND_LABELS[kind]}
          </Badge>
          {dirty ? (
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
              Não salvo
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Select value={templateId} onValueChange={insertTemplate}>
              <SelectTrigger className="h-9 w-[220px] text-xs">
                <SelectValue placeholder="Inserir modelo…" />
              </SelectTrigger>
              <SelectContent>
                {((templates.data ?? []) as any[]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
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
                  signatures: SIGNER_ROLES.filter((r) =>
                    signedRoles.has(r),
                  ).map((r) => SIGNER_LABELS[r]),
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
            {exporting ? "Gerando…" : "PDF"}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className="text-xs">Tipo da ata</Label>
            <span className="text-[11px] text-muted-foreground">
              1 Pública · 2 Iniciático · 3 DeMolay
            </span>
          </div>
          <Slider
            min={1}
            max={3}
            step={1}
            value={[minuteKindToLevel(kind)]}
            disabled={!editable}
            onValueChange={(v) => setKind(minuteKindFromLevel(v[0] ?? 1))}
            aria-label="Tipo da ata"
          />
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            {MINUTE_KINDS.map((k) => {
              const activeKind = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!editable}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-md px-1 py-0.5 transition-colors",
                    k === "publica" && "text-left",
                    k === "grau_iniciatico" && "text-center",
                    k === "grau_demolay" && "text-right",
                    activeKind
                      ? "font-semibold text-foreground"
                      : "hover:text-foreground",
                    !editable && "cursor-default",
                  )}
                >
                  {MINUTE_KIND_SHORT_LABELS[k]}
                </button>
              );
            })}
          </div>
        </div>

        {editable ? (
          <div className="flex shrink-0 items-center gap-2 self-end pb-0.5 sm:self-center sm:pb-0">
            <Label
              htmlFor="minute-autocomplete"
              className="cursor-pointer whitespace-nowrap text-xs font-normal text-muted-foreground"
            >
              Autocomplete
            </Label>
            <Switch
              id="minute-autocomplete"
              checked={autocompleteOn}
              onCheckedChange={(next) => {
                setAutocompleteOn(next);
                writeAutocompletePref(next);
              }}
              aria-label="Autocomplete de nomes na ata"
            />
          </div>
        ) : null}
      </div>

      <MinuteBodyEditor
        chapterId={chapterId}
        value={ata}
        onChange={setAta}
        editable={editable}
        rows={18}
        className="text-sm leading-relaxed"
        placeholder="Selecione um modelo de ata ou escreva livremente."
        showAutocompleteToggle={false}
        autocompleteOn={autocompleteOn}
        onAutocompleteOnChange={(next) => {
          setAutocompleteOn(next);
          writeAutocompletePref(next);
        }}
      />

      {editable ? (
        <>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              Variáveis dinâmicas dos modelos
            </summary>
            <p className="mt-1.5 leading-relaxed">
              {AVAILABLE_VARS.join(" · ")} — as não reconhecidas permanecem
              entre colchetes para preenchimento manual.
            </p>
          </details>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {minutes?.updated_at
                ? `Última alteração: ${formatDateTimeBR(minutes.updated_at)}`
                : "Ainda não salva"}
              {dirty ? " · salva ao sair" : ""}
            </span>
            {minutes?.id && canDelete ? (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {remove.isPending ? "Excluindo…" : "Excluir"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={save.isPending || !dirty}
              onClick={() => save.mutate(ata)}
            >
              {save.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button
              variant="outline"
              disabled={sharePublic.isPending || !ata.trim()}
              onClick={() => sharePublic.mutate()}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {sharePublic.isPending ? "Gerando…" : "Compartilhar"}
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Texto bloqueado. Reabra a ata para
            corrigir.
          </p>
          {minutes?.id && canDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {remove.isPending ? "Excluindo…" : "Excluir ata"}
            </Button>
          ) : null}
        </div>
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
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
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
              const canSign = canSignAs(r);
              return (
                <li
                  key={r}
                  className="flex items-center justify-between gap-3 rounded-[8px] border border-border p-3"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className="h-4 w-4"
                      style={{
                        color: signed ? "#047857" : "var(--muted-foreground)",
                      }}
                    />
                    {SIGNER_LABELS[r]}
                  </span>
                  {signed ? (
                    <Badge
                      style={{ backgroundColor: "#D1FAE5", color: "#047857" }}
                    >
                      Assinada
                    </Badge>
                  ) : canSign ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sign.isPending}
                      onClick={() => sign.mutate(r)}
                    >
                      Assinar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Pendente
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
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
