import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ban, KeyRound, LockOpen, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  consoleAccountAction,
  consoleGetPerson,
  consoleListAudit,
} from "@/lib/console/console.functions";
import {
  AuditList,
  ConsoleTitle,
  RealmTag,
  TempPassword,
  errorText,
  formatDateTime,
} from "@/components/console/console-ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/console/_app/pessoas/$userId")({
  component: PersonPage,
});

const PERM_LABELS: Record<string, string> = {
  visualizar: "Ver",
  secretaria: "Secretaria",
  tesouraria: "Tesouraria",
  comissoes: "Comissões",
  conselho: "Conselho",
  admin: "Administração",
};

type Action = "reset_password" | "force_change" | "unblock_login" | "disable" | "enable";

function PersonPage() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data: p, isPending } = useQuery({
    queryKey: ["console", "person", userId],
    queryFn: () => consoleGetPerson({ data: { userId } }),
  });
  const { data: audit } = useQuery({
    queryKey: ["console", "audit", "user", userId],
    queryFn: () => consoleListAudit({ data: { targetType: "user", targetId: userId, limit: 50 } }),
  });

  const act = useMutation({
    mutationFn: (action: Action) => consoleAccountAction({ data: { userId, action } }),
    onSuccess: (res) => {
      if (res.temporaryPassword) setTempPassword(res.temporaryPassword);
      void qc.invalidateQueries({ queryKey: ["console", "person", userId] });
      void qc.invalidateQueries({ queryKey: ["console", "audit", "user", userId] });
      toast.success("Feito");
    },
    onError: (e) => toast.error(errorText(e)),
  });

  async function run(action: Action, title: string, description: string, destructive = false) {
    const ok = await confirm({ title, description, confirmLabel: "Confirmar", destructive });
    if (ok) act.mutate(action);
  }

  if (isPending) return <PageSkeleton />;
  if (!p) return <p className="text-sm text-muted-foreground">Conta não encontrada.</p>;

  type F = { id: string; full_name: string; chapter_id: string; status: string };
  const fichas = [
    ...(p.fichas.odm as unknown as F[]).map((f) => ({ ...f, esfera: "odm" })),
    ...(p.fichas.fdj as unknown as F[]).map((f) => ({ ...f, esfera: "fdj" })),
    ...(p.fichas.loja as unknown as F[]).map((f) => ({ ...f, esfera: "loja" })),
  ];

  return (
    <div>
      <Link
        to="/console/pessoas"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pessoas
      </Link>
      <ConsoleTitle
        title={p.profile?.full_name ?? p.email ?? "Conta"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.email}
            {p.isPlatformAdmin && <Badge>Admin da plataforma</Badge>}
            {p.banned && <Badge variant="destructive">Desativada</Badge>}
            {p.profile?.must_change_password && (
              <Badge variant="outline">Troca de senha pendente</Badge>
            )}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-semibold">Conta</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Criada em" v={formatDateTime(p.createdAt)} />
            <Row k="Último acesso" v={formatDateTime(p.lastSignInAt)} />
            <Row k="Telefone" v={p.profile?.phone ?? "—"} />
            <Row k="2FA" v={p.mfaFactors ? "Ativado" : "Não"} />
          </dl>
          <div className="mt-4 grid gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run(
                  "reset_password",
                  "Gerar senha temporária?",
                  "A senha atual deixa de funcionar. A pessoa precisa trocar no próximo acesso. Você verá a senha nova uma única vez.",
                )
              }
            >
              <KeyRound className="mr-2 h-4 w-4" /> Gerar senha temporária
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run(
                  "force_change",
                  "Forçar troca de senha?",
                  "No próximo acesso a pessoa terá que definir uma senha nova.",
                )
              }
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Forçar troca de senha
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                run(
                  "unblock_login",
                  "Desbloquear login?",
                  "Zera o bloqueio por tentativas erradas (e-mail e IDs da pessoa).",
                )
              }
            >
              <LockOpen className="mr-2 h-4 w-4" /> Desbloquear login
            </Button>
            {p.banned ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  run("enable", "Reativar conta?", "A pessoa volta a conseguir entrar.")
                }
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Reativar conta
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() =>
                  run(
                    "disable",
                    "Desativar conta?",
                    "A pessoa não consegue mais entrar. Nenhum dado é apagado e dá para reativar depois.",
                    true,
                  )
                }
              >
                <Ban className="mr-2 h-4 w-4" /> Desativar conta
              </Button>
            )}
          </div>
          {tempPassword && (
            <div className="mt-4">
              <TempPassword value={tempPassword} />
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold">Raio-x de acesso</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Somente leitura: o que esta conta enxerga e pode fazer em cada instituição, considerando
            o papel base e os cargos do semestre atual.
          </p>
          <ul className="space-y-3">
            {p.access.map((a) => (
              <li
                key={a.linkId}
                className={`rounded-lg border border-border p-3 ${a.active ? "" : "opacity-60"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/console/instituicoes/$id"
                    params={{ id: a.chapterId }}
                    className="font-medium hover:underline"
                  >
                    {a.chapter ? `${a.chapter.name} nº ${a.chapter.number}` : a.chapterId}
                  </Link>
                  <RealmTag realm={a.chapter?.realm ?? null} orgType={a.chapter?.org_type} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Papel: {a.role?.label ?? "—"}
                  {a.positions.length
                    ? ` · Cargos: ${a.positions.map((x) => x.label).join(", ")}`
                    : ""}
                  {!a.active && " · vínculo inativo"}
                  {a.chapter && !a.chapter.active && " · instituição suspensa"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.permissions.length ? (
                    a.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary" className="font-normal">
                        {PERM_LABELS[perm] ?? perm}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem permissões ativas.</span>
                  )}
                </div>
              </li>
            ))}
            {!p.access.length && (
              <li className="text-sm text-muted-foreground">Sem vínculo com instituições.</li>
            )}
          </ul>
          {p.leaderships.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Também tem {p.leaderships.length} cargo(s) de liderança estadual/regional.
            </p>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Fichas vinculadas</h2>
          <ul className="divide-y divide-border text-sm">
            {fichas.map((f) => (
              <li key={`${f.esfera}-${String(f.id)}`} className="flex items-center gap-3 py-2">
                <RealmTag realm={f.esfera} />
                <span className="flex-1 truncate">{String(f.full_name)}</span>
                <Link
                  to="/console/instituicoes/$id"
                  params={{ id: String(f.chapter_id) }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  instituição
                </Link>
                <Badge variant={f.status === "regular" ? "secondary" : "destructive"}>
                  {String(f.status)}
                </Badge>
              </li>
            ))}
            {!fichas.length && (
              <li className="py-2 text-muted-foreground">Nenhuma ficha ligada a esta conta.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-2 font-semibold">Ações do Console</h2>
          <AuditList items={audit?.items ?? []} empty="Nenhuma." />
        </Card>
      </div>
      {dialog}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
