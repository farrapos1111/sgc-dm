import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listTemplates,
  saveTemplate,
  createTemplate,
  deleteTemplate,
  listChapterMinutes,
  listSessionsWithoutMinutes,
  MINUTE_STATUS_LABELS,
  SIGNER_LABELS,
  SIGNER_ROLES,
} from "@/lib/minutes.functions";
import { MINUTE_KIND_LABELS } from "@/lib/minute-kinds";
import { can } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";
import { FileText, Plus, Download } from "lucide-react";
import {
  DocumentTemplatesPanel,
  type DocTemplate,
} from "@/components/documents/DocumentTemplatesPanel";

export const Route = createFileRoute("/_authenticated/_shell/atas")({
  head: () => ({
    meta: [
      { title: "Atas — Templo Virtual" },
      {
        name: "description",
        content:
          "Acompanhe atas em andamento, filtre por situação e gerencie os modelos padrão do capítulo.",
      },
      { property: "og:title", content: "Atas — Templo Virtual" },
      {
        property: "og:description",
        content: "Atas em andamento, histórico por situação e modelos editáveis do capítulo.",
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

function MinuteCard({ minute }: { minute: any }) {
  const signed = SIGNER_ROLES.filter((r) =>
    (minute.approvals ?? []).some((a: any) => a.signer_role === r),
  );
  const eventId = minute.calendar_event_id as string;

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">
              {minute.calendar_event?.title ?? "Sessão"}
            </h3>
            <StatusBadge status={minute.status} />
            {minute.kind ? (
              <Badge variant="outline" className="text-[11px] font-normal">
                {MINUTE_KIND_LABELS[minute.kind as keyof typeof MINUTE_KIND_LABELS] ??
                  minute.kind}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {minute.calendar_event?.start_at
              ? formatDateTimeBR(minute.calendar_event.start_at)
              : formatDateTimeBR(minute.opened_at)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Assinaturas: {signed.length}/3
        {signed.length > 0
          ? ` · ${signed.map((r) => SIGNER_LABELS[r]).join(", ")}`
          : " · nenhuma"}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <ExportPdfButton minute={minute} size="sm" />
        <Button asChild size="sm" style={{ backgroundColor: "var(--chapter-primary)" }}>
          <Link to="/ongoing/$id" params={{ id: eventId }} search={{ tab: "ata" }}>
            Acessar ata
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function CreateMinuteDialog({
  chapterId,
  open,
  onOpenChange,
}: {
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>("");

  const sessions = useQuery({
    queryKey: ["sessions-without-minutes", chapterId],
    queryFn: () => listSessionsWithoutMinutes({ data: { chapterId } }),
    enabled: open && Boolean(chapterId),
  });

  useEffect(() => {
    if (!open) setSelectedId("");
  }, [open]);

  const rows = sessions.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar nova ata</DialogTitle>
          <DialogDescription>
            Escolha uma sessão recente que ainda não possui ata. Você será levado à aba de
            redação.
          </DialogDescription>
        </DialogHeader>

        {sessions.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando sessões…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há sessões abertas sem ata nos últimos 60 dias (nem nos próximos 7).
          </p>
        ) : (
          <SearchableSelect
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Selecionar sessão…"
            searchPlaceholder="Buscar sessão…"
            emptyText="Nenhuma sessão encontrada."
            options={rows.map((ev) => ({
              value: ev.id,
              label: `${ev.title} · ${formatDateTimeBR(ev.start_at)}`,
            }))}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            style={{ backgroundColor: "var(--chapter-primary)" }}
            disabled={!selectedId}
            onClick={() => {
              onOpenChange(false);
              void navigate({
                to: "/ongoing/$id",
                params: { id: selectedId },
                search: { tab: "ata" },
              });
            }}
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AtasPage() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id ?? "";
  const { data: templates } = useSuspenseQuery(templatesQO(chapterId));
  const { data: minutes } = useSuspenseQuery(minutesQO(chapterId));
  const allowed = can(active?.role.name, "secretaria") || can(active?.role.name, "admin");

  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = minutes as any[];
  const inProgress = useMemo(
    () => rows.filter((r) => r.status !== "aprovada"),
    [rows],
  );
  const filtered = rows.filter((r) => status === "all" || r.status === status);

  return (
    <div>
      <PageHeader
        title="Atas"
        subtitle="Atas em andamento, histórico por situação e modelos padrão do capítulo."
      />

      <Tabs defaultValue="atual">
        <TabsList className="mb-4">
          <TabsTrigger value="atual">Atual</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="atual">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {inProgress.length === 0
                ? "Nenhuma ata em andamento."
                : `${inProgress.length} ata${inProgress.length === 1 ? "" : "s"} em andamento`}
            </p>
            <Button
              style={{ backgroundColor: "var(--chapter-primary)" }}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar nova ata
            </Button>
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Nenhuma ata em andamento"
              description="Crie uma nova ata a partir de uma sessão sem registro, ou acompanhe o histórico na aba Todas."
              action={
                <Button
                  style={{ backgroundColor: "var(--chapter-primary)" }}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova ata
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {inProgress.map((m) => (
                <li key={m.id}>
                  <MinuteCard minute={m} />
                </li>
              ))}
            </ul>
          )}

          <CreateMinuteDialog
            chapterId={chapterId}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
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
                  <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4">
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
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/ongoing/$id"
                          params={{ id: m.calendar_event_id }}
                          search={{ tab: "ata" }}
                        >
                          Acessar
                        </Link>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="modelos">
          <DocumentTemplatesPanel
            chapterId={chapterId}
            templates={(templates as DocTemplate[]) ?? []}
            editable={allowed}
            queryKey={["minute-templates", chapterId]}
            kind="ata"
            createTemplate={async ({ chapterId: cid, name, body }) =>
              createTemplate({ data: { chapterId: cid, name, body } })
            }
            saveTemplate={async ({ id, name, body }) =>
              saveTemplate({ data: { id, name, body } })
            }
            deleteTemplate={async ({ id }) =>
              deleteTemplate({ data: { id } })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
