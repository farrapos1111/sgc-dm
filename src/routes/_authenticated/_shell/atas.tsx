import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listTemplates,
  saveTemplate,
  createTemplate,
  deleteTemplate,
  listChapterMinutes,
  MINUTE_STATUS_LABELS,
  SIGNER_LABELS,
  SIGNER_ROLES,
} from "@/lib/minutes.functions";
import { AVAILABLE_VARS } from "@/lib/minute-vars";
import { can } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";
import { FileText, Plus, Trash2, Radio, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/atas")({
  head: () => ({
    meta: [
      { title: "Atas — SG-CDM" },
      {
        name: "description",
        content:
          "Acompanhe a ata atual, filtre atas por situação e gerencie os modelos padrão do capítulo.",
      },
      { property: "og:title", content: "Atas — SG-CDM" },
      {
        property: "og:description",
        content: "Ata atual, histórico por situação e modelos editáveis do capítulo.",
      },
    ],
  }),
  component: AtasPage,
});

const templatesQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["minute-templates", chapterId],
    queryFn: () => listTemplates({ data: { chapterId } }),
  });

const minutesQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["chapter-minutes", chapterId],
    queryFn: () => listChapterMinutes({ data: { chapterId } }),
  });

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  rascunho: { bg: "#F3F4F6", color: "#6B6B6B" },
  em_revisao: { bg: "#FEF3C7", color: "#B45309" },
  aprovada: { bg: "#D1FAE5", color: "#047857" },
};

