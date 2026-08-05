import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Link2Off, ShieldCheck, UserPlus } from "lucide-react";
import {
  getMemberAccountStatus,
  provisionMemberAccount,
  setMemberPassword,
  resetMemberTemporaryPassword,
  revokeMemberChapterAccess,
} from "@/lib/accounts.functions";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { termLabel, currentTerm } from "@/lib/terms";

type Props = {
  memberId: string;
  memberEmail: string | null | undefined;
};

function AccessPreview({
  summary,
  termYear,
  termSemester,
}: {
  summary: string[];
  termYear: number;
  termSemester: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        Permissão efetiva — {termLabel(termYear, termSemester)}
      </div>
      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {summary.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        O acesso no app segue os cargos ritualísticos e comissões do semestre
        vigente (não há cargo de sistema separado).
      </p>
    </div>
  );
}

export type PasswordFieldsHandle = {
  /** Valida e devolve a senha (null se vazia e não obrigatória). */
  validate: (required: boolean) => string | null;
  clear: () => void;
  mustChange: () => boolean;
};

const PasswordFields = function PasswordFields({
  ref,
  required,
  idPrefix,
}: {
  ref?: Ref<PasswordFieldsHandle>;
  required?: boolean;
  idPrefix: string;
}) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [mustChange, setMustChange] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      validate(requiredFlag: boolean) {
        const pwd = password.trim();
        if (!pwd) {
          if (requiredFlag) throw new Error("Informe a senha");
          return null;
        }
        if (pwd.length < 8) {
          throw new Error("A senha deve ter pelo menos 8 caracteres");
        }
        if (pwd !== passwordConfirm.trim()) {
          throw new Error("As senhas não coincidem");
        }
        return pwd;
      },
      clear() {
        setPassword("");
        setPasswordConfirm("");
        setMustChange(false);
      },
      mustChange: () => mustChange,
    }),
    [password, passwordConfirm, mustChange],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-password`}>
            Senha{required ? " *" : " (opcional)"}
          </Label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              required ? "Mín. 8 caracteres" : "Vazia = gerar temporária"
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-password-confirm`}>Confirmar senha</Label>
          <Input
            id={`${idPrefix}-password-confirm`}
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Repita a senha"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={mustChange}
          onCheckedChange={(v) => setMustChange(v === true)}
        />
        Exigir troca de senha no próximo acesso
      </label>
    </div>
  );
};

export function MemberAccountPanel({ memberId, memberEmail }: Props) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const passwordRef = useRef<PasswordFieldsHandle>(null);
  const [shownPassword, setShownPassword] = useState<string | null>(null);
  const term = currentTerm();

  const { data, isLoading, error } = useQuery({
    queryKey: ["member-account", memberId],
    queryFn: () => getMemberAccountStatus({ data: { memberId } }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["member-account", memberId] });
    qc.invalidateQueries({ queryKey: ["member", memberId] });
  }

  const provision = useMutation({
    mutationFn: () => {
      const handle = passwordRef.current;
      if (!handle) throw new Error("Formulário de senha indisponível");
      const pwd = handle.validate(false);
      return provisionMemberAccount({
        data: {
          memberId,
          ...(pwd
            ? { password: pwd, mustChangePassword: handle.mustChange() }
            : {}),
        },
      });
    },
    onSuccess: (res) => {
      if (res.temporaryPassword) setShownPassword(res.temporaryPassword);
      passwordRef.current?.clear();
      invalidate();
      toast.success(
        res.status === "created"
          ? "Conta criada e acesso liberado"
          : "Conta existente vinculada ao membro",
      );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao criar acesso"),
  });

  const savePassword = useMutation({
    mutationFn: () => {
      const handle = passwordRef.current;
      if (!handle) throw new Error("Formulário de senha indisponível");
      const pwd = handle.validate(true);
      return setMemberPassword({
        data: {
          memberId,
          password: pwd!,
          mustChangePassword: handle.mustChange(),
        },
      });
    },
    onSuccess: (res) => {
      setShownPassword(res.password);
      passwordRef.current?.clear();
      invalidate();
      toast.success("Senha atualizada");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao definir senha"),
  });

  const generateTemp = useMutation({
    mutationFn: () => resetMemberTemporaryPassword({ data: { memberId } }),
    onSuccess: (res) => {
      setShownPassword(res.temporaryPassword);
      invalidate();
      toast.success("Nova senha temporária gerada");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao gerar senha"),
  });

  const revoke = useMutation({
    mutationFn: () => revokeMemberChapterAccess({ data: { memberId } }),
    onSuccess: () => {
      setShownPassword(null);
      invalidate();
      toast.success("Acesso ao capítulo desativado");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao desativar"),
  });

  async function copyPassword() {
    if (!shownPassword) return;
    try {
      await navigator.clipboard.writeText(shownPassword);
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
      ) : !data ? null : !data.linked ? (
        <div className="space-y-4">
          {!hasEmail ? (
            <p className="text-sm text-muted-foreground">
              Preencha o e-mail na ficha do membro antes de criar o acesso.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Crie a conta de login. As permissões no capítulo vêm dos cargos
                ritualísticos e comissões do semestre — não é necessário escolher
                cargo de acesso.
              </p>
              <AccessPreview
                summary={data.accessSummary ?? []}
                termYear={term.year}
                termSemester={term.semester}
              />
              <PasswordFields ref={passwordRef} idPrefix="provision" />
              <Button
                onClick={() => provision.mutate()}
                disabled={provision.isPending}
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                {provision.isPending ? "Criando…" : "Criar acesso"}
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">E-mail da conta</dt>
              <dd className="font-medium">{data.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Situação</dt>
              <dd className="flex flex-wrap gap-1.5 pt-0.5">
                {data.chapterMemberActive === false ? (
                  <Badge variant="destructive">Acesso desativado</Badge>
                ) : (
                  <Badge variant="secondary">Acesso ativo</Badge>
                )}
                {data.mustChangePassword ? (
                  <Badge variant="outline">Deve trocar a senha</Badge>
                ) : null}
              </dd>
            </div>
          </dl>

          <AccessPreview
            summary={data.accessSummary ?? []}
            termYear={term.year}
            termSemester={term.semester}
          />

          <div className="space-y-2">
            <p className="text-sm font-medium">Definir senha</p>
            <PasswordFields ref={passwordRef} required idPrefix="set-password" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => savePassword.mutate()}
                disabled={savePassword.isPending}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {savePassword.isPending ? "Salvando…" : "Salvar senha"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateTemp.mutate()}
                disabled={generateTemp.isPending}
              >
                Gerar senha temporária
              </Button>
              {data.chapterMemberActive !== false ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Desativar acesso?",
                      description:
                        "Desativar o acesso deste usuário a este capítulo?",
                      confirmLabel: "Desativar",
                    });
                    if (ok) revoke.mutate();
                  }}
                  disabled={revoke.isPending}
                >
                  <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                  Desativar acesso
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {shownPassword ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Senha (mostre ao membro com segurança)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-sm font-semibold">
              {shownPassword}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyPassword}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
      {dialog}
    </Card>
  );
}
