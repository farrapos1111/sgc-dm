import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Radio, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  auditAreaLabel,
  auditSeverityLabel,
  exportAuditLogPdf,
  type AuditArea,
} from "@/lib/audit-log";
import {
  listChapterAudit,
  type ChapterAuditRow,
} from "@/lib/audit.functions";
import { useAuditLogRealtime } from "@/hooks/useAuditLogRealtime";
import {
  AuditLogFilterBar,
  EMPTY_AUDIT_FILTERS,
  auditSeverityBadgeClass,
  type AuditLogFilterState,
} from "@/components/AuditLogFilterBar";

function mutationErrorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

const AREA_FILTERS: Array<{ id: "todos" | AuditArea; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "tesouraria", label: "Tesouraria" },
  { id: "secretaria", label: "Secretaria" },
  { id: "eventos", label: "Eventos" },
];

function uniqueUsers(rows: Array<{ userId: string | null; userName: string }>) {
  const map = new Map<string, string>();
  for (const r of rows) {
    const id = r.userId || "__none__";
    if (!map.has(id)) map.set(id, r.userName);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function matchesUser(
  row: { userId: string | null },
  userId: string,
): boolean {
  if (!userId) return true;
  if (userId === "__none__") return !row.userId;
  return row.userId === userId;
}

export function ChapterAuditPanel({
  chapterId,
  chapterName,
  chapterCity,
  logoPath,
}: {
  chapterId: string;
  chapterName?: string;
  chapterCity?: string | null;
  logoPath?: string | null;
}) {
  const [area, setArea] = useState<"todos" | AuditArea>("todos");
  const [filters, setFilters] = useState<AuditLogFilterState>(EMPTY_AUDIT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const { live } = useAuditLogRealtime({ chapterId });
  const q = useQuery({
    queryKey: ["chapter-audit", chapterId, filters.from, filters.until],
    queryFn: () =>
      listChapterAudit({
        data: {
          chapterId,
          from: filters.from || null,
          until: filters.until || null,
        },
      }),
  });

  const users = useMemo(() => uniqueUsers(q.data ?? []), [q.data]);
  const rows = useMemo(() => {
    return (q.data ?? []).filter((r) => {
      if (area !== "todos" && r.area !== area) return false;
      if (!matchesUser(r, filters.userId)) return false;
      if (filters.severity && r.severity !== filters.severity) return false;
      return true;
    });
  }, [q.data, area, filters.userId, filters.severity]);

  async function exportPdf(list: ChapterAuditRow[]) {
    setExporting(true);
    try {
      const parts = [
        area === "todos" ? "Tesouraria, secretaria e eventos" : auditAreaLabel(area),
      ];
      if (filters.from || filters.until) {
        parts.push(
          `Período: ${filters.from || "…"} a ${filters.until || "…"}`,
        );
      }
      if (filters.severity) parts.push(auditSeverityLabel(filters.severity));
      const userName = users.find((u) => u.id === filters.userId)?.name;
      if (userName) parts.push(userName);
      await exportAuditLogPdf({
        chapterName: chapterName || "Capítulo",
        chapterCity: chapterCity ?? null,
        logoPath: logoPath ?? null,
        title: "Auditoria",
        subtitle: parts.join(" · "),
        lines: list.map((row) => ({
          createdAt: row.createdAt,
          userName: row.userName,
          title: `${row.title} · ${auditSeverityLabel(row.severity)}`,
          detail: row.detail,
        })),
      });
      toast.success("PDF gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setExporting(false);
    }
  }

  if (q.isLoading) {
    return (
      <Card className="rounded-[12px] p-5">
        <p className="text-sm text-muted-foreground">Carregando auditoria…</p>
      </Card>
    );
  }

  if (q.error) {
    return (
      <Card className="rounded-[12px] p-5">
        <p className="text-sm text-destructive">
          {mutationErrorMessage(q.error, "Erro ao carregar auditoria")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-[12px] p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Auditoria</div>
              {live ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  title="Sincroniza em tempo real"
                >
                  <Radio className="h-3 w-3 animate-pulse" />
                  Ao vivo
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Registro de alterações na tesouraria, secretaria e eventos.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || rows.length === 0}
          onClick={() => void exportPdf(rows)}
        >
          <FileText className="mr-1 h-4 w-4" />
          {exporting ? "Gerando…" : "PDF"}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {AREA_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={cn(
              "h-8 rounded-sm px-3 text-sm font-medium transition-colors",
              area === f.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setArea(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <AuditLogFilterBar
        value={filters}
        onChange={setFilters}
        users={users}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum registro nesta visão ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-b border-border pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {auditAreaLabel(row.area)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        auditSeverityBadgeClass(row.severity),
                      )}
                    >
                      {auditSeverityLabel(row.severity)}
                    </Badge>
                  </div>
                  {row.detail ? (
                    <div className="text-xs text-muted-foreground">
                      {row.detail}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  <div>{formatDateTimeBR(row.createdAt)}</div>
                  <div>{row.userName}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
