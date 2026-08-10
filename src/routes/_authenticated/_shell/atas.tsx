import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
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
import { Input } from "@/components/ui/input";
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
import {
  MINUTE_KINDS,
  MINUTE_KIND_LABELS,
  type MinuteKind,
} from "@/lib/minute-kinds";
import { useChapterAccess } from "@/hooks/useChapterAccess";
import { formatDateTimeBR } from "@/lib/format";
import { datePartsInAppTz } from "@/lib/timezone";
import {
  chapterFoundedAt,
  currentTerm,
  termOptions,
  type Term,
} from "@/lib/terms";
import { matchesLooseSearch } from "@/lib/utils";
import { FileText, Plus, Download, Search, X } from "lucide-react";
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
        content:
          "Atas em andamento, histórico por situação e modelos editáveis do capítulo.",
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

type MinuteRow = {
  id: string;
  status: string;
  kind?: string | null;
  title?: string | null;
  content?: string | null;
  opened_at: string;
  calendar_event_id: string;
  calendar_event?: {
    title?: string | null;
    start_at?: string | null;
  } | null;
  approvals?: { signer_role: string }[];
};

function termFromMinute(m: MinuteRow): Term {
  const iso = m.calendar_event?.start_at ?? m.opened_at;
  const { year, month } = datePartsInAppTz(iso);
  return { year, semester: month <= 6 ? 1 : 2 };
}

