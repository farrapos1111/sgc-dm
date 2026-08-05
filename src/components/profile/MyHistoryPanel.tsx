import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getMyMemberOrgHistory } from "@/lib/profile.functions";
import { PositionHistoryCollapsible } from "@/components/members/PositionHistoryCollapsible";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { termLabel } from "@/lib/terms";
import { formatDateBR } from "@/lib/format";

const COMMISSION_ROLE_LABELS: Record<string, string> = {
  presidente: "Presidente",
  vice: "Vice",
  membro: "Membro",
  auxiliar_senior: "Auxiliar Sênior",
};

type Props = {
  memberId: string;
  demolay: {
    grauLabel: string;
    iniciacaoOrdem: string | null;
    iniciacaoGrauDemolay: string | null;
    examGrauIniciatico: string | null;
    examGrauDemolay: string | null;
    demolayId: string | null;
    masonicId: string | null;
  };
};

export function MyHistoryPanel({ memberId, demolay }: Props) {
  const { data: org, isLoading, error } = useQuery({
    queryKey: ["my-org-history", memberId],
    queryFn: () => getMyMemberOrgHistory({ data: { memberId } }),
  });

  if (isLoading) {
    return (
      <Card className="flex justify-center rounded-[12px] p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-[12px] p-5 text-sm text-destructive">
        {error instanceof Error ? error.message : "Erro ao carregar histórico"}
      </Card>
    );
  }

  const positions = org?.positions ?? [];
  const commissions = org?.commissions ?? [];

  const positionHistoryItems = positions
    .filter((p: any) => p.chapter?.name)
    .map((p: any) => ({
      label: p.position?.label ?? "Cargo",
      term_year: p.term_year,
      term_semester: p.term_semester,
      chapter_name: p.chapter?.name ?? "",
      chapter_number: p.chapter?.number,
    }));

  const chapterKeys = new Set(
    positionHistoryItems.map(
      (p) => `${p.chapter_name}|${p.chapter_number ?? ""}`,
    ),
  );
  const multiChapter = chapterKeys.size > 1;

  return (
    <div className="space-y-4">
      <Card className="rounded-[12px] p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Histórico DeMolay
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">ID DeMolay</dt>
            <dd className="font-medium">{demolay.demolayId || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">ID maçônico</dt>
            <dd className="font-medium">{demolay.masonicId || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Grau atual</dt>
            <dd className="font-medium">{demolay.grauLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Iniciação na Ordem</dt>
            <dd className="font-medium">
              {formatDateBR(demolay.iniciacaoOrdem)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Exame Grau Iniciático</dt>
            <dd className="font-medium">
              {formatDateBR(demolay.examGrauIniciatico)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Iniciação Grau DeMolay</dt>
            <dd className="font-medium">
              {formatDateBR(demolay.iniciacaoGrauDemolay)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Exame Grau DeMolay</dt>
            <dd className="font-medium">
              {formatDateBR(demolay.examGrauDemolay)}
            </dd>
          </div>
        </dl>
      </Card>

      {multiChapter ? (
        <PositionHistoryCollapsible
          title="Histórico de cargos (todos os capítulos)"
          items={positionHistoryItems}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-[12px] p-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Cargos ritualísticos
          </h3>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cargo registrado.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {positions.map((p: any) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {p.position?.label ?? "Cargo"}
                    <span className="text-muted-foreground">
                      {" "}
                      — {termLabel(p.term_year, p.term_semester)}
                    </span>
                  </span>
                  {p.chapter?.name ? (
                    <span className="text-xs text-muted-foreground">
                      {p.chapter.name}
                      {p.chapter.number ? ` nº ${p.chapter.number}` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rounded-[12px] p-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Comissões
          </h3>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma participação em comissão.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {commissions.map((c: any) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {c.commission?.label ?? "Comissão"}{" "}
                    <Badge variant="secondary" className="ml-1">
                      {COMMISSION_ROLE_LABELS[c.role] ?? c.role}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {termLabel(c.term_year, c.term_semester)}
                    {c.chapter?.name
                      ? ` · ${c.chapter.name}${
                          c.chapter.number ? ` nº ${c.chapter.number}` : ""
                        }`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
