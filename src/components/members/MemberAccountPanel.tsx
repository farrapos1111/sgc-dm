import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Link2Off, UserPlus } from "lucide-react";
import {
  getMemberAccountStatus,
  provisionMemberAccount,
  resetMemberTemporaryPassword,
  revokeMemberChapterAccess,
} from "@/lib/accounts.functions";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as RoleName[]).filter(
  (r) => r !== "admin_total",
);

type Props = {
  memberId: string;
  memberEmail: string | null | undefined;
};

export function MemberAccountPanel({ memberId, memberEmail }: Props) {
  const qc = useQueryClient();
  const [roleName, setRoleName] = useState<RoleName>("membro");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["member-account", memberId],
    queryFn: () => getMemberAccountStatus({ data: { memberId } }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["member-account", memberId] });
    qc.invalidateQueries({ queryKey: ["member", memberId] });
  }

  const provision = useMutation({
    mutationFn: () =>
      provisionMemberAccount({ data: { memberId, roleName } }),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      invalidate();
      toast.success(
        res.status === "created"
          ? "Conta criada e vinculada"
          : "Conta existente vinculada ao membro",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao criar acesso"),
  });

  const resetPwd = useMutation({
    mutationFn: () => resetMemberTemporaryPassword({ data: { memberId } }),
    onSuccess: (res) => {
      setTempPassword(res.temporaryPassword);
      invalidate();
      toast.success("Nova senha temporária gerada");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao resetar senha"),
  });

  const revoke = useMutation({
    mutationFn: () => revokeMemberChapterAccess({ data: { memberId } }),
    onSuccess: () => {
      setTempPassword(null);
      invalidate();
      toast.success("Acesso ao capítulo desativado");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao desativar"),
  });

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Senha copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const hasEmail = Boolean(memberEmail?.trim());

  return (
    <Card className="rounded-[12px] p-5 md:col-span-2">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        Acesso ao sistema
      </h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar status"}
        </p>
      ) : !data?.linked ? (
        <div className="space-y-4">
          {!hasEmail ? (
            <p className="text-sm text-muted-foreground">
              Preencha o e-mail na ficha do membro antes de criar o acesso.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A ficha já está pronta. Crie a conta com senha temporária e
                peça ao jovem para redefinir no primeiro acesso.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Cargo de acesso</Label>
                  <Select
                    value={roleName}
                    onValueChange={(v) => setRoleName(v as RoleName)}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => provision.mutate()}
                  disabled={provision.isPending}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  {provision.isPending ? "Criando…" : "Criar acesso"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">E-mail da conta</dt>
              <dd className="font-medium">{data.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cargo de acesso</dt>
              <dd className="font-medium">{data.roleLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Situação</dt>
              <dd className="flex flex-wrap gap-1.5 pt-0.5">
                {data.chapterMemberActive === false ? (
                  <Badge variant="destructive">Acesso desativado</Badge>
                ) : (
                  <Badge variant="secondary">Vinculado</Badge>
                )}
                {data.mustChangePassword ? (
                  <Badge variant="outline">Aguardando 1º acesso</Badge>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetPwd.mutate()}
              disabled={resetPwd.isPending}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              Nova senha temporária
            </Button>
            {data.chapterMemberActive !== false ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      "Desativar o acesso deste usuário a este capítulo?",
                    )
                  ) {
                    revoke.mutate();
                  }
                }}
                disabled={revoke.isPending}
              >
                <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                Desativar acesso
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {tempPassword ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Senha temporária (mostre só uma vez ao membro)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-sm font-semibold">
              {tempPassword}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copyPassword}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
