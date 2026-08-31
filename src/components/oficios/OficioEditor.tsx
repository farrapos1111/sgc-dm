import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MinuteBodyEditor,
  readAutocompletePref,
  writeAutocompletePref,
} from "@/components/minutes/MinuteBodyEditor";
import { applyVars, AVAILABLE_VARS } from "@/lib/minute-vars";
import { getMinuteContext } from "@/lib/minutes.functions";
import {
  formatOficioNumber,
  getOficio,
  getOficioIssueContext,
  issueOficio,
  listOficioTemplates,
  type OficioRow,
} from "@/lib/oficios.functions";
import {
  chapterOrdemLabel,
  formatOficioDate,
  stripEmbeddedOficioSignatures,
} from "@/lib/oficio-pdf";
import { useChapterLogo } from "@/lib/chapter-logo";
import { currentTerm } from "@/lib/terms";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { Download, FileText } from "lucide-react";

type DraftProps = {
  chapterId: string;
  canIssue: boolean;
  onIssued: (oficio: OficioRow) => void;
};

function OficioSignatures({
  pccName,
  mcName,
  escrivaoName,
}: {
  pccName: string;
  mcName: string;
  escrivaoName: string;
}) {
  const cols = [
    { name: pccName, role: "Presidente do Conselho Consultivo" },
    { name: mcName, role: "Mestre Conselheiro" },
    { name: escrivaoName, role: "Escrivão" },
  ];
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
      {cols.map((c) => (
        <div key={c.role} className="text-center text-xs">
          <div className="mx-auto mb-2 h-px w-[85%] max-w-[11rem] bg-foreground/70" />
          <div className="font-medium text-foreground">{c.name || "—"}</div>
          <div className="mt-0.5 text-muted-foreground">{c.role}</div>
        </div>
      ))}
    </div>
  );
}

