import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
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
  listDeletedChapterMinutes,
  listSessionsWithoutMinutes,
  restoreMinute,
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
import { matchesLooseSearch, EMPTY_LIST } from "@/lib/utils";
import { FileText, Plus, Download, Search, X, Trash2, RotateCcw } from "lucide-react";
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

const deletedMinutesQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["chapter-minutes-deleted", chapterId],
    queryFn: () => listDeletedChapterMinutes({ data: { chapterId } }),
  });

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  rascunho: { bg: "var(--tv-line)", color: "#3F4249" },
  em_revisao: { bg: "var(--tv-warn-bg)", color: "var(--tv-warn)" },
  aprovada: { bg: "var(--tv-in-bg)", color: "var(--tv-in)" },
};

type MinuteRow = {
  id: string;
  status: string;
  kind?: string | null;
  title?: string | null;
  content?: string | null;
  opened_at: string;
  deleted_at?: string | null;
  rejection_note?: string | null;
  rejected_at?: string | null;
  calendar_event_id: string;
  calendar_event?: {
    title?: string | null;
    start_at?: string | null;
  } | null;
  approvals?: { signer_role: string }[];
};

function daysLeftInTrash(deletedAt: string | null | undefined): number {
  if (!deletedAt) return 0;
  const expires = new Date(deletedAt);
  expires.setDate(expires.getDate() + 30);
  const ms = expires.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

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
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: st.bg, color: st.color }}
    >
      {MINUTE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function minuteDate(m: MinuteRow): Date {
  return new Date(m.calendar_event?.start_at ?? m.opened_at);
}

function plainText(content: string | null | undefined): string {
  return (content ?? "")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[#*_>`]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Lista de atas à esquerda e a selecionada à direita (D-Atas / M-Ata do redesign). */
function MinutesMasterDetail({ minutes }: { minutes: MinuteRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(minutes[0]?.id ?? null);
  const selected = minutes.find((m) => m.id === selectedId) ?? minutes[0] ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <ul className="overflow-hidden rounded-[20px] bg-tv-surface">
        {minutes.map((m) => {
          const d = minuteDate(m);
          const on = selected?.id === m.id;
          const signed = (m.approvals ?? []).length;
          return (
            <li key={m.id} className="border-b border-tv-line last:border-0">
              {/* Celular: abre a ata direto. Desktop: seleciona para o painel. */}
              <Link
                to="/ongoing/$id"
                params={{ id: m.calendar_event_id }}
                search={{ tab: "ata", minute: m.id }}
                className="flex min-h-16 items-center gap-3 px-3.5 py-3 lg:hidden"
              >
                <MinuteRowContent m={m} d={d} signed={signed} />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                aria-pressed={on}
                className={`hidden min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors lg:flex ${
                  on ? "bg-tv-soft" : "hover:bg-tv-bg"
                }`}
              >
                <MinuteRowContent m={m} d={d} signed={signed} active={on} />
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? <MinuteDetail minute={selected} /> : null}
    </div>
  );
}

function MinuteRowContent({
  m,
  d,
  signed,
  active,
}: {
  m: MinuteRow;
  d: Date;
  signed: number;
  active?: boolean;
}) {
  return (
    <>
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-[14px] leading-none ${
          active ? "bg-tv-surface text-tv-ink" : "bg-tv-soft text-tv-ink"
        }`}
      >
        <span className="text-center">
          <span className="block font-display text-lg font-extrabold">{d.getDate()}</span>
          <span className="block text-[11px] font-semibold uppercase">{MONTH_SHORT[d.getMonth()]}</span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {m.calendar_event?.title ?? "Sessão"}
        </span>
        <span className="block truncate text-[13px] text-tv-text-2">
          {[
            m.kind ? (MINUTE_KIND_LABELS[m.kind as MinuteKind] ?? m.kind) : null,
            d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            `${signed} de 3 assinaturas`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <StatusBadge status={m.status} />
    </>
  );
}

function MinuteDetail({ minute }: { minute: MinuteRow }) {
  const d = minuteDate(minute);
  const signed = SIGNER_ROLES.filter((r) =>
    (minute.approvals ?? []).some((a) => a.signer_role === r),
  );
  const steps = [
    { label: "Rascunho", done: true },
    { label: "Em revisão", done: minute.status !== "rascunho" },
    { label: `Assinaturas (${signed.length}/3)`, done: signed.length >= 3 },
    { label: "Aprovada", done: minute.status === "aprovada" },
  ];
  const text = plainText(minute.content);

  return (
    <div className="hidden flex-col gap-4 rounded-[20px] bg-tv-surface p-6 lg:flex">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-extrabold leading-tight">
            {minute.calendar_event?.title ?? "Sessão"}
          </h2>
          <p className="mt-1 text-sm text-tv-text-2">
            Sessão de {d.toLocaleDateString("pt-BR")} às{" "}
            {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportPdfButton minute={minute} size="sm" />
          <Button asChild size="sm">
            <Link
              to="/ongoing/$id"
              params={{ id: minute.calendar_event_id }}
              search={{ tab: "ata", minute: minute.id }}
            >
              Abrir ata
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tv-text-2">
          Andamento
        </span>
        <ol className="mt-2.5 grid grid-cols-4 gap-2">
          {steps.map((st) => (
            <li key={st.label} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${st.done ? "bg-tv-primary" : "bg-[#E9E9E5] dark:bg-tv-line"}`} />
              <span className={`text-[13px] ${st.done ? "font-semibold text-tv-text" : "text-tv-text-2"}`}>
                {st.label}
              </span>
            </li>
          ))}
        </ol>
        {signed.length > 0 ? (
          <p className="mt-2 text-[13px] text-tv-text-2">
            Assinaram: {signed.map((r) => SIGNER_LABELS[r]).join(", ")}
          </p>
        ) : null}
      </div>

      {minute.kind ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-tv-text-2">Quem pode ler:</span>
          <span className="rounded-full bg-tv-soft px-2.5 py-1 text-xs font-semibold text-tv-ink">
            {MINUTE_KIND_LABELS[minute.kind as MinuteKind] ?? minute.kind}
          </span>
        </div>
      ) : null}

      {minute.rejection_note && minute.status === "rascunho" ? (
        <p className="rounded-[14px] bg-tv-warn-bg px-4 py-3 text-sm text-tv-warn">
          Reprovada: {minute.rejection_note}
        </p>
      ) : null}

      <div className="max-h-[420px] overflow-y-auto whitespace-pre-line rounded-[14px] bg-tv-bg px-5 py-4 text-[15px] leading-relaxed text-[#2A2C31] dark:text-tv-text">
        {text || <span className="text-tv-text-2">Ata ainda sem texto.</span>}
      </div>
    </div>
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
  const qc = useQueryClient();
  const chapterId = active?.chapter_id ?? "";
  const { data: minutes } = useSuspenseQuery(minutesQO(chapterId));
  const canEditAtas = canScreen("atas", "edit");
  const canManageTrash =
    canScreen("atas", "delete") || can("admin");
  const canViewModelos = canEditAtas;

  const deletedQ = useQuery({
    ...deletedMinutesQO(chapterId),
    enabled: Boolean(chapterId) && canManageTrash,
  });

  const templatesQ = useQuery({
    ...templatesQO(chapterId),
    enabled: Boolean(chapterId) && canViewModelos,
  });
  const templates = templatesQ.data ?? [];

  const restore = useMutation({
    mutationFn: (minuteId: string) => restoreMinute({ data: { minuteId } }),
    onSuccess: () => {
      toast.success("Ata recuperada");
      void qc.invalidateQueries({ queryKey: ["chapter-minutes", chapterId] });
      void qc.invalidateQueries({
        queryKey: ["chapter-minutes-deleted", chapterId],
      });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao recuperar ata"),
  });

  const cur = currentTerm();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(String(cur.year));
  const [semesterFilter, setSemesterFilter] = useState(String(cur.semester));
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = (minutes as MinuteRow[]) ?? EMPTY_LIST;
  const deletedRows = (deletedQ.data as MinuteRow[] | undefined) ?? [];

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
        eyebrow="Secretaria"
        title="Atas"
        subtitle={
          canViewModelos
            ? "Atas em andamento, histórico por situação, lixeira e modelos padrão do capítulo."
            : "Atas em andamento e histórico por situação, conforme o seu grau."
        }
      />

      <Tabs defaultValue="atual">
        <TabsList className="mb-4">
          <TabsTrigger value="atual">Atual</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          {canManageTrash ? (
            <TabsTrigger value="lixeira">
              Lixeira
              {deletedRows.length > 0 ? ` (${deletedRows.length})` : ""}
            </TabsTrigger>
          ) : null}
          {canViewModelos ? (
            <TabsTrigger value="modelos">Modelos</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="atual">
          <MinutesFilterBar {...filterBarProps} hideApprovedStatus />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {inProgress.length === 0
                ? "Nenhuma ata em andamento com esses filtros."
                : `${inProgress.length} ata${inProgress.length === 1 ? "" : "s"} em andamento`}
            </p>
            {canEditAtas ? (
              <Button
                
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar nova ata
              </Button>
            ) : null}
          </div>

          {inProgress.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Nenhuma ata em andamento"
              description={
                canEditAtas
                  ? "Ajuste os filtros ou crie uma nova ata a partir de uma sessão sem registro."
                  : "Não há atas em andamento com esses filtros."
              }
              action={
                canEditAtas ? (
                  <Button
                    
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Criar nova ata
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <MinutesMasterDetail key={inProgress.map((m) => m.id).join()} minutes={inProgress} />
          )}

          {canEditAtas ? (
            <CreateMinuteDialog
              chapterId={chapterId}
              open={createOpen}
              onOpenChange={setCreateOpen}
            />
          ) : null}
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
            <MinutesMasterDetail key={filteredAll.map((m) => m.id).join()} minutes={filteredAll} />
          )}
        </TabsContent>

        {canManageTrash ? (
          <TabsContent value="lixeira">
            <p className="mb-3 text-sm text-muted-foreground">
              Atas excluídas ficam recuperáveis por 30 dias. Depois são removidas
              definitivamente.
            </p>
            {deletedQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : deletedRows.length === 0 ? (
              <EmptyState
                icon={<Trash2 className="h-7 w-7" />}
                title="Lixeira vazia"
                description="Nenhuma ata excluída nos últimos 30 dias."
              />
            ) : (
              <ul className="space-y-2">
                {deletedRows.map((m) => {
                  const left = daysLeftInTrash(m.deleted_at);
                  return (
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
                                className="text-xs font-normal"
                              >
                                {MINUTE_KIND_LABELS[m.kind as MinuteKind] ??
                                  m.kind}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Excluída em{" "}
                            {m.deleted_at
                              ? formatDateTimeBR(m.deleted_at)
                              : "—"}
                            {" · "}
                            {left === 0
                              ? "Expira hoje"
                              : `${left} dia${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}`}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restore.isPending}
                          onClick={() => restore.mutate(m.id)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Recuperar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        ) : null}

        {canViewModelos ? (
          <TabsContent value="modelos">
            <DocumentTemplatesPanel
              chapterId={chapterId}
              templates={(templates as DocTemplate[]) ?? []}
              editable={canEditAtas}
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
        ) : null}
      </Tabs>
    </div>
  );
}
