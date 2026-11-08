import type { ReactNode } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ORG_TYPE_LABELS, normalizeOrgType } from "@/lib/org-types";
import type { AuditRow, Stage } from "@/lib/console/console.functions";

export function ConsoleTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const REALM_NAMES: Record<string, string> = {
  odm: "ODM",
  fdj: "FDJ",
  loja: "Loja",
  outros: "Outras",
};

export const REALM_DOT: Record<string, string> = {
  odm: "bg-red-600",
  fdj: "bg-purple-600",
  loja: "bg-blue-600",
  outros: "bg-muted-foreground",
};

export function RealmTag({ realm, orgType }: { realm: string | null; orgType?: string | null }) {
  const key = realm ?? "outros";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${REALM_DOT[key] ?? REALM_DOT.outros}`} />
      {orgType ? ORG_TYPE_LABELS[normalizeOrgType(orgType)] : REALM_NAMES[key]}
    </span>
  );
}

export const STAGE_INFO: Record<Stage, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  em_contato: {
    label: "Em contato",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  aprovado: {
    label: "Aprovado",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  recusado: { label: "Recusado", className: "bg-muted text-muted-foreground" },
};

export function StageBadge({ stage }: { stage: Stage }) {
  const info = STAGE_INFO[stage] ?? STAGE_INFO.novo;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="secondary">Ativa</Badge>
  ) : (
    <Badge variant="destructive">Suspensa</Badge>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "pedido.atualizar": "Atualizou pedido",
  "pedido.aprovar": "Aprovou pedido",
  "instituicao.criar": "Criou instituição",
  "instituicao.editar": "Editou instituição",
  "instituicao.suspender": "Suspendeu instituição",
  "instituicao.reativar": "Reativou instituição",
  "instituicao.vincular_usuario": "Vinculou usuário",
  "instituicao.alterar_usuario": "Alterou vínculo de usuário",
  "conta.reset_password": "Gerou senha temporária",
  "conta.force_change": "Forçou troca de senha",
  "conta.unblock_login": "Desbloqueou login",
  "conta.disable": "Desativou conta",
  "conta.enable": "Reativou conta",
  "pessoa.ver_como": "Abriu raio-x de acesso",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditList({
  items,
  empty = "Nada registrado ainda.",
}: {
  items: AuditRow[];
  empty?: string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <div className="min-w-0">
            <p>
              <span className="font-medium">{a.actor?.full_name ?? "Admin"}</span>{" "}
              <span className="text-muted-foreground">· {actionLabel(a.action)}</span>
            </p>
            {a.target_type && (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {a.target_type} {a.target_id}
              </p>
            )}
          </div>
          <time className="shrink-0 text-xs text-muted-foreground">
            {formatDateTime(a.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

export function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(msg) as { message?: string }[];
    if (Array.isArray(parsed) && parsed[0]?.message) return parsed[0].message;
  } catch {
    /* mensagem comum */
  }
  return msg;
}

export function TempPassword({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">
        Senha temporária (troca obrigatória no 1º acesso)
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="font-mono text-base">{value}</code>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copiada");
          }}
          aria-label="Copiar senha"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