function ExportPdfButton({ minute, size }: { minute: any; size?: "sm" }) {
  const { active } = useActiveChapter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size={size}
      disabled={busy || !minute?.content?.trim()}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          const { exportMinutePdf } = await import("@/lib/minute-pdf");
          await exportMinutePdf({
            chapterName: active?.chapter.name ?? "",
            chapterCity: active?.chapter.city,
            logoPath: active?.chapter.logo_url,
            title: minute.calendar_event?.title ?? "Sessão",
            dateISO: minute.calendar_event?.start_at ?? minute.opened_at,
            status: MINUTE_STATUS_LABELS[minute.status] ?? minute.status,
            signatures: SIGNER_ROLES.filter((r) =>
              (minute.approvals ?? []).some((a: any) => a.signer_role === r),
            ).map((r) => SIGNER_LABELS[r]),
            content: minute.content ?? "",
          });
        } catch (err: any) {
          toast.error(err?.message ?? "Erro ao gerar o PDF");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      {busy ? "Gerando…" : "PDF"}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: st.bg, color: st.color }}
    >
      {MINUTE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function AtasPage() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id ?? "";
  const { data: templates } = useSuspenseQuery(templatesQO(chapterId));
  const { data: minutes } = useSuspenseQuery(minutesQO(chapterId));
  const allowed = can(active?.role.name, "secretaria") || can(active?.role.name, "admin");

  const [status, setStatus] = useState<string>("all");

  const rows = minutes as any[];
  const current = useMemo(() => {
    const now = Date.now();
    const ongoing = rows.find((r) => {
      const ev = r.calendar_event;
      if (!ev) return false;
      const start = +new Date(ev.start_at);
      const end = ev.end_at ? +new Date(ev.end_at) : start + 12 * 3600 * 1000;
      return start <= now && now <= end;
    });
    return ongoing ?? rows.find((r) => r.status !== "aprovada") ?? null;
  }, [rows]);

  const filtered = rows.filter(
    (r) => (status === "all" || r.status === status) && r.id !== current?.id,
  );

  return (
    <div>
      <PageHeader
        title="Atas"
        subtitle="Ata em andamento, histórico por situação e modelos padrão do capítulo."
      />

      <Tabs defaultValue="atual">
        <TabsList className="mb-4">
          <TabsTrigger value="atual">Atual</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="atual">
          {!current ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Nenhuma ata em andamento"
              description="Ao abrir um item do calendário em andamento, a ata da sessão aparece aqui."
              action={
                <Button asChild variant="outline">
                  <Link to="/calendario">Ver calendário</Link>
                </Button>
              }
            />
          ) : (
            <Card className="rounded-[12px] p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Radio
                  className="h-4 w-4 animate-pulse"
                  style={{ color: "var(--chapter-primary)" }}
                />
                <span className="text-sm font-medium">
                  {current.calendar_event?.title ?? "Sessão"}
                </span>
                <StatusBadge status={current.status} />
                <span className="text-xs text-muted-foreground">
                  {current.calendar_event?.start_at
                    ? formatDateTimeBR(current.calendar_event.start_at)
                    : ""}
                </span>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[8px] border border-border p-3 font-sans text-sm leading-relaxed">
                {current.content || "Ata ainda em branco."}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="mr-auto text-xs text-muted-foreground">
                  Assinaturas:{" "}
                  {SIGNER_ROLES.filter((r) =>
                    (current.approvals ?? []).some((a: any) => a.signer_role === r),
                  )
                    .map((r) => SIGNER_LABELS[r])
                    .join(", ") || "nenhuma"}
                </span>
                <ExportPdfButton minute={current} />
                {current.calendar_event_id && (
                  <Button asChild style={{ backgroundColor: "var(--chapter-primary)" }}>
                    <Link to="/ongoing/$id" params={{ id: current.calendar_event_id }}>
                      Redigir ata
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="todas">
          <div className="mb-4 flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[240px] text-sm">
                <SelectValue placeholder="Filtrar por situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="em_revisao">Em Revisão para Aprovação</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Nenhuma ata encontrada"
              description="Não há atas registradas para esta situação."
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/ongoing/$id"
                    params={{ id: m.calendar_event_id }}
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.calendar_event?.title ?? "Sessão"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.calendar_event?.start_at
                          ? formatDateTimeBR(m.calendar_event.start_at)
                          : formatDateTimeBR(m.opened_at)}
                        {" · "}
                        {(m.approvals ?? []).length}/3 assinaturas
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={m.status} />
                      <ExportPdfButton minute={m} size="sm" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="modelos">
          <Card className="mb-4 rounded-[12px] p-4 text-xs text-muted-foreground">
            Variáveis reconhecidas: {AVAILABLE_VARS.join(" · ")}. Ao inserir um modelo na ata da
            sessão, elas são preenchidas automaticamente com os dados do capítulo e dos oficiais da
            vigência atual. Variáveis não reconhecidas permanecem entre colchetes para preenchimento
            manual.
          </Card>
          {allowed && <NewTemplate chapterId={chapterId} />}
          <div className="space-y-4">
            {(templates as any[]).map((t) => (
              <TemplateCard key={t.id} template={t} chapterId={chapterId} editable={allowed} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewTemplate({ chapterId }: { chapterId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => createTemplate({ data: { chapterId, name: name.trim(), body: "" } }),
    onSuccess: () => {
      toast.success("Modelo criado");
      setName("");
      qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar modelo"),
  });

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] p-4">
      <Input
        value={name}
        placeholder="Nome do novo modelo padrão"
        onChange={(e) => setName(e.target.value)}
        className="h-10 max-w-sm text-sm"
      />
      <Button
        style={{ backgroundColor: "var(--chapter-primary)" }}
        disabled={!name.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        <Plus className="mr-2 h-4 w-4" />
        {create.isPending ? "Criando…" : "Incluir modelo"}
      </Button>
    </Card>
  );
}

function TemplateCard({
  template,
  chapterId,
  editable,
}: {
  template: any;
  chapterId: string;
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setName(template.name);
    setBody(template.body);
  }, [template.name, template.body]);

  const save = useMutation({
    mutationFn: () => saveTemplate({ data: { id: template.id, name, body } }),
    onSuccess: () => {
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar modelo"),
  });

  const remove = useMutation({
    mutationFn: () => deleteTemplate({ data: { id: template.id } }),
    onSuccess: () => {
      toast.success("Modelo excluído");
      qc.invalidateQueries({ queryKey: ["minute-templates", chapterId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir modelo"),
  });

  const dirty = name !== template.name || body !== template.body;

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <Input
          value={name}
          disabled={!editable}
          onChange={(e) => setName(e.target.value)}
          className="h-9 max-w-sm text-sm font-medium"
        />
        {editable && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-10 w-10 text-muted-foreground"
            aria-label="Excluir modelo"
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Textarea
        value={body}
        rows={10}
        readOnly={!editable}
        onChange={(e) => setBody(e.target.value)}
        className="text-sm leading-relaxed"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        <span className="mr-auto text-xs text-muted-foreground">
          Atualizado em {formatDateTimeBR(template.updated_at)}
        </span>
        {editable && (
          <Button
            style={{ backgroundColor: "var(--chapter-primary)" }}
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo “{template.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo será removido do capítulo. As atas já redigidas não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