function ExportPdfButton({ minute, size }: { minute: MinuteRow; size?: "sm" }) {
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
              (minute.approvals ?? []).some((a) => a.signer_role === r),
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

function MinuteCard({ minute }: { minute: MinuteRow }) {
  const signed = SIGNER_ROLES.filter((r) =>
    (minute.approvals ?? []).some((a) => a.signer_role === r),
  );
  const eventId = minute.calendar_event_id;

  return (
    <Card className="rounded-[12px] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">
              {minute.calendar_event?.title ?? "Sessão"}
            </h3>
            <StatusBadge status={minute.status} />
            {minute.kind ? (
              <Badge variant="outline" className="text-[11px] font-normal">
                {MINUTE_KIND_LABELS[minute.kind as MinuteKind] ?? minute.kind}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {minute.calendar_event?.start_at
              ? formatDateTimeBR(minute.calendar_event.start_at)
              : formatDateTimeBR(minute.opened_at)}
            {" · "}
            Assinaturas: {signed.length}/3
            {signed.length > 0
              ? ` · ${signed.map((r) => SIGNER_LABELS[r]).join(", ")}`
              : " · nenhuma"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <ExportPdfButton minute={minute} size="sm" />
          <Button
            asChild
            size="sm"
            style={{ backgroundColor: "var(--chapter-primary)" }}
          >
            <Link
              to="/ongoing/$id"
              params={{ id: eventId }}
              search={{ tab: "ata", minute: minute.id }}
            >
              Acessar ata
            </Link>
          </Button>
        </div>
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
            Escolha uma sessão recente que ainda não possui ata. Você será
            levado à aba de redação.
          </DialogDescription>
        </DialogHeader>

        {sessions.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando sessões…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há sessões abertas sem ata nos últimos 60 dias (nem nos próximos
            7).
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

function MinutesFilterBar({
  search,
  onSearchChange,
  yearFilter,
  onYearChange,
  semesterFilter,
  onSemesterChange,
  kindFilter,
  onKindChange,
  statusFilter,
  onStatusChange,
  years,
  hideApprovedStatus,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  yearFilter: string;
  onYearChange: (v: string) => void;
  semesterFilter: string;
  onSemesterChange: (v: string) => void;
  kindFilter: string;
  onKindChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  years: number[];
  /** Na aba Atual, não oferece "Aprovada". */
  hideApprovedStatus?: boolean;
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por sessão, grau ou trecho…"
          className="h-10 pl-9 pr-9"
        />
        {search ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Select value={yearFilter} onValueChange={onYearChange}>
          <SelectTrigger className="h-10 w-full" aria-label="Ano">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={semesterFilter} onValueChange={onSemesterChange}>
          <SelectTrigger className="h-10 w-full" aria-label="Semestre">
            <SelectValue placeholder="Semestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1">1º semestre</SelectItem>
            <SelectItem value="2">2º semestre</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={onKindChange}>
          <SelectTrigger className="h-10 w-full" aria-label="Grau">
            <SelectValue placeholder="Grau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os graus</SelectItem>
            {MINUTE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {MINUTE_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="h-10 w-full" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_revisao">Em Revisão para Aprovação</SelectItem>
            {!hideApprovedStatus ? (
              <SelectItem value="aprovada">Aprovada</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function filterMinutes(
  rows: MinuteRow[],
  opts: {
    search: string;
    year: string;
    semester: string;
    kind: string;
    status: string;
    onlyInProgress?: boolean;
  },
): MinuteRow[] {
  const q = opts.search.trim();
  return rows.filter((m) => {
    if (opts.onlyInProgress && m.status === "aprovada") return false;
    if (opts.status !== "all" && m.status !== opts.status) return false;
    if (opts.kind !== "all" && (m.kind ?? "publica") !== opts.kind) return false;

    const t = termFromMinute(m);
    if (opts.year !== "all" && t.year !== Number(opts.year)) return false;
    if (opts.semester !== "all" && t.semester !== Number(opts.semester))
      return false;

    if (!q) return true;
    const title = m.calendar_event?.title ?? m.title ?? "";
    const kindLabel =
      MINUTE_KIND_LABELS[(m.kind as MinuteKind) ?? "publica"] ?? m.kind ?? "";
    const statusLabel = MINUTE_STATUS_LABELS[m.status] ?? m.status;
    return (
      matchesLooseSearch(title, q) ||
      matchesLooseSearch(kindLabel, q) ||
      matchesLooseSearch(statusLabel, q) ||
      matchesLooseSearch(m.content ?? "", q)
    );
  });
}

function AtasPage() {
  const { active } = useActiveChapter();
  const { can, canScreen } = useChapterAccess();
  const chapterId = active?.chapter_id ?? "";
  const { data: templates } = useSuspenseQuery(templatesQO(chapterId));
  const { data: minutes } = useSuspenseQuery(minutesQO(chapterId));
  const allowed =
    canScreen("atas", "edit") || can("secretaria") || can("admin");

  const cur = currentTerm();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(String(cur.year));
  const [semesterFilter, setSemesterFilter] = useState(String(cur.semester));
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = (minutes as MinuteRow[]) ?? [];

  const years = useMemo(() => {
    const founded = chapterFoundedAt(
      active?.chapter as { settings?: Record<string, unknown> } | null,
    );
    const base = termOptions({ foundedAt: founded, fallbackSpan: 6 });
    const set = new Set<number>([
      ...base.map((t) => t.year),
      ...rows.map((m) => termFromMinute(m).year),
      cur.year,
    ]);
    return [...set].sort((a, b) => b - a);
  }, [rows, active?.chapter, cur.year]);

  const filterOpts = {
    search,
    year: yearFilter,
    semester: semesterFilter,
    kind: kindFilter,
    status: statusFilter,
  };

  const inProgress = useMemo(
    () => filterMinutes(rows, { ...filterOpts, onlyInProgress: true }),
    [rows, search, yearFilter, semesterFilter, kindFilter, statusFilter],
  );

  const filteredAll = useMemo(
    () => filterMinutes(rows, filterOpts),
    [rows, search, yearFilter, semesterFilter, kindFilter, statusFilter],
  );

  const filterBarProps = {
    search,
    onSearchChange: setSearch,
    yearFilter,
    onYearChange: setYearFilter,
    semesterFilter,
    onSemesterChange: setSemesterFilter,
    kindFilter,
    onKindChange: setKindFilter,
    statusFilter,
    onStatusChange: setStatusFilter,
    years,
  };

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
          <MinutesFilterBar {...filterBarProps} hideApprovedStatus />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {inProgress.length === 0
                ? "Nenhuma ata em andamento com esses filtros."
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
              description="Ajuste os filtros ou crie uma nova ata a partir de uma sessão sem registro."
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
          <MinutesFilterBar {...filterBarProps} />
          <p className="mb-3 text-sm text-muted-foreground">
            {filteredAll.length === 0
              ? "Nenhuma ata encontrada."
              : `${filteredAll.length} ata${filteredAll.length === 1 ? "" : "s"}`}
          </p>
          {filteredAll.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Nenhuma ata encontrada"
              description="Não há atas registradas para esses filtros."
            />
          ) : (
            <ul className="space-y-2">
              {filteredAll.map((m) => (
                <li key={m.id}>
                  <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium">
                          {m.calendar_event?.title ?? "Sessão"}
                        </div>
                        <StatusBadge status={m.status} />
                        {m.kind ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            {MINUTE_KIND_LABELS[m.kind as MinuteKind] ?? m.kind}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {m.calendar_event?.start_at
                          ? formatDateTimeBR(m.calendar_event.start_at)
                          : formatDateTimeBR(m.opened_at)}
                        {" · "}
                        {(m.approvals ?? []).length}/3 assinaturas
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <ExportPdfButton minute={m} size="sm" />
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/ongoing/$id"
                          params={{ id: m.calendar_event_id }}
                          search={{ tab: "ata", minute: m.id }}
                        >
                          Abrir
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
