import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useActiveChapter } from "@/context/ActiveChapterContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  DocumentTemplatesPanel,
  type DocTemplate,
} from "@/components/documents/DocumentTemplatesPanel";
import {
  createOficioTemplate,
  deleteOficio,
  deleteOficioTemplate,
  formatOficioNumber,
  listOficioTemplates,
  listOficios,
  saveOficioTemplate,
  termFromOficioIssuedAt,
  type OficioRow,
} from "@/lib/oficios.functions";
import { can } from "@/lib/permissions";
import { formatDateTimeBR } from "@/lib/format";
import { matchesLooseSearch } from "@/lib/utils";
import {
  chapterFoundedAt,
  currentTerm,
  termOptions,
} from "@/lib/terms";
import { Download, FileText, Plus, Search, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_shell/oficios/")({
  head: () => ({
    meta: [
      { title: "Ofícios — SG-CDM" },
      {
        name: "description",
        content:
          "Emita ofícios numerados, consulte o histórico e gerencie os modelos do capítulo.",
      },
    ],
  }),
  component: OficiosPage,
});

const templatesQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["oficio-templates", chapterId],
    queryFn: () => listOficioTemplates({ data: { chapterId } }),
  });

const oficiosQO = (chapterId: string) =>
  queryOptions({
    queryKey: ["oficios", chapterId],
    queryFn: () => listOficios({ data: { chapterId } }),
  });

function ExportPdfButton({ oficio, size }: { oficio: OficioRow; size?: "sm" }) {
  const { active } = useActiveChapter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size={size}
      disabled={busy || !oficio.body?.trim()}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          const { exportOficioPdf } = await import("@/lib/oficio-pdf");
          await exportOficioPdf({
            chapterName: active?.chapter.name ?? "",
            chapterNumber: active?.chapter.number,
            chapterCity: active?.chapter.city,
            logoPath: active?.chapter.logo_url,
            title: oficio.title,
            number: oficio.number,
            year: oficio.year,
            issuedAt: oficio.issued_at,
            content: oficio.body ?? "",
            mcName: oficio.mc_name,
            pccName: oficio.pcc_name,
            escrivaoName: oficio.escrivao_name,
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

function OficiosPage() {
  const { active } = useActiveChapter();
  const chapterId = active?.chapter_id ?? "";
  const { data: templates } = useSuspenseQuery(templatesQO(chapterId));
  const { data: oficios } = useSuspenseQuery(oficiosQO(chapterId));
  const allowed =
    can(active?.role.name, "secretaria") || can(active?.role.name, "admin");

  return (
    <div>
      <PageHeader
        title="Ofícios"
        subtitle="Emissão numerada, histórico e modelos padrão do capítulo."
        actions={
          allowed ? (
            <Button asChild style={{ backgroundColor: "var(--chapter-primary)" }}>
              <Link to="/oficios/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo ofício
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Tabs defaultValue="expedidos">
        <TabsList className="mb-4">
          <TabsTrigger value="expedidos">Expedidos</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="expedidos">
          <ExpedidosList
            oficios={oficios}
            chapterId={chapterId}
            allowed={allowed}
          />
        </TabsContent>

        <TabsContent value="modelos">
          <DocumentTemplatesPanel
            chapterId={chapterId}
            templates={(templates as DocTemplate[]) ?? []}
            editable={allowed}
            queryKey={["oficio-templates", chapterId]}
            kind="oficio"
            createTemplate={async ({ chapterId: cid, name, body }) =>
              createOficioTemplate({ data: { chapterId: cid, name, body } })
            }
            saveTemplate={async ({ id, name, body }) =>
              saveOficioTemplate({ data: { id, name, body } })
            }
            deleteTemplate={async ({ id }) =>
              deleteOficioTemplate({ data: { id } })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpedidosList({
  oficios,
  chapterId,
  allowed,
}: {
  oficios: OficioRow[];
  chapterId: string;
  allowed: boolean;
}) {
  const { active } = useActiveChapter();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const cur = currentTerm();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>(String(cur.year));
  const [semesterFilter, setSemesterFilter] = useState<string>(
    String(cur.semester),
  );

  const years = useMemo(() => {
    const founded = chapterFoundedAt(
      active?.chapter as { settings?: Record<string, unknown> } | null,
    );
    const base = termOptions({ foundedAt: founded, fallbackSpan: 6 });
    const set = new Set<number>([
      ...base.map((t) => t.year),
      ...oficios.map((o) => termFromOficioIssuedAt(o.issued_at).year),
    ]);
    return [...set].sort((a, b) => b - a);
  }, [oficios, active?.chapter]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return oficios.filter((o) => {
      const t = termFromOficioIssuedAt(o.issued_at);
      if (yearFilter !== "all" && t.year !== Number(yearFilter)) return false;
      if (semesterFilter !== "all" && t.semester !== Number(semesterFilter))
        return false;
      if (!q) return true;
      const label = formatOficioNumber(o.number, o.year);
      return (
        matchesLooseSearch(o.title, q) ||
        matchesLooseSearch(label, q) ||
        matchesLooseSearch(o.escrivao_name, q) ||
        matchesLooseSearch(String(o.number), q) ||
        matchesLooseSearch(String(o.year), q)
      );
    });
  }, [oficios, search, yearFilter, semesterFilter]);

  const remove = useMutation({
    mutationFn: (id: string) => deleteOficio({ data: { id } }),
    onSuccess: () => {
      toast.success("Ofício excluído");
      void qc.invalidateQueries({ queryKey: ["oficios", chapterId] });
      void qc.invalidateQueries({
        queryKey: ["oficio-issue-context", chapterId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (oficios.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-7 w-7" />}
        title="Nenhum ofício expedido"
        description="Redija o primeiro ofício em uma página dedicada, com modelos, variáveis dinâmicas e autocomplete — como nas atas. A numeração reinicia quando o escrivão do termo muda."
        action={
          allowed ? (
            <Button
              asChild
              style={{ backgroundColor: "var(--chapter-primary)" }}
            >
              <Link to="/oficios/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo ofício
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, título ou escrivão…"
            className="h-10 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-10 w-[5.5rem] shrink-0" aria-label="Ano">
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
          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger
              className="h-10 min-w-[8.5rem] flex-1 sm:w-[9.5rem]"
              aria-label="Semestre"
            >
              <SelectValue placeholder="Semestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="1">1º semestre</SelectItem>
              <SelectItem value="2">2º semestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-[12px] p-6 text-sm text-muted-foreground">
          Nenhum ofício encontrado com esses filtros.
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((o) => (
            <li key={o.id}>
              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {formatOficioNumber(o.number, o.year)} — {o.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTimeBR(o.issued_at)} · Escrivão: {o.escrivao_name}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ExportPdfButton oficio={o} size="sm" />
                  <Button asChild size="sm" variant="outline">
                    <Link to="/oficios/$id" params={{ id: o.id }}>
                      Abrir
                    </Link>
                  </Button>
                  {allowed ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-muted-foreground"
                      aria-label={`Excluir ofício ${formatOficioNumber(o.number, o.year)}`}
                      disabled={remove.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Excluir ofício?",
                          description: `Excluir ${formatOficioNumber(o.number, o.year)} — “${o.title}”? Esta ação não pode ser desfeita.`,
                          confirmLabel: "Excluir",
                        });
                        if (ok) remove.mutate(o.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog}
    </div>
  );
}