/** Redação de ofício novo — mesmas variáveis e autocomplete das atas. */
export function OficioDraftPanel({
  chapterId,
  canIssue,
  onIssued,
}: DraftProps) {
  const qc = useQueryClient();
  const term = currentTerm();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [autocompleteOn, setAutocompleteOn] = useState(true);

  useEffect(() => {
    setAutocompleteOn(readAutocompletePref());
  }, []);

  const templates = useQuery({
    queryKey: ["oficio-templates", chapterId],
    queryFn: () => listOficioTemplates({ data: { chapterId } }),
    enabled: Boolean(chapterId),
  });

  const minuteCtx = useQuery({
    queryKey: ["minute-context", chapterId, term.year, term.semester],
    queryFn: () =>
      getMinuteContext({
        data: {
          chapterId,
          termYear: term.year,
          termSemester: term.semester,
        },
      }),
    enabled: Boolean(chapterId),
  });

  const issueCtx = useQuery({
    queryKey: ["oficio-issue-context", chapterId],
    queryFn: () => getOficioIssueContext({ data: { chapterId } }),
    enabled: Boolean(chapterId),
  });

  function varContext() {
    return {
      chapterName: minuteCtx.data?.chapter?.name ?? active?.chapter.name,
      chapterNumber: minuteCtx.data?.chapter?.number ?? active?.chapter.number,
      chapterCity: minuteCtx.data?.chapter?.city ?? active?.chapter.city,
      date: new Date().toISOString(),
      location: minuteCtx.data?.chapter?.city ?? active?.chapter.city ?? null,
      address: null as string | null,
      officers: minuteCtx.data?.officers,
    };
  }

  function insertTemplate(id: string) {
    setTemplateId(id);
    const tpl = (templates.data ?? []).find((t) => t.id === id);
    if (!tpl) return;
    if (!minuteCtx.data) {
      toast.message(
        "Carregando dados do capítulo… tente de novo em instantes.",
      );
      return;
    }
    setBody(applyVars(tpl.body, varContext()));
    if (!title.trim()) setTitle(tpl.name);
  }

  const issue = useMutation({
    mutationFn: () => {
      const filled = applyVars(body, varContext());
      return issueOficio({
        data: {
          chapterId,
          title: title.trim(),
          body: filled,
          templateId: templateId || null,
        },
      });
    },
    onSuccess: async (res) => {
      toast.success(`Ofício ${res.label} expedido`);
      void qc.invalidateQueries({ queryKey: ["oficios", chapterId] });
      void qc.invalidateQueries({
        queryKey: ["oficio-issue-context", chapterId],
      });
      const row = await getOficio({ data: { id: res.id } });
      onIssued(row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = issueCtx.data;

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          <span>Redação do ofício</span>
          {preview ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
              Próximo {preview.label}
              {preview.seriesResets ? " · nova série" : ""}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={templateId} onValueChange={insertTemplate}>
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue placeholder="Inserir modelo…" />
            </SelectTrigger>
            <SelectContent>
              {(templates.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="oficio-autocomplete"
              className="cursor-pointer whitespace-nowrap text-xs font-normal text-muted-foreground"
            >
              Autocomplete
            </Label>
            <Switch
              id="oficio-autocomplete"
              checked={autocompleteOn}
              onCheckedChange={(next) => {
                setAutocompleteOn(next);
                writeAutocompletePref(next);
              }}
              aria-label="Autocomplete de nomes no ofício"
            />
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <Label htmlFor="oficio-title">Título</Label>
        <Input
          id="oficio-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Assunto do ofício"
          className="h-10"
        />
      </div>

      <MinuteBodyEditor
        chapterId={chapterId}
        value={body}
        onChange={setBody}
        editable
        rows={18}
        className="text-sm leading-relaxed"
        placeholder="Selecione um modelo ou escreva livremente. Use [variáveis] e Irmão… / Tio… para autocomplete."
        showAutocompleteToggle={false}
        autocompleteOn={autocompleteOn}
        onAutocompleteOnChange={(next) => {
          setAutocompleteOn(next);
          writeAutocompletePref(next);
        }}
      />

      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">
          Variáveis dinâmicas dos modelos
        </summary>
        <p className="mt-1.5 leading-relaxed">
          {AVAILABLE_VARS.join(" · ")} — as não reconhecidas permanecem entre
          colchetes para preenchimento manual. Ao inserir um modelo ou expedir,
          elas são preenchidas com o capítulo e os oficiais do termo atual.
        </p>
      </details>

      <Card className="mt-4 space-y-2 rounded-[10px] border-dashed p-3 text-xs">
        <div className="font-medium text-foreground">
          Assinaturas (ao expedir) — PCC · MC · Escrivão
        </div>
        {issueCtx.isLoading ? (
          <p className="text-muted-foreground">Carregando oficiais…</p>
        ) : preview?.missing.length ? (
          <p className="text-destructive">
            Faltam cargos no termo atual: {preview.missing.join(", ")}.
          </p>
        ) : (
          <OficioSignatures
            pccName={preview?.pccName ?? ""}
            mcName={preview?.mcName ?? ""}
            escrivaoName={preview?.escrivaoName ?? ""}
          />
        )}
        <p className="text-muted-foreground">
          As assinaturas saem lado a lado no PDF e na visualização; não entram
          no texto editável.
        </p>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          style={{ backgroundColor: "var(--chapter-primary)" }}
          disabled={
            !canIssue || !title.trim() || !preview?.canIssue || issue.isPending
          }
          onClick={() => issue.mutate()}
        >
          {issue.isPending ? "Expedindo…" : "Expedir ofício"}
        </Button>
      </div>
    </Card>
  );
}

type ViewProps = {
  oficio: OficioRow;
};

function OficioDocumentHeader({
  chapterName,
  chapterNumber,
  logoPath,
  number,
  year,
  title,
  issuedAt,
}: {
  chapterName: string;
  chapterNumber?: string | null;
  logoPath?: string | null;
  number: number;
  year: number;
  title: string;
  issuedAt?: string | null;
}) {
  const logoUrl = useChapterLogo(logoPath ?? null);
  return (
    <div className="mb-5 px-1 text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="mx-auto mb-2 h-16 w-auto object-contain"
        />
      ) : null}
      <p className="text-[11px] font-bold tracking-wide text-foreground">
        SUPREMO CONSELHO DEMOLAY BRASIL
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {chapterName}
      </p>
      <div className="mx-3 my-3 border-t-2 border-black" />
      <p className="text-base font-bold text-foreground">
        Ofício {formatOficioNumber(number, year)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {chapterOrdemLabel(chapterName, chapterNumber)}
      </p>
      <div className="mt-4 flex items-start justify-between gap-4 text-left text-sm">
        <p className="min-w-0 flex-1">
          <span className="font-medium">Assunto:</span> {title || "—"}
        </p>
        {issuedAt ? (
          <p className="shrink-0 tabular-nums text-foreground">
            {formatOficioDate(issuedAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Visualização de ofício já expedido. */
export function OficioViewPanel({ oficio }: ViewProps) {
  const { active } = useActiveChapter();
  const [exporting, setExporting] = useState(false);
  const bodyText = stripEmbeddedOficioSignatures(oficio.body ?? "");
  const chapterName = active?.chapter.name ?? "";
  const chapterNumber = active?.chapter.number;

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            Expedido
          </span>
          <span className="text-xs text-muted-foreground">
            Escrivão: {oficio.escrivao_name}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || !bodyText.trim()}
          onClick={async () => {
            setExporting(true);
            try {
              const { loadOficioSignatureMap } =
                await import("@/lib/oficio-signatures");
              const byCode = await loadOficioSignatureMap(active?.chapter_id);
              const { exportOficioPdf } = await import("@/lib/oficio-pdf");
              await exportOficioPdf({
                chapterName,
                chapterNumber,
                chapterCity: active?.chapter.city,
                logoPath: active?.chapter.logo_url,
                title: oficio.title,
                number: oficio.number,
                year: oficio.year,
                issuedAt: oficio.issued_at,
                content: bodyText,
                mcName: oficio.mc_name,
                pccName: oficio.pcc_name,
                escrivaoName: oficio.escrivao_name,
                pccSignatureDataUrl:
                  byCode.presidente_conselho_consultivo?.signatureDataUrl,
                mcSignatureDataUrl: byCode.mestre_conselheiro?.signatureDataUrl,
                escrivaoSignatureDataUrl: byCode.escrivao?.signatureDataUrl,
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

      <OficioDocumentHeader
        chapterName={chapterName}
        chapterNumber={chapterNumber}
        logoPath={active?.chapter.logo_url}
        number={oficio.number}
        year={oficio.year}
        title={oficio.title}
        issuedAt={oficio.issued_at}
      />

      <MinuteBodyEditor
        chapterId={oficio.chapter_id}
        value={bodyText}
        onChange={() => {}}
        editable={false}
        rows={18}
        className="text-sm leading-relaxed"
        showAutocompleteToggle={false}
      />

      <OficioSignatures
        pccName={oficio.pcc_name}
        mcName={oficio.mc_name}
        escrivaoName={oficio.escrivao_name}
      />
    </Card>
  );
}
